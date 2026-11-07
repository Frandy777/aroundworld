import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Board scale: a tile cell is 3 * BOARD_K world units. Buildings, props, tokens and text keep their size; only the tile (and with it the camera
// limits, zoom range, sun and the centre globe) grows.
export const BOARD_K = 2;

// One pixel size for the whole world at each zoom level, in texels per world unit. The tile ground (128 texels across a tile) is the reference for the
// near level; walls, water, globe and the info cards are all sized from it, so no texel in the scene is bigger or finer than another. A cell is 132 texels:
// the tile plus a 4-texel gap (a far texel, two mid ones), so at every level the tile edges, the shadow texels and the water pixels sit on one lattice.
export const DENSITY = 132 / (3 * BOARD_K);

// ---- Zoom levels: the world is redrawn for the zoom it is seen at, never just rescaled ----
// A texel is only crisp while it covers a screen pixel or more; squeezed below that it turns to mush, and text and windows go first. So every texture is
// drawn three times, each a design on its own pixel grid with its own amount of detail: level 0 (far) at 1/4 of DENSITY, level 1 (mid) at 1/2 and
// level 2 (near) at DENSITY. The grid that puts a texel just over a screen pixel at the current zoom is shown (`lod.n`) and every `lodMap` swaps to it.
export const lod = { n: -1 }; // -1 until the first frame has worked the level out from the zoom
export const texels = (units: number, L = 2) => Math.round((units * DENSITY) / 2 ** (2 - L));
const swaps: ((L: number) => void)[] = [];
export const onLod = (fn: (L: number) => void) => { swaps.push(fn); if (lod.n >= 0) fn(lod.n); }; // fn(level) on every change of level, and now if it is known
// The levels out of view can wait: they are made in the idle time, a few ms at a time (Safari has no requestIdleCallback: a timer stands in)
const later: (() => void)[] = [];
const idle = (f: (d?: IdleDeadline) => void) => ('requestIdleCallback' in window ? requestIdleCallback(f) : setTimeout(f, 16));
function drain(d?: IdleDeadline) {
  for (const end = performance.now() + (d?.timeRemaining() ?? 8); later.length && performance.now() < end;) later.shift()!();
  if (later.length) idle(drain);
}
// A material whose map has one drawing per level: make(level) -> texture. The level in view is made and uploaded when it is first shown, the other two when the page is idle,
// so a level switch is a pointer swap by the time anyone zooms; one that comes sooner makes its level on the spot.
export const lodMap = <M extends THREE.Material & { map: THREE.Texture | null }>(mat: M, make: (L: number) => THREE.Texture): M => {
  const maps: THREE.Texture[] = [];
  const get = (L: number) => { if (!maps[L]) renderer.initTexture((maps[L] = make(L))); return maps[L]; };
  onLod((L) => (mat.map = get(L)));
  if (!later.length) idle(drain);
  for (const L of [0, 1, 2]) later.push(() => get(L));
  return mat;
};

// ---- Pixel pipeline: the scene renders at 1/PX of the window size and CSS upscales it with nearest-neighbour, so an art pixel is PX = 2 CSS px at every zoom: the
// same grid as the UI frames. A buffer pixel bigger than a texel would average texels away, so a level is shown once its texels are a whole buffer pixel tall ----
const PX = 2;
const VIEW_H = 50; // world units on screen vertically at zoom 1
const STEP = [PX / 2, PX]; // CSS px height of a near texel (a mid one is 2x that, a far one 4x) where the level goes far -> mid -> near
const texelPx = () => (innerHeight * camera.zoom * Math.sin(ELEV)) / (VIEW_H * DENSITY);
// Up as soon as a threshold is reached, down only 8% below it, so a zoom resting on a threshold doesn't flicker between two designs.
const levelNow = () => {
  const t = texelPx();
  let L = 0;
  while (L < STEP.length && t >= STEP[L] * (L < lod.n ? 0.92 : 1)) L++;
  return L;
};

export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl') as HTMLCanvasElement, antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, stair-stepped shadows

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14213d);

// Banded (toon) shading: seven flat steps per light, like a 16-bit palette ramp. Seven, because a face square to the light (its dot product is exactly 0.5)
// must land in the middle of a step, not on the seam between two.
const GRAD = new THREE.DataTexture(new Uint8Array([66, 90, 118, 150, 188, 224, 255]), 7, 1, THREE.RedFormat);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
GRAD.needsUpdate = true;
export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...extra });

// Crisp texels at every zoom: magnified ones stay square, shrunk ones snap to the nearest mip level and texel (blending them smeared the pixel art).
export const pixelTexture = (src: HTMLCanvasElement, repeat?: number) => {
  const t = new THREE.CanvasTexture(src);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
};

// ---- Camera & controls ----
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
const ELEV = THREE.MathUtils.degToRad(52);
camera.position.set(0, Math.sin(ELEV) * 150, Math.cos(ELEV) * 150);

export const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false,
  minZoom: 0.8 / BOARD_K, maxZoom: 6, minPolarAngle: THREE.MathUtils.degToRad(22), maxPolarAngle: THREE.MathUtils.degToRad(68),
});
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

// ---- Ink pass: draw to a colour+depth target, then work on the depth alone. The view is orthographic, so depth is linear and a flat face is a plane in it:
// - a pixel right behind a nearer one is the silhouette: inked in a dark shade of the nearer colour (outlines);
// - on a flat face the depth around a pixel averages to its own; where two faces meet it does not. A pixel that is nearer than its surroundings sits on a
//   convex edge (a roof ridge, the top of a wall) and is lit; one that is farther sits in a concave corner (where a wall meets the ground) and is darkened.
//   `unit` (world units per pixel) turns the depth difference into a number of pixels, so the same line is drawn at every zoom. ----
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
const texel = new THREE.Vector2(), unit = { value: 0.07 };
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tc: { value: rt.texture }, td: { value: rt.depthTexture }, texel: { value: texel }, unit, span: { value: camera.far - camera.near } },
  vertexShader: 'varying vec2 v; void main() { v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tc, td; uniform vec2 texel; uniform float unit, span; varying vec2 v;
    void main() {
      vec2 n[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));
      vec3 c = texture2D(tc, v).rgb;
      float z = texture2D(td, v).x * span, top = 0.72, sum = 0.; // 0.72 world units of depth make a silhouette
      bool rim = false; // on a silhouette (just behind a nearer pixel, or just in front of a farther one) the depth step is no crease
      for (int i = 0; i < 4; i++) {
        vec2 u = v + n[i] * texel;
        float d = texture2D(td, u).x * span - z; // > 0: the neighbour is farther
        sum += d;
        if (-d > top) { top = -d; c = texture2D(tc, u).rgb * 0.07 + vec3(0.003, 0.006, 0.02); }
        rim = rim || abs(d) > 0.72;
      }
      float k = rim ? 0. : sum / unit; // the kink in pixels of depth: ~2 for a wall against the ground or a roof ridge, 0 on a flat face
      gl_FragColor = vec4(k > 0.9 ? c * 1.32 + 0.035 : k < -0.9 ? c * 0.62 : c, 1.);
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
}));
const postScene = new THREE.Scene().add(post), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// The view moves in whole pixels: for the draw the camera is held on the lattice of buffer pixels, so a texel keeps its place within its screen pixel as you
// pan and the picture never shimmers. (Pixel centres fall between lattice lines, never on them, so a texel edge never lands on a pixel centre.) Picking and
// the screen-space labels use the true camera, which is put back right after.
const snapped = new THREE.Vector3();
function snap() {
  camera.updateMatrixWorld();
  const m = camera.matrixWorld.elements, p = camera.position, u = VIEW_H / (camera.zoom * rt.height); // u: world units per buffer pixel
  const a = p.x * m[0] + p.y * m[1] + p.z * m[2], b = p.x * m[4] + p.y * m[5] + p.z * m[6]; // the position along the camera's right and up axes
  const ox = (rt.width & 1) / 2, oy = (rt.height & 1) / 2; // with an odd number of pixels the centre pixel is centred on the camera: offset half a pixel
  const da = (Math.round(a / u - ox + 1e-6) + ox) * u - a, db = (Math.round(b / u - oy + 1e-6) + oy) * u - b; // + 1e-6 settles the tie of a camera dead on the view axis (the title orbit, odd buffer): float noise would flip the rounding, and the picture a pixel, every frame
  camera.position.add(snapped.set(m[0] * da + m[4] * db, m[1] * da + m[5] * db, m[2] * da + m[6] * db));
  camera.updateMatrixWorld();
  unit.value = u;
}
export function render() {
  snap();
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  camera.position.sub(snapped);
  camera.updateMatrixWorld();
}

function resize() {
  renderer.setPixelRatio(1 / PX);
  renderer.setSize(innerWidth, innerHeight);
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  rt.setSize(buf.x, buf.y);
  texel.set(1 / buf.x, 1 / buf.y);
  const a = buf.x / buf.y, h = VIEW_H; // the buffer's aspect, not the window's (it is rounded down): a world unit is then as many pixels across as down, which the pixel-exact lettering relies on
  Object.assign(camera, { left: -h * a / 2, right: h * a / 2, top: h / 2, bottom: -h / 2 });
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// Smooth "go look at X" camera goal; any user drag/zoom cancels it.
let goal: { x: number; z: number; zoom?: number } | null = null;
controls.addEventListener('start', () => (goal = null));
export const focus = (x: number, z: number, zoom?: number) => (goal = { x, z, zoom: zoom ?? goal?.zoom });

export function updateCamera(dt: number) {
  const t = controls.target;
  const cx = THREE.MathUtils.clamp(t.x, -45 * BOARD_K, 45 * BOARD_K), cz = THREE.MathUtils.clamp(t.z, -30 * BOARD_K, 30 * BOARD_K); // keep the board in reach
  if (cx !== t.x || cz !== t.z) { camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.set(cx, t.y, cz); }
  if (goal) {
    const k = 1 - Math.pow(0.003, dt), dx = (goal.x - t.x) * k, dy = -t.y * k, dz = (goal.z - t.z) * k; // the view also comes down to the ground (the title orbits the globe in the air)
    t.x += dx; t.y += dy; t.z += dz; camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
    if (goal.zoom) { camera.zoom += (goal.zoom - camera.zoom) * k; camera.updateProjectionMatrix(); }
  }
  controls.update();
  const L = levelNow();
  if (L !== lod.n) { lod.n = L; for (const swap of swaps) swap(L); } // the texel size crossed a threshold: show the other level's art from this frame on
  fitShadow();
}

// The title's view: the camera looks at a point `lift` above the ground (the globe), and the first focus brings it back down.
export function overview(lift: number) {
  controls.target.set(0, lift, 0);
  camera.position.set(0, Math.sin(ELEV) * 150 + lift, Math.cos(ELEV) * 150);
  camera.zoom = 1.1;
  camera.updateProjectionMatrix();
}

// Orbit to an axis-aligned azimuth, where the tiles face the camera squarely.
const Q = Math.PI / 2;
function orbitTo(pickAngle: (a: number) => number) {
  const t = controls.target, off = camera.position.clone().sub(t);
  const a0 = Math.atan2(off.x, off.z), a1 = pickAngle(a0), r = Math.hypot(off.x, off.z);
  return tween(0.5, (k) => {
    const a = a0 + (a1 - a0) * k;
    camera.position.set(t.x + Math.sin(a) * r, camera.position.y, t.z + Math.cos(a) * r);
  }, easeInOut);
}
export const rotateView = (dir: number) => orbitTo((a: number) => Math.round(a / Q) * Q + dir * Q);
export const resetView = () => orbitTo(() => 0);

// ---- Tweens (promise based, driven by the main loop) ----
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
interface Tween { t: number; dur: number; fn: (k: number) => void; ease: (t: number) => number; res: () => void }
const tweens = new Set<Tween>();
export const tween = (dur: number, fn: (k: number) => void, ease = (t: number) => t) =>
  document.hidden ? (fn(ease(1)), Promise.resolve()) : new Promise<void>((res) => tweens.add({ t: 0, dur, fn, ease, res }));
export const wait = (s: number) => tween(s, () => {});
export function updateTweens(dt: number) {
  for (const tw of tweens) {
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    tw.fn(tw.ease(tw.t));
    if (tw.t >= 1) { tweens.delete(tw); tw.res(); }
  }
}

// A hidden tab draws no frames: its tweens end at once (and new ones are over before they start), so the game is not held up by animations nobody sees.
export function finishTweens() {
  for (const tw of tweens) { tw.fn(tw.ease(1)); tw.res(); }
  tweens.clear();
}

// ---- Picking & projection ----
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// The index of the nearest of `objects` under the screen point, or -1. Only they are tested, not their children: pass plain shapes (the tiles' slabs), not the models standing on them.
export function pick(x: number, y: number, objects: THREE.Object3D[]) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(objects, false)[0]?.object;
  return hit ? objects.indexOf(hit) : -1;
}
export function toScreen(v: THREE.Vector3): [number, number] {
  const p = v.clone().project(camera);
  return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight];
}

// ---- Lights ----
scene.add(new THREE.HemisphereLight(0xd8ecff, 0x56648a, 1.6));
// The sun stands to the west (the default view's left), fixed in the world like the tiles: the camera turns round it, so each side shows its own light and shadow.
// It is exactly sideways, so the shadow map's texels line up with the ground's: a shadow is a block of whole ground texels, not a ragged diagonal. In the default
// view each visible face lands on its own shading band: top, left, front (square to the light, mid-band) and right.
const SUN_SIN = Math.sin(THREE.MathUtils.degToRad(52));
const SUN = new THREE.Vector3(-Math.sqrt(1 - SUN_SIN ** 2), SUN_SIN, 0).multiplyScalar(100 * BOARD_K); // offset from the view target
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { near: 1, far: 220 * BOARD_K });
sun.shadow.bias = -0.0006 / BOARD_K;
sun.shadow.normalBias = 0.04; // walls facing the camera lie along the light's rays: nudge their lookups off the wall, or the shadow map speckles them
scene.add(sun, sun.target);

// Shadow texels match ground texels: 4096 of them span ~190 x 150 world units, so the shadow frustum follows the view target (snapped to whole shadow
// texels, so shadows never crawl) and only doubles when the visible ground would spill over its edge (far zoomed out, where a shadow texel is a
// fraction of a screen pixel anyway).
const SUN_X = new THREE.Vector3(SUN.z, 0, -SUN.x).normalize(), SUN_Y = SUN.clone().normalize().cross(SUN_X); // the sun's light-space axes
let shadowScale = 0;
function fitShadow() {
  const t = controls.target, off = camera.position.clone().sub(t), half = 2048 / DENSITY;
  const reach = Math.hypot(camera.right - camera.left, ((camera.top - camera.bottom) * off.length()) / off.y) / (2 * camera.zoom); // radius of the visible ground
  const s = reach > half ? 2 : 1, tx = s / DENSITY, ty = tx * SUN_SIN, x = t.dot(SUN_X), y = t.dot(SUN_Y);
  if (s !== shadowScale) {
    Object.assign(sun.shadow.camera, { left: -half * s, right: half * s, top: half * s * SUN_SIN, bottom: -half * s * SUN_SIN });
    sun.shadow.camera.updateProjectionMatrix();
    shadowScale = s;
  }
  sun.target.position.copy(t).addScaledVector(SUN_X, Math.round(x / tx) * tx - x).addScaledVector(SUN_Y, Math.round(y / ty) * ty - y);
  sun.position.copy(sun.target.position).add(SUN);
}
