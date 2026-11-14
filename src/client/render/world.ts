import * as THREE from 'three';
import { scene, toon, lodMap, pixelTexture, texels, lod, hdCam, DENSITY, BOARD_K } from './scene';
import { glassy, hd, lit, soft } from './light';
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
// to the shore. The level's texel size is the only thing that changes with zoom, so the waves stay as wide in the world and the dither as wide in pixels.
// HD-2D has no level to take it from: there a texel is the near one doubled as often as it takes to cover a screen pixel at that spot (the sea is as fine as the screen allows, and coarser
// toward the horizon), so no step of the zoom changes it all at once, and the sea is a disc that follows the camera and is wider than the lens sees, so there is no edge of it to see. ----
export const SEA_Y = -0.8; // the height of the water: HD-2D's composite (hd2d.ts) goes on from there to the horizon
const SEA = 1600, SNAP = 64, SHORE = 100, GRID = 400, DAIS = 7; // radius of the sea (the far plane of HD-2D's lens is 1200 away: scene.ts) and the lattice it follows the camera on, half the span of the shore map (units) and its resolution (half a unit a cell), radius of the centre drum
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

const U = { uShore: { value: shore }, uPal: { value: PALETTE }, uTexel: { value: 1 / DENSITY }, uTime: { value: 0 }, uGlint: { value: new THREE.Color() }, uWake: { value: WAKES }, uSplash: { value: SPLASH } };
// HD-2D's shadow on the water, `seaSh`, is read from the sun's map where the colour is made (below) rather than by `receiveShadow`, which is one switch for both looks: the restrained look would be shadowed twice, by it and by `dim`.
// The sun's highlight is cut in the shadow too, but a lamp's is not: the first directional light is the sun, or by night the moon.
const SHADE = /* glsl */`
float seaSh = 1.0;
void RE_Direct_Sea( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 spec = reflectedLight.directSpecular;
	RE_Direct_Toon( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	#if NUM_DIR_LIGHTS > 0
		if ( uHd > 0.5 && directLight.direction == directionalLights[ 0 ].direction ) reflectedLight.directSpecular = mix( spec, reflectedLight.directSpecular, seaSh );
	#endif
}
#undef RE_Direct
#define RE_Direct RE_Direct_Sea
`;
const mat = toon(0x20469a, {}, [0.22, 1, 0, 0]); // HD-2D: glossy, and no texture to take a relief from (the swell's own slopes stand in, below)
mat.onBeforeCompile = (sh) => {
  lit.call(mat, sh);
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec2 vW; uniform sampler2D uShore; uniform vec3 uPal[7], uSplash[2], uGlint; uniform vec4 uWake[${WAKES.length}]; uniform float uTexel, uTime;
      float hash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }`)
    .replace('#include <bumpmap_pars_fragment>', `${SHADE}\n#include <bumpmap_pars_fragment>`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float tx = uTexel, px = 0.; // the texel: a level's in the restrained look; HD-2D's is the near one doubled as often as the longer side of this pixel on the water (px, in world units) asks
      if (uHd > 0.5) { vec2 ax = dFdx(vW), ay = dFdy(vW); px = sqrt(max(dot(ax, ax), dot(ay, ay))); tx *= exp2(ceil(log2(max(px / tx, 1.)))); }
      vec2 c = floor(vW / tx), q = (c + 0.5) * tx;                         // this texel and its centre, in world units
      float chk = mod(c.x + c.y, 2.) - 0.5, t = uTime;                     // checker dither: -0.5 / +0.5
      if (uHd > 0.5) chk *= 1. - smoothstep(0.4, 1.2, px); // far off a texel's checker only beats against the pixels: it fades out
      float d0 = texture2D(uShore, q / ${2 * SHORE}. + 0.5).r, d = d0 + chk * 1.5 * tx; // distance to the shore, and dithered
      float warp = sin(q.x * 0.53 + t * 0.3) * 1.3 + sin(dot(q, vec2(0.31, 0.23)) - t * 0.2) * 0.9;           // the swell's crests wander, so no two chevrons repeat
      float s = sin(q.y * 1.05 + warp + t * 0.6) + 0.4 * sin(dot(q, vec2(1.9, 1.3)) + t * 0.9) + 0.4 * sin(dot(q, vec2(0.09, 0.06)) + t * 0.05) + chk * 3. * tx;
      float depth = step(-0.6, s) + step(0., s) + step(0.6, s);            // swell band, 0 (trough) .. 3 (crest)
      float shallow = step(d, 1.2) + step(d, 0.75) + step(d, 0.38);        // 0 deep .. 3 right at the shore
      vec3 sn = vec3(0., 0., 1.);                                          // HD-2D: the swell's normal, the share of the sun's glitter on it, and the sun's shadow there
      float lobe = 0.;
      if (uHd > 0.5) {                                                     // the slope of s above, by the chain rule, cut into a few steps per texel like the water itself
        float e = cos(dot(q, vec2(0.31, 0.23)) - t * 0.2);
        vec2 g = cos(q.y * 1.05 + warp + t * 0.6) * vec2(0.689 * cos(q.x * 0.53 + t * 0.3) + 0.279 * e, 1.05 + 0.207 * e)
          + 0.4 * cos(dot(q, vec2(1.9, 1.3)) + t * 0.9) * vec2(1.9, 1.3) + 0.4 * cos(dot(q, vec2(0.09, 0.06)) + t * 0.05) * vec2(0.09, 0.06);
        g = floor(g / 0.5 + 0.5) * 0.5;
        sn = normalize((viewMatrix * vec4(normalize(vec3(-0.07 * g.x, 1., -0.07 * g.y)), 0.)).xyz);
        #if NUM_DIR_LIGHTS > 0
          lobe = pow(saturate(dot(sn, normalize(directionalLights[0].direction + normalize(vViewPosition)))), 12.); // only the crests that face the half-way between the eye and the light glitter
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            seaSh = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
          #endif
        #endif
      }
      vec3 sea = uPal[int(depth + shallow)];
      float run = max(1., floor(0.14 / tx + 0.5));                        // a glint is a dash of texels along x, about as long in the world on every level
      float glint = 0.;
      if (depth > 2.5 && d0 > 0.5 && hash(vec2(floor((c.x + 9. * hash(vec2(c.y, 1.))) / run), c.y) + floor(t * 2.)) > 0.992) { glint = 1.; if (uHd < 0.5) sea = vec3(0.62, 0.8, 1.); } // glints twinkle on the crests (in HD-2D they are light, below, not paint)
      float ph = fract(t * 0.18 + 0.15 * sin(dot(q, vec2(0.21, 0.17))));   // a ripple leaves the shore every ~5.5 s, each stretch of it on its own beat,
      if (abs(d0 - 0.15 - 0.6 * ph) < 0.5 * max(0.045, tx) && hash(c + 5.) > ph) sea = vec3(0.45, 0.75, 0.9); // a texel wide and breaking up as it goes
      float fw = max(0.09, tx);                                           // the foam's width: two near texels, a whole texel on the coarser levels
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
      if (uHd > 0.5) sea = mix(sea, uPal[0], 0.65 * (1. - seaSh));        // HD-2D: a shadow on the water is a few bands deeper, not black: the sky still lights it
      diffuseColor.rgb = sea;
      if (uHd > 0.5) totalEmissiveRadiance += glint * lobe * seaSh * uGlint; // HD-2D: a glint is the light of the sun or moon itself (HDR, in its colour: see updateWorld) where a crest faces it, and none in a shadow`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uHd > 0.5) normal = sn;`);
};
// three.js names a compiled program by the text of onBeforeCompile, which says nothing of the values the shader bakes in (SHORE, the number of wakes). A hot update keeps the renderer, and so its
// programs: without these in the key, a changed value would be handed the program compiled for the old one, and the sea would be drawn at the wrong scale.
mat.customProgramCacheKey = () => `${SHORE} ${WAKES.length} ${mat.onBeforeCompile}`;
// The restrained look's sea stays this plane: the shader cuts its texels on `vW`, interpolated over the triangles, and where a pixel falls on the edge of a texel the rounding of another mesh's triangles would flip it (a row of them here and there).
const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat);
sea.rotation.x = -Math.PI / 2;
sea.position.y = SEA_Y;
const ocean = new THREE.Mesh(new THREE.CircleGeometry(SEA, 64), mat); // HD-2D's: the disc that follows its camera
ocean.rotation.x = sea.rotation.x;
ocean.position.y = SEA_Y;
mat.onBeforeRender = () => (U.uTexel.value = 2 ** (hd.on ? 0 : 2 - lod.n) / DENSITY); // a water pixel is a texel of the level in view; HD-2D starts from the near one (the shader goes on from there)
// A shadow on water is one tone darker, not black: the sea itself is lit flat, and a see-through plane just above it takes the shadow map alone. It is as dark as the light is strong, and as dark a blue as the sky is bright (see updateWorld). It is the restrained look's: HD-2D's sea has its shadow in its own shader (SHADE) and this plane is hidden there
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

// The planet by night, the emissive map of the ball (see `nightlit`) on the grid of `planet`: the lights of cities as golden pixels, sprawls of a few texels where a fine noise clears a bar, and the bar is lower where more people live.
// Where that is comes from the land grid: along the coasts, at the middle latitudes, in the patches a slow noise makes, and not on the ice, in the desert or the jungle. Every level reads the same noise at its own texels, so each has the same cities.
const CITY = [0xffe9a8, 0xffc25a, 0xff9f3a], BUILT = [0.5, 0.12, 1, 0.3, 0]; // a city's core, its edge and its fringe; how built over each of BIOME's grounds is
let people: Float32Array | undefined; // how many live in each cell of the land grid, 0..1
const populated = () => people ??= Float32Array.from(LAND, (land, c) => {
  const i = c % EW, j = Math.floor(c / EW), u = (i + 0.5) / EW, v = (j + 0.5) / EH, a = 2 * Math.PI * u, b = Math.PI * (0.5 - v), X = Math.cos(b) * Math.cos(a), Y = Math.sin(b), Z = Math.cos(b) * Math.sin(a), ss = THREE.MathUtils.smoothstep;
  const pole = Math.abs(v - 0.5) * 2, lat = pole + (fbm(X, Y, Z, 1.5) - 0.5) * 0.6; // as `planet` has them
  return land ? BUILT[BIOME.findIndex(([k]) => lat < k)] * (1 - ss(pole, 0.5, 0.78)) * (1.25 - 0.7 * ss(NEAR[c], 0.6, 0.95)) * ss(fbm(X, Y, Z, 3, 21), 0.35, 0.65) : 0;
});
const planetNight = (L: number) => canvas(texels(2 * Math.PI * BALL, L), texels(Math.PI * BALL, L), (g, w, h) => {
  const img = g.createImageData(w, h), px = new Uint32Array(img.data.buffer).fill(0xff000000), pop = populated();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, p = grid(pop, u, v);
    if (p < 0.03 || grid(LAND, u, v) <= 0.5) continue; // no one, or a texel of the sea (the same test as `planet`'s)
    const a = 2 * Math.PI * u, b = Math.PI * (0.5 - v), n = fbm(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a), 26, 33) - (0.74 - 0.1 * p); // how far over the bar this texel is
    if (n > 0.05) px[y * w + x] = rgba(CITY[0]);
    else if (n > 0) px[y * w + x] = rgba(CITY[1]);
    else if (n > -0.025) px[y * w + x] = rgba(CITY[2]);
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
const wrapped = (draw: (L: number) => HTMLCanvasElement) => (L: number) => {
  const map = pixelTexture(draw(L));
  map.wrapS = THREE.RepeatWrapping;
  return map;
};
// The planet's own light, which only HD-2D has (both terms are 0 in the restrained look): its cities' lamps, which light on the side the sun is not, and a rim of atmosphere, a blue that thickens toward the limb, brightest on the sun's side.
// The ball is no lamp's to light the whole of (its fill stands low in front, see lamps.ts): the rim is what lights the rest of its edge.
const GLOBE = /* glsl */`
vec3 gn = inverseTransformDirection( normal, viewMatrix );
float gs = dot( gn, uSunW );
totalEmissiveRadiance *= uHd * smoothstep( 0.35, - 0.15, gs ) * 1.4;
totalEmissiveRadiance += uHd * vec3( 0.42, 0.68, 1.0 ) * ( pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 ) * ( 0.25 + 0.75 * smoothstep( - 0.3, 0.5, gs ) ) );
#include <lights_toon_fragment>`;
const globeMat = glassy(lodMap(lodMap(toon(0xffffff, { emissive: 0xffffff }), wrapped(planet)), wrapped(planetNight), 'emissiveMap'), 0); // its seas are blue texels but water, not glass: they would throw the sun back as a hard dot
globeMat.onBeforeCompile = (sh) => {
  lit.call(globeMat, sh);
  sh.uniforms.uSunW = { value: sky.sun };
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunW;').replace('#include <lights_toon_fragment>', GLOBE); // after `lit` has put the night's emissive in: that is all there is to scale
};
const globe = new THREE.Group(), ball = new THREE.Mesh(new THREE.SphereGeometry(BALL, 48, 32), globeMat);
{
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(DAIS, DAIS, SLAB, 64), [stone(DAIS, SLAB), glassy(lodMap(toon(0xffffff), (L) => pixelTexture(dial(L))), 0), toon(0x6a7898)]);
  dais.position.y = TOP - SLAB / 2;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(PLINTH, PLINTH + 0.3, PLINTH_H, 48), [stone(PLINTH, PLINTH_H), toon(0x9ea9c6), toon(0x6a7898)]);
  plinth.position.y = TOP + PLINTH_H / 2;
  ball.position.y = FLOAT;
  ball.castShadow = plinth.castShadow = true;
  dais.receiveShadow = plinth.receiveShadow = true;
  globe.add(dais, plinth, ball);
}

export const initWorld = () => scene.add(sea, ocean, dim, globe, scenery);

export function updateWorld(t: number, dt: number) {
  U.uTime.value = Math.floor(t * 4) / 4; // the sea moves in quarter-second steps
  U.uGlint.value.copy(sky.lightC).multiplyScalar(2.4 * sky.lightK); // HD-2D's glint: HDR light, in the colour of the sun's or the moon's
  sea.visible = dim.visible = !hd.on; ocean.visible = hd.on;
  dim.material.opacity = 0.34 * sky.lightK; dim.material.color.copy(DIM).multiplyScalar(sky.skyK);
  ocean.position.x = Math.round(hdCam.position.x / SNAP) * SNAP; // HD-2D's sea follows the camera, a lattice step at a time (the shader anchors the texels to the world, so the water does not swim)
  ocean.position.z = Math.round(hdCam.position.z / SNAP) * SNAP;
  updateScenery(t, dt);
  ball.rotation.y += dt * 0.35;
  ball.position.y = FLOAT + Math.sin(t * 1.2) * 0.4;
}
