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
  players: PLAYER_DEFS.slice(0, 2).map((p) => ({ ...p, cash: START_CASH, tile: 0, jail: false, party: false, stay: false, out: 0 })),
};
apply(S, { t: 'cash', pi: 0, d: -500 });
apply(S, { t: 'own', i: 1, o: { p: 0, lv: 1, m: false } });
assert.equal(S.players[0].cash, START_CASH - 500);
assert.equal(stats(S, 0).city, 1);
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

console.log(`check ok (${includeCount} shader chunk refs, ${TILE_COUNT} tiles, state & math verified)`);
