// Opt-in model measurements, without a browser or GL context. No test assertions or full-scene sweep.
// Usage: npm run inspect -- las-vegas hong-kong
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

const queries = process.argv.slice(2);
if (!queries.length || queries.includes('--help')) {
  console.log('Usage: npm run inspect -- <model...>\nExample: npm run inspect -- las-vegas hong-kong');
  process.exit(0);
}

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

const { TILES } = await import('../src/shared/data.ts');
const { bake, drawProps, freeBaked, PK } = await import('../src/client/render/builder.ts');
const { LOT, PAD } = await import('../src/client/render/layout.ts');
const defs = {}, files = {};
for (const dir of ['special', 'invest', 'public']) {
  for (const f of walk(path.join(root, 'src/client/render/models', dir))) {
    const { default: def } = await import(pathToFileURL(f).href);
    defs[def.key] = def; files[def.key] = path.relative(root, f);
  }
}
const defOf = (t) => defs[t.name] ?? defs[t.kind];

// Bounds use the plot footprint relative to the props origin; a mast or funnel may poke out on purpose.
const BX = [PAD.x - LOT.x - PAD.w / 2, PAD.x - LOT.x + PAD.w / 2], BZ = [PAD.z - LOT.z - PAD.d / 2, PAD.z - LOT.z + PAD.d / 2];
const buildModel = (def, lv) => {
  const g = new THREE.Group();
  drawProps(g, def.props, def.scale ?? PK);
  const named = new Set();
  g.traverse((o) => o.name && named.add(o.name));
  bake(g);
  named.forEach((n) => g.getObjectByName(n) instanceof THREE.Group && bake(g.getObjectByName(n))); // the board bakes kept subtrees on their own (the missile)
  if (lv) { const h = new THREE.Group(); drawProps(h, def.levels.slice(0, lv).flat(), def.scale ?? PK); bake(h); g.add(h); }
  return g;
};
const measure = (g) => {
  let meshes = 0, tris = 0, movers = 0;
  g.traverse((o) => {
    if (o.userData.tick) movers++;
    if (!o.isMesh) return;
    meshes++;
    tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  return { meshes, tris, movers, box: new THREE.Box3().setFromObject(g) };
};
const margins = (box) => [box.min.x - BX[0], BX[1] - box.max.x, box.min.z - BZ[0], BZ[1] - box.max.z]; // left, right, back, front clearance (negative = poking out)
const fmtBox = (b) => `x[${b.min.x.toFixed(2)}, ${b.max.x.toFixed(2)}] y[${b.min.y.toFixed(2)}, ${b.max.y.toFixed(2)}] z[${b.min.z.toFixed(2)}, ${b.max.z.toFixed(2)}]`;
const slug = (s) => String(s).toLowerCase().replace(/[\s\-_.'’]+/g, '');
const fail = (msg) => { console.error(msg); process.exit(1); };

for (const q of queries) {
  const s = slug(q);
  const direct = Object.keys(defs).filter((k) => slug(k) === s || slug(path.basename(files[k], '.ts')) === s);
  let key = direct[0];
  if (direct.length > 1) fail(`"${q}" matches several models: ${direct.map((k) => files[k]).join(', ')}`);
  if (!key) { // a tile name or kind can resolve to a shared model
    const tiles = TILES.filter((t) => slug(t.name) === s || slug(t.kind) === s);
    const keys = [...new Set(tiles.map((t) => defOf(t)?.key).filter(Boolean))];
    if (keys.length === 1) key = keys[0];
    else if (keys.length > 1) fail(`"${q}" matches tiles of several models: ${keys.join(', ')}`);
    else fail(tiles.length ? `"${q}" is an ordinary city: those draw by ownership (models/city.ts), not a registered model` : `no model, file, tile name or kind matching "${q}"`);
  }
  const def = defs[key];
  console.log(`\n${files[key]} — key "${key}", scale ${def.scale ?? PK}${def.levels ? `, ${def.levels.length} upgrade level(s)` : ''}${def.owner ? ', owner()' : ''}${def.lamps?.length ? `, ${def.lamps.length} lamp(s)` : ''}`);
  for (let lv = 0; lv <= (def.levels?.length ?? 0); lv++) {
    const g = buildModel(def, lv), s = measure(g);
    const [lx, rx, bz, fz] = margins(s.box);
    console.log(`  Lv ${lv}  ${s.meshes} meshes  ${Math.round(s.tris)} tris  ${s.movers} mover(s)`);
    console.log(`       box ${fmtBox(s.box)}`);
    console.log(`       margins vs plot x${JSON.stringify(BX)} z${JSON.stringify(BZ)}: left ${lx.toFixed(2)} right ${rx.toFixed(2)} back ${bz.toFixed(2)} front ${fz.toFixed(2)}${margins(s.box).some((m) => m < -0.03) ? ' — overhangs the plot' : ' — inside the plot'}`);
    if (lv) {
      const h = new THREE.Group(); drawProps(h, def.levels[lv - 1], def.scale ?? PK); bake(h);
      console.log(`       +levels[${lv - 1}] alone  box ${fmtBox(new THREE.Box3().setFromObject(h))}`);
      freeBaked(h);
    }
    freeBaked(g);
  }
}
