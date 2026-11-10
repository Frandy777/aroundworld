import * as THREE from 'three';
import { scene, toon, lodMap, pixelTexture, texels, lod, DENSITY, BOARD_K } from './scene';
import { lit, soft } from './light';
import { sky } from './sky';
import { canvas } from './art';
import { EARTH } from './earth';
import { FOOT, TOP, SLAB, SZ } from './layout';
import { sideTex } from './builder';
import { ISLETS, WAKES, SPLASH, scenery, updateScenery } from './scenery';

const rng = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const smooth = (t: number) => t * t * (3 - 2 * t);

// ---- Sea: one shader, no texture. The world is cut into the texels of the current zoom level and each is painted from a slow swell (four bands of navy, a
// checker dithering the seams); near a slab or the centre drum the bands run on into lighter, shallower blues and a line of foam, read off a map of the distance
// to the shore. The level's texel size is the only thing that changes with zoom, so the waves stay as wide in the world and the dither as wide in pixels. ----
const SEA = 500, SHORE = 100, GRID = 400, DAIS = 7; // sea size, half the span of the shore map (units) and its resolution (half a unit a cell), radius of the centre drum
const PALETTE = ['#1b3f8e', '#20469a', '#264ea6', '#2c57b2', '#3170c0', '#3a92d0', '#5ec2dc'].map((c) => new THREE.Color(c));

// Signed distance (units, negative inside) to the nearest slab (a rectangle), islet or the centre drum (a circle), kept within -2..8; a coarse grid is enough, a
// distance is linear along a straight shore
const dist = new Uint16Array(GRID * GRID);
for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
  const x = ((i + 0.5) / GRID * 2 - 1) * SHORE, z = ((j + 0.5) / GRID * 2 - 1) * SHORE;
  let d = Math.min(8, Math.hypot(x, z) - DAIS);
  for (const [cx, cz, r] of ISLETS) d = Math.min(d, Math.hypot(x - cx, z - cz) - r);
  for (const [cx, cz, hx, hz] of FOOT) {
    const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
    if (dx < 8 && dz < 8) d = Math.min(d, Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0));
  }
  dist[j * GRID + i] = THREE.DataUtils.toHalfFloat(Math.max(d, -2));
}
const shore = new THREE.DataTexture(dist, GRID, GRID, THREE.RedFormat, THREE.HalfFloatType);
shore.minFilter = shore.magFilter = THREE.LinearFilter;
shore.needsUpdate = true;

const U = { uShore: { value: shore }, uPal: { value: PALETTE }, uTexel: { value: 1 / DENSITY }, uTime: { value: 0 }, uGlint: { value: 1 }, uWake: { value: WAKES }, uSplash: { value: SPLASH } };
const mat = toon(0x20469a, {}, [0.22, 1, 0, 0]); // HD-2D: glossy, and no texture to take a relief from (the swell's own slopes stand in, below)
mat.onBeforeCompile = (sh) => {
  lit.call(mat, sh);
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec2 vW; uniform sampler2D uShore; uniform vec3 uPal[7], uSplash[2]; uniform vec4 uWake[${WAKES.length}]; uniform float uTexel, uTime, uGlint;
      float hash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 c = floor(vW / uTexel), q = (c + 0.5) * uTexel;                 // this texel and its centre, in world units
      float chk = mod(c.x + c.y, 2.) - 0.5, t = uTime;                     // checker dither: -0.5 / +0.5
      float d0 = texture2D(uShore, q / ${2 * SHORE}. + 0.5).r, d = d0 + chk * 1.5 * uTexel; // distance to the shore, and dithered
      float warp = sin(q.x * 0.53 + t * 0.3) * 1.3 + sin(dot(q, vec2(0.31, 0.23)) - t * 0.2) * 0.9;           // the swell's crests wander, so no two chevrons repeat
      float s = sin(q.y * 1.05 + warp + t * 0.6) + 0.4 * sin(dot(q, vec2(1.9, 1.3)) + t * 0.9) + 0.4 * sin(dot(q, vec2(0.09, 0.06)) + t * 0.05) + chk * 3. * uTexel;
      float depth = step(-0.6, s) + step(0., s) + step(0.6, s);            // swell band, 0 (trough) .. 3 (crest)
      float shallow = step(d, 1.2) + step(d, 0.75) + step(d, 0.38);        // 0 deep .. 3 right at the shore
      vec3 sea = uPal[int(depth + shallow)];
      float run = max(1., floor(0.14 / uTexel + 0.5));                    // a glint is a dash of texels along x, about as long in the world on every level
      float glint = 0.;
      if (depth > 2.5 && d0 > 0.5 && hash(vec2(floor((c.x + 9. * hash(vec2(c.y, 1.))) / run), c.y) + floor(t * 2.)) > 0.992) { sea = vec3(0.62, 0.8, 1.); glint = 1.; } // glints twinkle on the crests
      float ph = fract(t * 0.18 + 0.15 * sin(dot(q, vec2(0.21, 0.17))));   // a ripple leaves the shore every ~5.5 s, each stretch of it on its own beat,
      if (abs(d0 - 0.15 - 0.6 * ph) < 0.5 * max(0.045, uTexel) && hash(c + 5.) > ph) sea = vec3(0.45, 0.75, 0.9); // a texel wide and breaking up as it goes
      float fw = max(0.09, uTexel);                                       // the foam's width: two near texels, a whole texel on the coarser levels
      if (d0 < fw) sea = vec3(0.9, 0.97, 1.);                              // the line of foam
      for (int i = 0; i < ${WAKES.length}; i++) {                             // a ship's wake: from its stern, two arms spreading and a churn between them, breaking up as they go
        vec2 wr = q - uWake[i].xy, wf = uWake[i].zw;
        float wa = -dot(wr, wf), ws = abs(wf.x * wr.y - wf.y * wr.x);      // how far behind it, and how far to the side of its track
        if (wa > 0. && wa < 5. && (abs(ws - 0.15 - 0.3 * wa) < 0.5 * fw || (wa < 1.2 && ws < 0.3)) && hash(c + float(i)) > wa / 5.) sea = vec3(0.9, 0.97, 1.);
      }
      for (int i = 0; i < 2; i++) {                                        // a ring spreads from where the dolphin broke the surface (z: how far it has spread, 0 .. 1)
        float k = uSplash[i].z;
        if (k >= 0. && k <= 1. && abs(length(q - uSplash[i].xy) - 0.25 - 1.6 * k) < 0.5 * fw && hash(c + 7.) > k) sea = vec3(0.9, 0.97, 1.);
      }
      diffuseColor.rgb = sea;
      totalEmissiveRadiance += glint * uHd * uGlint * vec3(1.6, 2., 2.2);  // HD-2D: the sun or moon lights a glint, so its HDR light follows the hour`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uHd > 0.5) {                                                    // HD-2D: the normal of the swell (the slope of s above, by the chain rule), for the highlights and the sky in the water
        float e = cos(dot(q, vec2(0.31, 0.23)) - t * 0.2);
        vec2 g = cos(q.y * 1.05 + warp + t * 0.6) * vec2(0.689 * cos(q.x * 0.53 + t * 0.3) + 0.279 * e, 1.05 + 0.207 * e)
          + 0.4 * cos(dot(q, vec2(1.9, 1.3)) + t * 0.9) * vec2(1.9, 1.3) + 0.4 * cos(dot(q, vec2(0.09, 0.06)) + t * 0.05) * vec2(0.09, 0.06);
        normal = normalize((viewMatrix * vec4(normalize(vec3(-0.07 * g.x, 1., -0.07 * g.y)), 0.)).xyz);
      }`);
};
// three.js names a compiled program by the text of onBeforeCompile, which says nothing of the values the shader bakes in (SHORE, the number of wakes). A hot update keeps the renderer, and so its
// programs: without these in the key, a changed value would be handed the program compiled for the old one, and the sea would be drawn at the wrong scale.
mat.customProgramCacheKey = () => `${SHORE} ${WAKES.length} ${mat.onBeforeCompile}`;
const sea = new THREE.Mesh(new THREE.PlaneGeometry(SEA, SEA), mat);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -0.8;
mat.onBeforeRender = () => (U.uTexel.value = 2 ** (2 - lod.n) / DENSITY); // a water pixel is a texel of the level in view
// A shadow on water is one tone darker, not black: the sea itself is lit flat, and a see-through plane just above it takes the shadow map alone. It is as dark as the light is strong, and as dark a blue as the sky is bright (see updateWorld)
const DIM = new THREE.Color(0x0a1a5c);
const dim = new THREE.Mesh(sea.geometry, soft(new THREE.ShadowMaterial({ color: DIM, opacity: 0.34 })));
dim.rotation.x = sea.rotation.x;
dim.position.y = sea.position.y + 0.01;
dim.receiveShadow = true;

// ---- Centre: a round stone drum standing in the sea like the slabs (same height, same courses), a compass dial inlaid in its top, a plinth, and the globe
// floating over it: the Earth in pixel art (real continents, see earth.js) on a banded-lit sphere, one texel per world pixel at the equator. Decoration must never
// cover a tile. The globe floats over the empty middle of the loop, and from the camera a ball that high projects onto the row of tiles behind it, so it is
// kept small enough to stay clear of that row at any tilt down to 45 degrees (the default is 52). ----
const PLINTH = 3.6, PLINTH_H = 0.45, BALL = 2.8 * BOARD_K; // radii and height (units) of the plinth and of the ball
export const FLOAT = 8; // the height of the ball's centre
const LATTICE = Array.from({ length: 1024 }, rng(3));
const vnoise = (x: number, y: number, z: number) => { // 3D lattice noise, read on the ball itself: no seam, and no pinching at the poles
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = smooth(x - i), fy = smooth(y - j), fz = smooth(z - k);
  const at = (a: number, b: number, c: number) => LATTICE[Math.imul(Math.imul(Math.imul(a, 374761393) + b, 668265263) + c, 1274126177) >>> 22];
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  const slice = (c: number) => lerp(lerp(at(i, j, c), at(i + 1, j, c), fx), lerp(at(i, j + 1, c), at(i + 1, j + 1, c), fx), fy);
  return lerp(slice(k), slice(k + 1), fz);
};
const fbm = (x: number, y: number, z: number, f: number, o = 0) => 0.65 * vnoise(x * f + o, y * f, z * f) + 0.35 * vnoise(x * 2 * f + o, y * 2 * f, z * 2 * f); // two octaves; o picks another noise
const rgba = (c: number) => 0xff000000 | ((c & 255) << 16) | (c & 0xff00) | (c >> 16); // 0xRRGGBB -> RGBA bytes (little-endian)
const { w: EW, h: EH, land: LAND } = EARTH; // the land grid: wraps round in longitude, ends at the poles
const cell = (a: ArrayLike<number>, i: number, j: number) => a[Math.min(Math.max(j, 0), EH - 1) * EW + (((i % EW) + EW) % EW)];
const grid = (a: ArrayLike<number>, u: number, v: number) => { // a at (u, v), 0..1 across the map, read smoothly between its cells
  const x = u * EW - 0.5, y = v * EH - 0.5, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const row = (b: number) => cell(a, i, b) + (cell(a, i + 1, b) - cell(a, i, b)) * fx;
  return row(j) + (row(j + 1) - row(j)) * fy;
};
const blur = (a: Float32Array) => { // the 3 x 3 mean as two passes of a 3-wide window: along each row (round in longitude), then down the columns (the end rows repeat at the poles)
  const s = new Float64Array(a.length), o = new Float32Array(a.length); // row sums in doubles, so the mean is rounded once, as when the nine cells were added together
  for (let r = 0; r < a.length; r += EW) {
    let p = a[r + EW - 1], c = a[r];
    for (let i = 0; i < EW; i++) { const n = a[r + ((i + 1) % EW)]; s[r + i] = p + c + n; p = c; c = n; }
  }
  for (let j = 0; j < EH; j++) {
    const u = Math.max(j - 1, 0) * EW, m = j * EW, d = Math.min(j + 1, EH - 1) * EW;
    for (let i = 0; i < EW; i++) o[m + i] = (s[u + i] + s[m + i] + s[d + i]) / 9;
  }
  return o;
};
let NEAR = Float32Array.from(LAND); // how near land is: 0 in open sea, 0.5 on a straight coast, 1 well inland. It gives the shallows off every coast and the sand along it
for (let k = 0; k < 5; k++) NEAR = blur(NEAR);
const BIOME = [[0.17, 0x2f9a56, 0x58c46e], [0.33, 0xe8c070, 0xc89a4a], [0.55, 0x58c46e, 0x2f9a56], [0.7, 0x2f7a52, 0x8d9a58], [2, 0xf4f8ff, 0xd8d4c4]]; // by latitude (0 equator, 1 pole): [up to, ground, patches] = rainforest, desert, grass, taiga, snow
const planet = (L: number) => canvas(texels(2 * Math.PI * BALL, L), texels(Math.PI * BALL, L), (g, w, h) => { // pole to pole = half the equator (2 pi R) in texels
  const img = g.createImageData(w, h), px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, t = ((x + y) & 1 ? 1 : -1) / w; // t: a checker that shrinks with the size, so a dithered seam stays ~2 texels wide
    const a = 2 * Math.PI * u, b = Math.PI * (0.5 - v), X = Math.cos(b) * Math.cos(a), Y = Math.sin(b), Z = Math.cos(b) * Math.sin(a); // where this texel sits on the ball
    const n = fbm(X, Y, Z, 1.5), p = fbm(X, Y, Z, 5, 9), pole = Math.abs(v - 0.5) * 2, lat = pole + (n - 0.5) * 0.6, near = grid(NEAR, u, v) + (p - 0.5) * 0.8 + 25 * t;
    let c;
    if (pole + (n - 0.5) * 0.3 > 0.82) c = 0xf4f8ff; // the polar caps, over land and sea alike (no land detail is kept where the map is squeezed to a point)
    else if (grid(LAND, u, v) > 0.5) { // land: sand along the shore, else the ground of its latitude with patches of the next
      const [, ground, patch] = BIOME.find(([k]) => lat + 4 * t < k)!;
      c = near < 0.55 && lat < 0.7 ? 0xe8d28c : p + 3 * t > 0.55 ? patch : ground;
    } else c = near > 0.3 ? 0x3a82e6 : near > 0.12 ? 0x2260cc : 0x1a4cb4; // sea: shallows off the coast, a few lighter patches in the open
    px[y * w + x] = rgba(c);
  }
  g.putImageData(img, 0, 0);
});

// The dial on the drum's top, seen from above: a rim, a ring of 32 alternating blocks, a gold line, and a compass rose (long rays N, E, S, W, short ones between)
const DIAL = [0x95a0be, 0xaeb8d0, 0xcdd5e8, 0xdcae3e, 0x6f7a9a]; // field, block, rim, gold, shade
const dial = (L: number) => canvas(texels(2 * DAIS, L), texels(2 * DAIS, L), (g, n) => {
  const img = g.createImageData(n, n), px = new Uint32Array(img.data.buffer), h = n / 2, t = 1 / h; // t: a texel, in radii
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let c = DIAL[0];
    if (r > 1 - 2 * t) c = DIAL[2];
    else if (r > 1 - 3 * t) c = DIAL[4];
    else if (r > 0.9) c = DIAL[Math.floor((a * 16) / Math.PI) & 1];
    else if (r > 0.9 - t) c = DIAL[3];
    else for (let k = 0; k < 8; k++) { // rays: a thin wedge along each direction, tapering to the tip
      const f = (k * Math.PI) / 4, s = dx * Math.cos(f) + dy * Math.sin(f), p = Math.abs(dy * Math.cos(f) - dx * Math.sin(f)), len = k & 1 ? 0.7 : 0.86;
      if (s > 0.1 && s < len && p < t * 0.75 + (0.045 - t * 0.5) * (1 - s / len) * (k & 1 ? 0.6 : 1)) c = k & 1 ? DIAL[4] : DIAL[3];
    }
    px[y * n + x] = rgba(c);
  }
  g.putImageData(img, 0, 0);
});

const stone = (R: number, h: number) => lodMap(toon(0xc4cee8), (L) => { // the slabs' courses round a drum of radius R and height h: a whole number of repeats, each about half a tile wide, the top of the wall
  const t = sideTex(L).clone();
  t.repeat.set(Math.round((2 * Math.PI * R) / (SZ / 2)), h / SLAB);
  t.offset.y = 1 - h / SLAB;
  t.needsUpdate = true;
  return t;
});
const globe = new THREE.Group(), ball = new THREE.Mesh(new THREE.SphereGeometry(BALL, 48, 32), lodMap(toon(0xffffff), (L) => {
  const map = pixelTexture(planet(L));
  map.wrapS = THREE.RepeatWrapping;
  return map;
}));
{
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(DAIS, DAIS, SLAB, 64), [stone(DAIS, SLAB), lodMap(toon(0xffffff), (L) => pixelTexture(dial(L))), toon(0x6a7898)]);
  dais.position.y = TOP - SLAB / 2;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(PLINTH, PLINTH + 0.3, PLINTH_H, 48), [stone(PLINTH, PLINTH_H), toon(0x9ea9c6), toon(0x6a7898)]);
  plinth.position.y = TOP + PLINTH_H / 2;
  ball.position.y = FLOAT;
  ball.castShadow = plinth.castShadow = true;
  dais.receiveShadow = plinth.receiveShadow = true;
  globe.add(dais, plinth, ball);
}

export const initWorld = () => scene.add(sea, dim, globe, scenery);

export function updateWorld(t: number, dt: number) {
  U.uTime.value = Math.floor(t * 4) / 4; // the sea moves in quarter-second steps
  U.uGlint.value = sky.lightK;
  dim.material.opacity = 0.34 * sky.lightK; dim.material.color.copy(DIM).multiplyScalar(sky.skyK);
  updateScenery(t, dt);
  ball.rotation.y += dt * 0.35;
  ball.position.y = FLOAT + Math.sin(t * 1.2) * 0.4;
}
