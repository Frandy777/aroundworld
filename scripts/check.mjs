import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

// Resolve extensionless TypeScript imports (`./data` -> `./data.ts`) so Node runs `src/` modules directly.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier) && context.parentURL) {
      const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      for (const suffix of ['.ts', '.tsx', '/index.ts']) {
        if (fs.existsSync(base + suffix)) return nextResolve(pathToFileURL(base + suffix).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name)) out.push(full);
  }
  return out;
}

// 1. Shader `#include <chunk>` and `.replace('#include <chunk>', ...)` integrity against installed Three.js.
const libSources = Object.values(THREE.ShaderLib).flatMap((lib) => [lib?.vertexShader, lib?.fragmentShader]).filter(Boolean);
const allChunkSources = [...libSources, ...Object.values(THREE.ShaderChunk)];
let includeCount = 0;
for (const file of walk(path.join(root, 'src/client/render'))) {
  const src = fs.readFileSync(file, 'utf8'), rel = path.relative(root, file);
  for (const m of src.matchAll(/#include\s*<(\w+)>/g)) {
    includeCount++;
    assert(m[1] in THREE.ShaderChunk, `${rel}: unknown Three.js ShaderChunk <#include <${m[1]}>>`);
  }
  for (const m of src.matchAll(/\.replace\(\s*(['"`])(#include\s*<\w+>|[^'"`\n]+)\1/g)) {
    const needle = m[2];
    if (!needle.includes('#include') && !needle.includes('shadow') && !needle.includes('reflectedLight')) continue;
    assert(allChunkSources.some((s) => s.includes(needle)), `${rel}: shader patch anchor not found in Three.js sources: "${needle}"`);
  }
}

// 2. Shared board data & state reducer sanity checks.
const { TILES, TILE_COUNT, PLAYER_DEFS, START_CASH } = await import('../src/shared/data.ts');
const { apply, stats, ranking, command } = await import('../src/shared/state.ts');
assert.equal(TILES.length, TILE_COUNT, 'TILES length must match TILE_COUNT');
TILES.forEach((t, i) => assert.equal(t.i, i, `Tile index mismatch at ${i}`));

const S = {
  settings: { mode: 'limited', rounds: 30 },
  own: {},
  order: [0, 1],
  turn: 0,
  round: 1,
  step: null,
  bankrupt: [],
  over: false,
  log: [],
  players: PLAYER_DEFS.slice(0, 2).map((p) => ({ ...p, cash: START_CASH, dep: null, tile: 0, jail: false, party: false, stay: false, out: 0 })),
};
apply(S, { t: 'cash', pi: 0, d: -500 });
apply(S, { t: 'own', i: 1, o: { p: 0, lv: 1, m: false } }); // Wellington ($1,600) at Lv 1: lot value 1600 + 400
apply(S, { t: 'dep', pi: 0, d: { amt: 2000, n: 5, made: 1 } });
assert.equal(S.players[0].cash, START_CASH - 500);
assert.equal(stats(S, 0).city, 1);
assert.equal(stats(S, 0).val, 2000);
assert.equal(stats(S, 0).net, START_CASH - 500 + 2000 + 2000); // cash + deposit + lot value
assert.equal(ranking(S).length, 2);
assert.ok(command(S, { c: 'cash', pi: 0, v: 2000 }));
assert.equal(command(S, { c: 'cash', pi: 99, v: 0 }), undefined);

// 3. Pure render math checks (if present).
const flightPath = path.join(root, 'src/client/render/flight.ts');
if (fs.existsSync(flightPath)) {
  const mod = await import(pathToFileURL(flightPath).href);
  if (typeof mod.flight === 'function') {
    const start = new THREE.Vector3(0, 1.5, 0), end = new THREE.Vector3(36, 0.65, -24);
    const plan = mod.flight(start, end);
    const p0 = new THREE.Vector3(), v0 = new THREE.Vector3(), p1 = new THREE.Vector3(), v1 = new THREE.Vector3();
    plan.at(0, p0, v0);
    assert(p0.distanceTo(start) < 1e-6, 'flight start position mismatch');
    plan.at(plan.duration, p1, v1);
    assert(p1.distanceTo(end) < 1e-4, 'flight impact position mismatch');
    for (const seam of [plan.boost, plan.boost + plan.coast]) {
      plan.at(seam - 1e-5, p0, v0);
      plan.at(seam + 1e-5, p1, v1);
      assert(p0.distanceTo(p1) < 5e-3, `flight position discontinuity at t=${seam.toFixed(2)}`);
      assert(v0.distanceTo(v1) < 5e-2, `flight velocity discontinuity at t=${seam.toFixed(2)}`);
    }
  }
}

// 4. Registered tile models: every file under models/{special,invest,public} is a ModelDef, builds and bakes in Node, and its moving
// parts tick at several times — all without a browser or a GL context (scene.ts and art.ts defer their DOM work to init/call time).
// With model names on the command line (`node scripts/check.mjs las-vegas hong-kong`, matched ignoring case, spaces and hyphens) this
// instead prints a per-level inspection report for just those models.
const { bake, drawProps, freeBaked, PK } = await import('../src/client/render/builder.ts');
const { LOT, PAD } = await import('../src/client/render/layout.ts');
const defs = {}, files = {};
for (const dir of ['special', 'invest', 'public']) {
  for (const f of walk(path.join(root, 'src/client/render/models', dir))) {
    const mod = await import(pathToFileURL(f).href);
    const def = mod.default;
    assert(def && typeof def.key === 'string' && Array.isArray(def.props), `${path.relative(root, f)}: default export must be a ModelDef`);
    assert(!(def.key in defs), `${path.relative(root, f)}: duplicate model key "${def.key}"`);
    defs[def.key] = def; files[def.key] = path.relative(root, f);
  }
}
// Coverage, the rule buildProps applies (a tile's name wins over its kind): every non-city tile resolves a model; cities share city.ts and register none.
const defOf = (t) => defs[t.name] ?? defs[t.kind];
for (const t of TILES) {
  if (t.type === 'city') assert(!defs[t.name], `city tile "${t.name}" must share the city.ts model, not register its own`);
  else assert(defOf(t), `no model for tile ${t.i} "${t.name}" (kind ${t.kind})`);
}

// Bounds (the plot's footprint relative to the props origin, PAD vs LOT in layout.ts) are reported, not asserted: a mast or a funnel may poke out on purpose.
const BX = [PAD.x - LOT.x - PAD.w / 2, PAD.x - LOT.x + PAD.w / 2], BZ = [PAD.z - LOT.z - PAD.d / 2, PAD.z - LOT.z + PAD.d / 2];
// A group drawn the way the board draws it, then baked with its named subtrees re-baked in place (see bake: the missile is kept out of the batch).
const bakeInto = (key, g) => {
  const named = new Set();
  g.traverse((o) => o.name && named.add(o.name));
  bake(g);
  named.forEach((n) => g.getObjectByName(n) instanceof THREE.Group && bake(g.getObjectByName(n))); // the board bakes kept subtrees on their own (the missile)
  named.forEach((n) => assert.ok(g.getObjectByName(n), `model "${key}": named node "${n}" was lost in bake`));
};
// A model at level lv: its props, plus the upgrades up to lv baked apart from them like the board's building group.
const buildModel = (key, def, lv) => {
  const g = new THREE.Group();
  drawProps(g, def.props, def.scale ?? PK);
  bakeInto(key, g);
  if (lv) { const h = new THREE.Group(); drawProps(h, def.levels.slice(0, lv).flat(), def.scale ?? PK); bake(h); g.add(h); }
  return g;
};
// Per-model health: baked draw calls and triangles stay in budget, nothing dips under the plot, no NaN vertices (a tick must not make any either), named nodes survive the bake.
const measure = (key, g) => {
  const movers = [];
  g.traverse((o) => o.userData.tick && movers.push(o));
  let meshes = 0, tris = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.array.length; i++) assert(Number.isFinite(pos.array[i]), `model "${key}": non-finite vertex`);
    tris += (o.geometry.index?.count ?? pos.count) / 3;
  });
  for (const t of [0, 0.37, 1.9]) movers.forEach((m) => m.userData.tick(t));
  g.updateMatrixWorld(true);
  const pos0 = [];
  g.traverse((o) => o.isMesh && pos0.push(o.geometry.attributes.position.array[0])); // re-scan after ticking
  pos0.forEach((v) => assert(Number.isFinite(v), `model "${key}": tick produced a non-finite vertex`));
  const box = new THREE.Box3().setFromObject(g);
  assert(Number.isFinite(box.min.x), `model "${key}": built nothing`);
  assert(box.min.y > -0.03, `model "${key}": dips below the plot top (min y ${box.min.y.toFixed(3)})`);
  assert(meshes <= 64, `model "${key}": ${meshes} meshes after bake (draw calls get out of hand)`);
  assert(tris <= 60_000, `model "${key}": ${Math.round(tris)} triangles`);
  return { meshes, tris, movers: movers.length, box };
};
const margins = (box) => [box.min.x - BX[0], BX[1] - box.max.x, box.min.z - BZ[0], BZ[1] - box.max.z]; // left, right, back, front clearance to the plot bounds (negative = poking out)
const overhangs = (box) => margins(box).some((m) => m < -0.03);
const fmtBox = (b) => `x[${b.min.x.toFixed(2)}, ${b.max.x.toFixed(2)}] y[${b.min.y.toFixed(2)}, ${b.max.y.toFixed(2)}] z[${b.min.z.toFixed(2)}, ${b.max.z.toFixed(2)}]`;

// ---- Single-model inspection: `node scripts/check.mjs <model...>` prints a per-level report and stops ----
const queries = process.argv.slice(2);
if (queries.length) {
  const slug = (s) => String(s).toLowerCase().replace(/[\s\-_.'’]+/g, '');
  const fail = (msg) => { console.error(msg); process.exit(1); };
  for (const q of queries) {
    const s = slug(q);
    const direct = Object.keys(defs).filter((k) => slug(k) === s || slug(path.basename(files[k], '.ts')) === s);
    let key = direct[0];
    if (direct.length > 1) fail(`"${q}" matches several models: ${direct.map((k) => files[k]).join(', ')}`);
    if (!key) { // not a model key or file: try the tile that would draw it (a city name, a kind shared by several tiles)
      const tiles = TILES.filter((t) => slug(t.name) === s || slug(t.kind) === s);
      const keys = [...new Set(tiles.map((t) => defOf(t)?.key).filter(Boolean))];
      if (keys.length === 1) key = keys[0];
      else if (keys.length > 1) fail(`"${q}" matches tiles of several models: ${keys.join(', ')}`);
      else fail(tiles.length ? `"${q}" is an ordinary city: those draw by ownership (models/city.ts), not a registered model` : `no model, file, tile name or kind matching "${q}"`);
    }
    const def = defs[key];
    console.log(`\n${files[key]} — key "${key}", scale ${def.scale ?? PK}${def.levels ? `, ${def.levels.length} upgrade level(s)` : ''}${def.owner ? ', owner()' : ''}${def.lamps?.length ? `, ${def.lamps.length} lamp(s)` : ''}`);
    for (let lv = 0; lv <= (def.levels?.length ?? 0); lv++) {
      const label = lv ? `${key} Lv ${lv}` : key, g = buildModel(label, def, lv), s = measure(label, g);
      const [lx, rx, bz, fz] = margins(s.box);
      console.log(`  Lv ${lv}  ${s.meshes} meshes/64  ${Math.round(s.tris)} tris/60000  ${s.movers} mover(s)`);
      console.log(`       box ${fmtBox(s.box)}`);
      console.log(`       margins vs plot x${JSON.stringify(BX)} z${JSON.stringify(BZ)}: left ${lx.toFixed(2)} right ${rx.toFixed(2)} back ${bz.toFixed(2)} front ${fz.toFixed(2)}${overhangs(s.box) ? ' — overhangs the plot' : ' — inside the plot'}`);
      if (lv) {
        const h = new THREE.Group(); drawProps(h, def.levels[lv - 1], def.scale ?? PK); bake(h);
        console.log(`       +levels[${lv - 1}] alone  box ${fmtBox(new THREE.Box3().setFromObject(h))}`);
        freeBaked(h);
      }
      freeBaked(g);
    }
    if (def.owner) { assert.doesNotThrow(() => { def.owner(0xe04040); def.owner(null); }, `model "${key}": owner() threw`); console.log('  owner(0xe04040)/owner(null): ok'); }
  }
  process.exit(0);
}

let modelCount = 0, moverCount = 0, ownerCount = 0;
const builds = Object.entries(defs).flatMap(([key, def]) => Array.from({ length: (def.levels?.length ?? 0) + 1 }, (_, lv) => [lv ? `${key} Lv ${lv}` : key, def, lv])); // a model with upgrades is built at every level
for (const [key, def, lv] of builds) {
  modelCount++;
  if (lv === 0 && def.owner) { assert.doesNotThrow(() => { def.owner(0xe04040); def.owner(null); }, `model "${key}": owner() threw`); ownerCount++; } // an owner's callback must light up and reset
  const g = buildModel(key, def, lv);
  const s = measure(key, g);
  moverCount += s.movers;
  if (overhangs(s.box)) console.log(`  note: "${key}" overhangs the plot footprint: x [${s.box.min.x.toFixed(2)}, ${s.box.max.x.toFixed(2)}] z [${s.box.min.z.toFixed(2)}, ${s.box.max.z.toFixed(2)}]`);
  freeBaked(g);
}

// The pieces ownership draws without a model file: the three city levels standing and mortgaged, the flag, the SALE sign, the upgrade
// plaque, and the military tile's missile (a named node kept out of the bake, mounted as military.ts mounts it).
const { building, flag, sign, level } = await import('../src/client/render/models/city.ts');
const { missile, MISSILE_NAME, MISSILE_LENGTH, MISSILE_SCALE } = await import('../src/client/render/models/missile.ts');
const aux = [
  ...[1, 2, 3].flatMap((lv) => [false, true].map((m) => [`city building Lv${lv}${m ? ' M' : ''}`, (g) => building(g, lv, 0x9db4d0, 0xe04040, m)])),
  ['owner flag', (g) => flag(g, 0xe04040)], ['sale sign', (g) => sign(g)],
  ...[1, 2, 3].flatMap((lv) => [false, true].map((m) => [`level plaque Lv${lv}${m ? ' M' : ''}`, (g) => level(g, lv, m)])),
  ['missile', (g) => { const r = new THREE.Group(); r.name = MISSILE_NAME; r.position.y = MISSILE_LENGTH * MISSILE_SCALE; r.scale.setScalar(MISSILE_SCALE); missile(r); g.add(r); }],
];
for (const [key, draw] of aux) {
  modelCount++;
  const g = new THREE.Group();
  draw(g);
  bakeInto(key, g);
  moverCount += measure(key, g).movers;
  freeBaked(g);
}

// The fixed lamps the models declare plus the scenery's (lamps.ts) must fit the slots between the tokens' and the cities' (light.ts LAMP).
const { fixedLamps } = await import('../src/client/render/lamps.ts');
const { LAMP } = await import('../src/client/render/light.ts');
const lampCount = fixedLamps(defOf).length;
assert(lampCount <= LAMP.city - LAMP.fixed, `fixed lamps overflow their slots: ${lampCount} declared, ${LAMP.city - LAMP.fixed} free`);

console.log(`check ok (${includeCount} shader chunk refs, ${TILE_COUNT} tiles, state & math verified, ${modelCount} models built+baked, ${moverCount} movers ticked, ${ownerCount} owner callbacks, ${lampCount} fixed lamps)`);
