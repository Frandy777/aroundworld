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
const { bake, drawProps, freeBaked, PK } = await import('../src/client/render/builder.ts');
const { LOT, PAD } = await import('../src/client/render/layout.ts');
const defs = {};
for (const dir of ['special', 'invest', 'public']) {
  for (const f of walk(path.join(root, 'src/client/render/models', dir))) {
    const mod = await import(pathToFileURL(f).href);
    const def = mod.default;
    assert(def && typeof def.key === 'string' && Array.isArray(def.props), `${path.relative(root, f)}: default export must be a ModelDef`);
    assert(!(def.key in defs), `${path.relative(root, f)}: duplicate model key "${def.key}"`);
    defs[def.key] = def;
  }
}
// Coverage, the rule buildProps applies (a tile's name wins over its kind): every non-city tile resolves a model; cities share city.ts and register none.
for (const t of TILES) {
  if (t.type === 'city') assert(!defs[t.name], `city tile "${t.name}" must share the city.ts model, not register its own`);
  else assert(defs[t.name] ?? defs[t.kind], `no model for tile ${t.i} "${t.name}" (kind ${t.kind})`);
}

// Per-model health: baked draw calls and triangles stay in budget, nothing dips under the plot, no NaN vertices, named nodes survive the bake.
// Bounds (the plot's footprint relative to the props origin, PAD vs LOT in layout.ts) are reported, not asserted: a mast or a funnel may poke out on purpose.
const BX = [PAD.x - LOT.x - PAD.w / 2, PAD.x - LOT.x + PAD.w / 2], BZ = [PAD.z - LOT.z - PAD.d / 2, PAD.z - LOT.z + PAD.d / 2];
let modelCount = 0, moverCount = 0;
const builds = Object.entries(defs).flatMap(([key, def]) => Array.from({ length: (def.levels?.length ?? 0) + 1 }, (_, lv) => [lv ? `${key} Lv ${lv}` : key, def, lv])); // a model with upgrades is built at every level
for (const [key, def, lv] of builds) {
  modelCount++;
  const g = new THREE.Group();
  drawProps(g, def.props, def.scale ?? PK);
  const named = new Set();
  g.traverse((o) => o.name && named.add(o.name));
  bake(g);
  named.forEach((n) => g.getObjectByName(n) instanceof THREE.Group && bake(g.getObjectByName(n))); // the board bakes kept subtrees on their own (the missile)
  named.forEach((n) => assert.ok(g.getObjectByName(n), `model "${key}": named node "${n}" was lost in bake`));
  if (lv) { const h = new THREE.Group(); drawProps(h, def.levels.slice(0, lv).flat(), def.scale ?? PK); bake(h); g.add(h); } // the upgrades up to this level, baked apart from the props like the board's building group
  const movers = [];
  g.traverse((o) => o.userData.tick && movers.push(o));
  moverCount += movers.length;
  let meshes = 0, tris = 0;
  const scan = () => g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.array.length; i++) assert(Number.isFinite(pos.array[i]), `model "${key}": non-finite vertex`);
    tris += (o.geometry.index?.count ?? pos.count) / 3;
  });
  scan();
  for (const t of [0, 0.37, 1.9]) movers.forEach((m) => m.userData.tick(t));
  g.updateMatrixWorld(true);
  const pos0 = [];
  g.traverse((o) => o.isMesh && pos0.push(o.geometry.attributes.position.array[0])); // re-scan after ticking: a tick must not produce NaN either
  pos0.forEach((v) => assert(Number.isFinite(v), `model "${key}": tick produced a non-finite vertex`));
  const box = new THREE.Box3().setFromObject(g);
  assert(Number.isFinite(box.min.x), `model "${key}": built nothing`);
  assert(box.min.y > -0.03, `model "${key}": dips below the plot top (min y ${box.min.y.toFixed(3)})`);
  assert(meshes <= 64, `model "${key}": ${meshes} meshes after bake (draw calls get out of hand)`);
  assert(tris <= 60_000, `model "${key}": ${Math.round(tris)} triangles`);
  if (box.min.x < BX[0] - 0.03 || box.max.x > BX[1] + 0.03 || box.min.z < BZ[0] - 0.03 || box.max.z > BZ[1] + 0.03)
    console.log(`  note: "${key}" overhangs the plot footprint: x [${box.min.x.toFixed(2)}, ${box.max.x.toFixed(2)}] z [${box.min.z.toFixed(2)}, ${box.max.z.toFixed(2)}]`);
  freeBaked(g);
}

console.log(`check ok (${includeCount} shader chunk refs, ${TILE_COUNT} tiles, state & math verified, ${modelCount} models built+baked, ${moverCount} movers ticked)`);
