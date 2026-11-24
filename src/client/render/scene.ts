import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { lit, U } from './light';
import { OUTLINE_GLSL } from './art';
import { sky, updateSky } from './sky';

export const BOARD_K = 2;

export const DENSITY = 132 / (3 * BOARD_K);

export const lod = { n: -1 };
export const texels = (units: number, L = 2) => Math.round((units * DENSITY) / 2 ** (2 - L));
const later: (() => void)[] = [];
const idle = (f: (d?: IdleDeadline) => void) => ('requestIdleCallback' in window ? requestIdleCallback(f) : setTimeout(f, 16));
function drain(d?: IdleDeadline) {
  if (renderer) for (const end = performance.now() + (d?.timeRemaining() ?? 8); later.length && performance.now() < end;) later.shift()!();
  if (later.length) idle(drain);
}
export const lodMap = <M extends THREE.Material & { map: THREE.Texture | null }>(mat: M, make: (L: number) => THREE.Texture, slot: 'map' | 'emissiveMap' = 'map'): M => {
  const maps = (mat.userData.maps ??= []) as THREE.Texture[], was = mat.onBeforeRender;
  const mine = <T extends THREE.Texture>(t: T) => (maps.push(t), t);
  const drawn: THREE.Texture[] = [], get = (L: number) => (drawn[L] ??= mine(make(L)));
  mat.onBeforeRender = (...a) => {
    was.apply(mat, a);
    if (lod.n >= 0) Object.assign(mat, { [slot]: get(lod.n) });
  };
  if (typeof document !== 'undefined') {
    if (!later.length) idle(drain);
    for (const L of [0, 1, 2]) later.push(() => renderer.initTexture(get(L)));
  }
  return mat;
};

const PX = 2;
const VIEW_H = 50;
const cssH = () => rt.height * PX;
export const artH = () => rt.height;
const texelPx = () => (cssH() * camera.zoom * Math.sin(ELEV)) / (VIEW_H * DENSITY);
export const pxUnit = (zoom = camera.zoom) => VIEW_H / (zoom * artH());
const levelNow = () => {
  const t = texelPx(), step = [PX / 2, PX];
  let L = 0;
  while (L < step.length && t >= step[L] * (L < lod.n ? 0.92 : 1)) L++;
  return L;
};

const kept = import.meta.hot?.data ?? {};
export let renderer!: THREE.WebGLRenderer;
export const dirtyShadow = () => { if (renderer) renderer.shadowMap.needsUpdate = true; };

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14213d);

const GRAD = new THREE.DataTexture(new Uint8Array([66, 90, 118, 150, 188, 224, 255]), 7, 1, THREE.RedFormat);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
GRAD.needsUpdate = true;
export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...extra });
  m.onBeforeCompile = lit;
  return m;
};

export const pixelTexture = (src: HTMLCanvasElement, repeat?: number) => {
  const t = new THREE.CanvasTexture(src);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
};

export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -600, 600);
export const ELEV = THREE.MathUtils.degToRad(52);
const ORBIT = 150;
camera.position.set(0, Math.sin(ELEV) * ORBIT, Math.cos(ELEV) * ORBIT);

export const controls = new OrbitControls(camera);
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false, minDistance: ORBIT, maxDistance: ORBIT,
  maxZoom: 3, minPolarAngle: THREE.MathUtils.degToRad(20), maxPolarAngle: THREE.MathUtils.degToRad(70),
});
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
const texel = new THREE.Vector2(), unit = { value: 0.07 }, lim = { value: 0.72 }, ramp = { value: 0 };
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tc: { value: rt.texture }, td: { value: rt.depthTexture }, texel: { value: texel }, unit, lim, ramp, span: { value: camera.far - camera.near } },
  vertexShader: 'varying vec2 v; void main() { v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tc, td; uniform vec2 texel; uniform float unit, lim, ramp, span; varying vec2 v;
    ${OUTLINE_GLSL}
    void main() {
      vec2 n[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));
      vec3 c = texture2D(tc, v).rgb;
      float z = texture2D(td, v).x * span, top = lim, sum = 0.;
      bool rim = false;
      for (int i = 0; i < 4; i++) {
        vec2 u = v + n[i] * texel;
        float d = texture2D(td, u).x * span - z;
        sum += d;
        float s = d - n[i].y * ramp;
        if (-s > top) { top = -s; c = outlineOf(texture2D(tc, u).rgb); }
        rim = rim || abs(s) > lim;
      }
      float k = rim ? 0. : sum / unit;
      gl_FragColor = vec4(k > 0.9 ? c * 1.32 + 0.035 : k < -0.9 ? c * 0.62 : c, 1.);
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
}));
const postScene = new THREE.Scene().add(post), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const snapped = new THREE.Vector3();
const shake = { mag: 0, dur: 0, left: 0, sx: 0, sy: 0, tick: 0 };
const SHAKE_ART_PX = 7;

export function shakeCamera(intensity: number, durationSec: number) {
  if (intensity <= 0 || durationSec <= 0 || document.hidden || navigator.webdriver) return;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (intensity < shake.mag && shake.left > 0.05) return;
  shake.mag = intensity;
  shake.dur = durationSec;
  shake.left = durationSec;
  shake.tick = 0;
}

function snap() {
  camera.updateMatrixWorld();
  const m = camera.matrixWorld.elements, p = camera.position, u = pxUnit();
  const a = p.x * m[0] + p.y * m[1] + p.z * m[2], b = p.x * m[4] + p.y * m[5] + p.z * m[6];
  const ox = (rt.width & 1) / 2, oy = (rt.height & 1) / 2;
  const qx = shake.sx ? Math.round(shake.sx * SHAKE_ART_PX) * u : 0;
  const qy = shake.sy ? Math.round(shake.sy * SHAKE_ART_PX) * u : 0;
  const da = (Math.round(a / u - ox + 1e-6) + ox) * u - a + qx, db = (Math.round(b / u - oy + 1e-6) + oy) * u - b + qy;
  camera.position.add(snapped.set(m[0] * da + m[4] * db, m[1] * da + m[5] * db, m[2] * da + m[6] * db));
  camera.updateMatrixWorld();
  unit.value = u;
  const t = Math.tan(controls.getPolarAngle());
  ramp.value = u * t;
  lim.value = Math.max(0.72, 1.25 * u * (t + 1 / t));
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

let framed = false;
export let fitZoom = 0.5;
export const frame = (on: boolean) => { if (on !== framed) { framed = on; resize(); } };

function resize() {
  const cv = renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(1 / PX);
  renderer.setSize(w, h, false);
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  rt.setSize(buf.x, buf.y);
  texel.set(1 / buf.x, 1 / buf.y);
  const a = buf.x / buf.y;
  Object.assign(camera, { left: -VIEW_H * a / 2, right: VIEW_H * a / 2, top: VIEW_H / 2, bottom: -VIEW_H / 2 });
  const cr = framed ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cr')) || 0 : 0;
  const freeW = 1 - cr / w;
  camera.setViewOffset(buf.x, buf.y, Math.round(cr / 2 / PX), 0, buf.x, buf.y);
  fitZoom = cr ? (VIEW_H / (52 * BOARD_K)) * Math.min(a * freeW, 1 / Math.sin(ELEV)) : Math.min(1, (a * VIEW_H) / 52) / BOARD_K;
  controls.minZoom = fitZoom;
}

let goal: { x: number; z: number; zoom?: number | 'fit'; view?: { az: number; elev: number } } | null = null;
controls.addEventListener('start', () => (goal = null));
export const focus = (x: number, z: number, zoom?: number | 'fit', view?: { az: number; elev: number }) =>
  (goal = { x, z, zoom: zoom ?? goal?.zoom, view: view ?? goal?.view });
export const pan = { x: 0, y: 0 };

export function updateCamera(dt: number) {
  const t = controls.target;
  if (pan.x || pan.y) {
    goal = null;
    const a = Math.atan2(camera.position.x - t.x, camera.position.z - t.z), n = Math.hypot(pan.x, pan.y), v = (0.9 * dt * VIEW_H) / (camera.zoom * n);
    const dx = (pan.x * Math.cos(a) - pan.y * Math.sin(a)) * v, dz = -(pan.x * Math.sin(a) + pan.y * Math.cos(a)) * v;
    t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz;
  }
  const cx = THREE.MathUtils.clamp(t.x, -45 * BOARD_K, 45 * BOARD_K), cz = THREE.MathUtils.clamp(t.z, -30 * BOARD_K, 30 * BOARD_K);
  if (cx !== t.x || cz !== t.z) { camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.set(cx, t.y, cz); }
  if (goal) {
    const k = 1 - Math.pow(0.003, dt), dx = (goal.x - t.x) * k, dy = -t.y * k, dz = (goal.z - t.z) * k;
    t.x += dx; t.y += dy; t.z += dz; camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
    if (goal.zoom) { camera.zoom += ((goal.zoom === 'fit' ? fitZoom : goal.zoom) - camera.zoom) * k; camera.updateProjectionMatrix(); }
    if (goal.view) {
      const off = camera.position.clone().sub(t), L = off.length(), a0 = Math.atan2(off.x, off.z), e0 = Math.atan2(off.y, Math.hypot(off.x, off.z));
      const a1 = THREE.MathUtils.degToRad(goal.view.az), e1 = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(goal.view.elev, 20, 70));
      const a = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * k, e = e0 + (e1 - e0) * k;
      camera.position.set(t.x + Math.sin(a) * Math.cos(e) * L, t.y + Math.sin(e) * L, t.z + Math.cos(a) * Math.cos(e) * L);
    }
  }
  controls.update();
  lod.n = levelNow();
  daylight();
  fitShadow();
}

export function overview(lift: number) {
  goal = null;
  controls.target.set(0, lift, 0);
  camera.position.set(0, Math.sin(ELEV) * ORBIT + lift, Math.cos(ELEV) * ORBIT);
  camera.zoom = 1.1;
  camera.updateProjectionMatrix();
}

export function viewAngles() {
  const off = camera.position.clone().sub(controls.target), r = Math.hypot(off.x, off.z);
  return { elev: THREE.MathUtils.radToDeg(Math.atan2(off.y, r)), az: THREE.MathUtils.radToDeg(Math.atan2(off.x, off.z)) };
}

export function jumpTo(x: number, z: number, zoom: number | 'fit' = camera.zoom, elev = THREE.MathUtils.radToDeg(ELEV), az = 0, lift = 0) {
  goal = null;
  const el = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az), h = Math.cos(el) * ORBIT;
  controls.target.set(x, lift, z);
  camera.position.set(x + Math.sin(a) * h, lift + Math.sin(el) * ORBIT, z + Math.cos(a) * h);
  camera.zoom = THREE.MathUtils.clamp(zoom === 'fit' ? fitZoom : zoom, controls.minZoom, controls.maxZoom);
  camera.updateProjectionMatrix();
  const damp = controls.enableDamping;
  controls.enableDamping = false;
  updateCamera(0);
  controls.enableDamping = damp;
  dirtyShadow();
}

const Q = Math.PI / 2;
function orbitTo(pickAngle: (a: number) => number, pickY: (r: number, y: number) => number = (_r, y) => y) {
  if (goal) goal.view = undefined;
  const t = controls.target, off = camera.position.clone().sub(t);
  const a0 = Math.atan2(off.x, off.z), a1 = pickAngle(a0), r = Math.hypot(off.x, off.z);
  const y0 = off.y, y1 = pickY(r, y0);
  return tween(0.5, (k) => {
    const a = a0 + (a1 - a0) * k;
    camera.position.set(t.x + Math.sin(a) * r, t.y + y0 + (y1 - y0) * k, t.z + Math.cos(a) * r);
  }, easeInOut);
}
export const rotateView = (dir: number) => orbitTo((a: number) => Math.round(a / Q) * Q + dir * Q);
export const resetView = () => orbitTo(() => 0, (r) => r * Math.tan(ELEV));

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
interface Tween { t: number; dur: number; fn: (k: number) => void; ease: (t: number) => number; res: () => void }
const tweens = new Set<Tween>();
export const pace = { speed: 1 };
let lastFrame = performance.now(), guard: ReturnType<typeof setInterval> | null = null;
function watch() {
  guard ??= setInterval(() => {
    if (!tweens.size) { clearInterval(guard!); guard = null; }
    else if (!document.hidden && performance.now() - lastFrame > 1000) finishTweens();
  }, 500);
}
export const tween = (dur: number, fn: (k: number) => void, ease = (t: number) => t) =>
  document.hidden ? (fn(ease(1)), dirtyShadow(), Promise.resolve()) : new Promise<void>((res) => { tweens.add({ t: 0, dur, fn, ease, res }); watch(); });
const still = () => {};
export const wait = (s: number) => tween(s, still);
export function updateTweens(dt: number) {
  lastFrame = performance.now();
  if (shake.left > 0 && dt > 0) {
    shake.left = Math.max(0, shake.left - dt);
    if (shake.left <= 0) {
      shake.sx = shake.sy = 0;
    } else {
      const frac = shake.dur > 0 ? shake.left / shake.dur : 0;
      const amp = shake.mag * frac * Math.exp(-2.8 * (1 - frac));
      shake.tick += dt;
      const step = Math.floor(shake.tick * 42);
      const a = Math.sin(step * 12.9898 + 1.3) * 43758.5453;
      const b = Math.sin(step * 78.233 + 4.7) * 43758.5453;
      shake.sx = ((a - Math.floor(a)) * 2 - 1) * amp;
      shake.sy = ((b - Math.floor(b)) * 2 - 1) * amp;
    }
  } else if (shake.left <= 0 && (shake.sx || shake.sy)) {
    shake.sx = shake.sy = 0;
  }
  for (const tw of tweens) {
    tw.t = Math.min(1, tw.t + (dt * pace.speed) / tw.dur);
    tw.fn(tw.ease(tw.t));
    if (tw.fn !== still) dirtyShadow();
    if (tw.t >= 1) { tweens.delete(tw); tw.res(); }
  }
}

export function finishTweens() {
  for (const tw of tweens) { tw.fn(tw.ease(1)); tw.res(); }
  tweens.clear();
  shake.left = shake.sx = shake.sy = 0;
  dirtyShadow();
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function pick(x: number, y: number, objects: THREE.Object3D[]) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(objects, false)[0]?.object;
  return hit ? objects.indexOf(hit) : -1;
}
export function toScreen(v: THREE.Vector3): [number, number] {
  const p = v.clone().project(camera);
  return [(p.x + 1) / 2, (1 - p.y) / 2];
}

const hemi = new THREE.HemisphereLight();
const DAYLIGHT = [0xd8ecff, 0x56648a, 1.6, 0xfff0d0, 2.4] as const;
const SUN_AT = 100 * BOARD_K;
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { near: 1, far: 220 * BOARD_K });
sun.shadow.bias = -0.0006 / BOARD_K;
sun.shadow.normalBias = 0.04;

const LOW = 0.3;
const SUN_X = new THREE.Vector3(), SUN_Y = new THREE.Vector3(), drawn = new THREE.Vector3();
let shadowScale = 0, shadowX = 0, shadowY = 0, shadowH = 1;
function fitShadow() {
  const L = sky.light, turned = !L.equals(drawn);
  if (turned) {
    drawn.copy(L);
    SUN_X.set(L.z, 0, -L.x).normalize(); SUN_Y.crossVectors(L, SUN_X);
    shadowH = Math.max(L.y, LOW);
  }
  const t = controls.target, off = camera.position.clone().sub(t), half = 2048 / DENSITY;
  const reach = Math.hypot(camera.right - camera.left, ((camera.top - camera.bottom) * off.length()) / off.y) / (2 * camera.zoom);
  const s = reach > half ? 2 : 1, tx = s / DENSITY, ty = tx * shadowH, x = t.dot(SUN_X), y = t.dot(SUN_Y), i = Math.round(x / tx), j = Math.round(y / ty);
  if (turned || s !== shadowScale || i !== shadowX || j !== shadowY) {
    if (turned || s !== shadowScale) {
      Object.assign(sun.shadow.camera, { left: -half * s, right: half * s, top: half * s * shadowH, bottom: -half * s * shadowH });
      sun.shadow.camera.updateProjectionMatrix();
    }
    [shadowScale, shadowX, shadowY] = [s, i, j];
    dirtyShadow();
  }
  sun.target.position.copy(t).addScaledVector(SUN_X, i * tx - x).addScaledVector(SUN_Y, j * ty - y);
  sun.position.copy(sun.target.position).addScaledVector(L, SUN_AT);
}

function daylight() {
  updateSky();
  const [skyC, groundC, skyI, sunC, sunI] = DAYLIGHT;
  hemi.color.set(skyC).multiply(sky.skyC); hemi.groundColor.set(groundC).multiply(sky.skyC); hemi.intensity = skyI * sky.skyK;
  sun.color.set(sunC).multiply(sky.lightC); sun.intensity = sunI * sky.lightK;
  U.uLamp.value = sky.lampK;
  (scene.background as THREE.Color).copy(sky.horizon);
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) for (const v of [...Object.values(m), ...(m.userData.maps ?? [])]) if (v instanceof THREE.Texture) v.dispose();
  });
}
export function initScene() {
  renderer = kept.renderer ??= new THREE.WebGLRenderer({ canvas: document.getElementById('gl') as HTMLCanvasElement, antialias: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.shadowMap.autoUpdate = false;
  controls.connect(renderer.domElement);
  scene.add(hemi, sun, sun.target);
  daylight();
  renderer.domElement.style.width = renderer.domElement.style.height = '';
  const fit = new ResizeObserver(() => { resize(); render(); });
  fit.observe(renderer.domElement);
  resize();
  return () => {
    fit.disconnect();
    controls.disconnect();
    finishTweens();
    goal = null;
    later.length = 0;
    disposeTree(scene);
    scene.clear();
    for (const o of [rt, post.geometry, post.material, sun.shadow]) o.dispose();
  };
}
