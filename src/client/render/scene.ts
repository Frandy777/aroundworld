import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ORM, hd, lamps, lit, setLamps, spot, texOf, U, type Pbr } from './light';
import { canvas, flatMask, maskOf } from './art';
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
export const lodMap = <M extends THREE.Material & { map: THREE.Texture | null }>(mat: M, make: (L: number, hd: boolean) => THREE.Texture, slot: 'map' | 'emissiveMap' = 'map'): M => {
  const maps = (mat.userData.maps ??= []) as THREE.Texture[], was = mat.onBeforeRender, toony = mat instanceof THREE.MeshToonMaterial;
  const mine = <T extends THREE.Texture>(t: T) => (maps.push(t), (t.userData.lod = true), t);
  const drawn: THREE.Texture[] = [], get = (L: number) => (drawn[L] ??= mine(make(L, false)));
  let ch: THREE.Texture | undefined;
  const chain = () => {
    if (ch) return ch;
    const src = [2, 1, 0].map((L) => (make.length > 1 ? make(L, true) : get(L))), cs = src.map((t) => t.image as HTMLCanvasElement);
    let t = chains.get(cs[0]);
    if (!t) {
      const ms = cs.map(maskOf);
      chains.set(cs[0], (t = chainOf(cs, src[0])));
      if (slot === 'map' && ms.some(Boolean)) t.userData.orm = chainOf(cs.map((c, k) => ms[k] ?? flatMask(c)), src[0], true);
    }
    if (t.userData.orm) mine(t.userData.orm);
    if (slot === 'map') texOf(mat).uLv.value.forEach((v, k) => v.set(cs[k].width, cs[k].height));
    return (ch = mine(t));
  };
  mat.onBeforeRender = (...a) => {
    was.apply(mat, a);
    const chained = hd.on && toony;
    if (chained) Object.assign(mat, { [slot]: chain() });
    else if (lod.n >= 0) Object.assign(mat, { [slot]: get(lod.n) });
    if (slot === 'map' && toony) { const u = texOf(mat), orm = chained ? (ch!.userData.orm as THREE.Texture | undefined) : undefined; u.ormMap.value = orm ?? ORM; u.uOrm.value = +!!orm; }
  };
  if (typeof document !== 'undefined') {
    if (!later.length) idle(drain);
    for (const L of [0, 1, 2]) later.push(() => renderer.initTexture(get(L)));
    if (toony) {
      const job = () => { const c = chain(); renderer.initTexture(c); if (c.userData.orm) renderer.initTexture(c.userData.orm); };
      (mat.userData.warm ??= []).push(job);
      if (hd.on) later.push(job);
    }
  }
  return mat;
};
const padded = (c: HTMLCanvasElement, w: number, h: number) => (w === c.width && h === c.height ? c : canvas(w, h, (g) => {
  const [cw, ch] = [c.width, c.height], [dx, dy] = [w - cw, h - ch];
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, dy);
  g.drawImage(c, 0, 0, cw, 1, 0, 0, cw, dy);
  g.drawImage(c, cw - 1, 0, 1, ch, cw, dy, dx, ch);
  g.drawImage(c, cw - 1, 0, 1, 1, cw, 0, dx, dy);
}));
const halved = (c: HTMLCanvasElement) => canvas(Math.max(1, c.width >> 1), Math.max(1, c.height >> 1), (g, w, h) => { g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, w, h); });
const chainOf = (cs: HTMLCanvasElement[], like: THREE.Texture, mask = false) => {
  const [w, h] = [(c: HTMLCanvasElement) => c.width, (c: HTMLCanvasElement) => c.height].map((side) => Math.max(...cs.map((c, k) => side(c) << k)));
  const mips = cs.map((c, k) => padded(c, w >> k, h >> k));
  for (let c = mips[2]; c.width > 1 || c.height > 1;) mips.push((c = halved(c)));
  const t = new THREE.CanvasTexture(mips[0]);
  Object.assign(t, { mipmaps: mips, generateMipmaps: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, wrapS: like.wrapS, wrapT: like.wrapT, colorSpace: mask ? THREE.NoColorSpace : like.colorSpace });
  t.repeat.copy(like.repeat); t.offset.copy(like.offset);
  return t;
};
const chains = new WeakMap<HTMLCanvasElement, THREE.Texture>();

let PX = 2;
const VIEW_H = 50;
const cssH = () => (hd.on ? renderer.domElement.clientHeight : rt.height * PX);
export const artH = () => (hd.on ? renderer.domElement.clientHeight / 2 : rt.height);
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
export const movers: THREE.Object3D[] = [];

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14213d);

const GRAD = new THREE.DataTexture(new Uint8Array([66, 90, 118, 150, 188, 224, 255]), 7, 1, THREE.RedFormat);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
GRAD.needsUpdate = true;
const follow = (t: THREE.Texture | null) => {
  const min = hd.on ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapNearestFilter;
  if (t && !t.userData.lod && t.minFilter !== min) { t.minFilter = min; t.magFilter = hd.on ? THREE.LinearFilter : THREE.NearestFilter; t.needsUpdate = true; }
};
export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}, pbr?: Pbr) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...extra });
  m.onBeforeCompile = lit;
  m.onBeforeRender = () => { follow(m.map); follow(m.emissiveMap); };
  if (pbr) m.userData.pbr = pbr;
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

export const LAYER_FX = 1;
export const AIR = {
  aFog: { value: new THREE.Vector4(-1.2, 40, 0.07, 0.005) },
  aHor: { value: sky.horizon }, aLit: { value: sky.light }, aSun: { value: sky.sun }, aGlow: { value: 1 },
};
export const AIR_GLSL = /* glsl */`
uniform vec3 aHor, aLit, aSun; uniform vec4 aFog; uniform float aGlow;
float lobe( vec2 h, vec3 d ) { return pow( clamp( dot( h, normalize( d.xz ) ), 0.0, 1.0 ), 4.0 ); }
vec3 haze( vec3 rd ) { vec2 h = normalize( rd.xz ); return aHor * ( 0.85 + 0.3 * mix( lobe( h, aLit ), lobe( h, aSun ), aGlow ) ); }
float tau( vec3 ro, vec3 rd, float tm ) {
	float k = aFog.z, y0 = aFog.x, ye = ro.y + rd.y * tm;
	return aFog.w * abs( exp( - k * max( ro.y - y0, 0.0 ) ) - exp( - k * max( ye - y0, 0.0 ) ) ) / ( k * max( abs( rd.y ), 1e-3 ) );
}
vec4 airOver( vec4 c, vec3 wp, float add ) {
	vec3 d = wp - cameraPosition; float tm = length( d ); vec3 rd = d / tm; float tr = exp( - tau( cameraPosition, rd, tm ) );
	return vec4( c.rgb * tr + haze( rd ) * ( 1.0 - tr ) * ( 1.0 - add ), c.a );
}
`;
export const fxOf = <M extends THREE.MeshBasicMaterial>(m: M) => {
  const was = m.onBeforeCompile, key = `fx ${was}`;
  m.onBeforeCompile = (sh, r) => {
    was.call(m, sh, r);
    Object.assign(sh.uniforms, AIR, { uFxHd: U.uHd, uFxAdd: { value: +(m.blending === THREE.AdditiveBlending) } });
    sh.vertexShader = `varying vec3 vFx;\n${sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvFx = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;')}`;
    sh.fragmentShader = `${AIR_GLSL}\nuniform float uFxHd, uFxAdd; varying vec3 vFx;\n${sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\nif ( uFxHd > 0.5 ) {\n\tif ( gl_FragColor.a <= 0.05 ) discard;\n\tgl_FragColor = airOver( gl_FragColor, vFx, uFxAdd );\n}')}`;
  };
  m.customProgramCacheKey = () => key;
  m.onBeforeRender = () => { m.depthWrite = hd.on; };
  return m;
};

export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -600, 600);
camera.layers.enable(LAYER_FX);
export const ELEV = THREE.MathUtils.degToRad(52);
const ORBIT = 150;
camera.position.set(0, Math.sin(ELEV) * ORBIT, Math.cos(ELEV) * ORBIT);

export const controls = new OrbitControls(camera);
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false, minDistance: ORBIT, maxDistance: ORBIT,
  maxZoom: 3, minPolarAngle: THREE.MathUtils.degToRad(22), maxPolarAngle: THREE.MathUtils.degToRad(68),
});
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

export const hdCam = new THREE.PerspectiveCamera();
export const LENS = 300;
const EDGE = 24 * BOARD_K, NEAR = LENS / (LENS - EDGE * Math.cos(ELEV)), FAR = LENS / (LENS + EDGE * Math.cos(ELEV)), DROP = (EDGE * Math.sin(ELEV) * (NEAR - FAR)) / 2;
export const zoomed = () => THREE.MathUtils.smoothstep(camera.zoom / fitZoom, 1, 2);
const lensView = [1, 1, 0];
function lens() {
  const t = controls.target;
  hdCam.position.copy(camera.position).sub(t).setLength(LENS).add(t);
  hdCam.quaternion.copy(camera.quaternion);
  Object.assign(hdCam, { fov: THREE.MathUtils.radToDeg(2 * Math.atan(VIEW_H / 2 / LENS)), zoom: camera.zoom, aspect: (camera.right - camera.left) / (camera.top - camera.bottom), near: 40, far: LENS + 900 });
  const drop = (DROP * (1 - zoomed()) * lensView[1] * camera.zoom) / VIEW_H;
  hdCam.setViewOffset(lensView[0], lensView[1], lensView[2], Math.round(drop), lensView[0], lensView[1]);
  hdCam.updateMatrixWorld();
}

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
const texel = new THREE.Vector2(), unit = { value: 0.07 }, lim = { value: 0.72 }, ramp = { value: 0 };
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tc: { value: rt.texture }, td: { value: rt.depthTexture }, texel: { value: texel }, unit, lim, ramp, span: { value: camera.far - camera.near } },
  vertexShader: 'varying vec2 v; void main() { v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tc, td; uniform vec2 texel; uniform float unit, lim, ramp, span; varying vec2 v;
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
        if (-s > top) { top = -s; c = texture2D(tc, u).rgb * 0.07 + vec3(0.003, 0.006, 0.02); }
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
function snap() {
  camera.updateMatrixWorld();
  const m = camera.matrixWorld.elements, p = camera.position, u = pxUnit();
  const a = p.x * m[0] + p.y * m[1] + p.z * m[2], b = p.x * m[4] + p.y * m[5] + p.z * m[6];
  const ox = (rt.width & 1) / 2, oy = (rt.height & 1) / 2;
  const da = (Math.round(a / u - ox + 1e-6) + ox) * u - a, db = (Math.round(b / u - oy + 1e-6) + oy) * u - b;
  camera.position.add(snapped.set(m[0] * da + m[4] * db, m[1] * da + m[5] * db, m[2] * da + m[6] * db));
  camera.updateMatrixWorld();
  unit.value = u;
  const t = Math.tan(controls.getPolarAngle());
  ramp.value = u * t;
  lim.value = Math.max(0.72, 1.25 * u * (t + 1 / t));
}
export function render() {
  if (hd.on && hdMod) { dirtyShadow(); return hdMod.render(); }
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
export const free = { w: 1 };
export const frame = (on: boolean) => { if (on !== framed) { framed = on; resize(); } };

function resize() {
  const cv = renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  PX = hd.on ? 1 / Math.max(1, Math.min(devicePixelRatio, Math.sqrt(3.2e6 / (w * h)))) : 2;
  renderer.setPixelRatio(1 / PX);
  renderer.setSize(w, h, false);
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (hd.on) { rt.setSize(1, 1); hdMod?.resize(buf.x, buf.y); } else rt.setSize(buf.x, buf.y);
  texel.set(1 / buf.x, 1 / buf.y);
  const a = buf.x / buf.y;
  Object.assign(camera, { left: -VIEW_H * a / 2, right: VIEW_H * a / 2, top: VIEW_H / 2, bottom: -VIEW_H / 2 });
  const cr = framed ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cr')) || 0 : 0;
  free.w = 1 - cr / w;
  camera.setViewOffset(buf.x, buf.y, Math.round(cr / 2 / PX), 0, buf.x, buf.y);
  lensView.splice(0, 3, buf.x, buf.y, Math.round(cr / 2 / PX));
  const wide = hd.on ? NEAR : 1;
  fitZoom = cr ? (VIEW_H / (52 * BOARD_K)) * Math.min((a * free.w) / wide, 1 / Math.sin(ELEV)) : Math.min(1, (a * VIEW_H) / 52 / wide) / BOARD_K;
  controls.minZoom = fitZoom;
  if (hd.on) lens();
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
      const a1 = THREE.MathUtils.degToRad(goal.view.az), e1 = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(goal.view.elev, 22, 68));
      const a = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * k, e = e0 + (e1 - e0) * k;
      camera.position.set(t.x + Math.sin(a) * Math.cos(e) * L, t.y + Math.sin(e) * L, t.z + Math.cos(a) * Math.cos(e) * L);
    }
  }
  controls.update();
  lod.n = levelNow();
  daylight();
  fitShadow();
  if (hd.on) lens();
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
  dirtyShadow();
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function pick(x: number, y: number, objects: THREE.Object3D[]) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, hd.on ? hdCam : camera);
  const hit = ray.intersectObjects(objects, false)[0]?.object;
  return hit ? objects.indexOf(hit) : -1;
}
export function toScreen(v: THREE.Vector3): [number, number] {
  const p = v.clone().project(hd.on ? hdCam : camera);
  return [(p.x + 1) / 2, (1 - p.y) / 2];
}

const hemi = new THREE.HemisphereLight();
const DAYLIGHT = [[0xd8ecff, 0x56648a, 1.6, 0xfff0d0, 2.4], [0xa9c4ff, 0x6b5a58, 1.1, 0xffe0b0, 3.4]];
const SUN_AT = 100 * BOARD_K;
export const sun = new THREE.DirectionalLight();
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
  const reach = (Math.hypot(camera.right - camera.left, ((camera.top - camera.bottom) * off.length()) / off.y) / (2 * camera.zoom)) * (hd.on ? 1.3 : 1);
  const s = reach > half ? 2 : 1, tx = s / DENSITY, ty = tx * shadowH, x = t.dot(SUN_X), y = t.dot(SUN_Y), i = Math.round(x / tx), j = Math.round(y / ty);
  if (turned || s !== shadowScale || i !== shadowX || j !== shadowY) {
    if (turned || s !== shadowScale) {
      Object.assign(sun.shadow.camera, { left: -half * s, right: half * s, top: half * s * shadowH, bottom: -half * s * shadowH });
      sun.shadow.camera.updateProjectionMatrix();
    }
    [shadowScale, shadowX, shadowY] = [s, i, j];
    dirtyShadow();
  }
  U.uSh.value.set(sun.shadow.camera.far - sun.shadow.camera.near, tx);
  sun.target.position.copy(t).addScaledVector(SUN_X, i * tx - x).addScaledVector(SUN_Y, j * ty - y);
  sun.position.copy(sun.target.position).addScaledVector(L, SUN_AT);
}

function daylight() {
  updateSky();
  const [skyC, groundC, skyI, sunC, sunI] = DAYLIGHT[+hd.on];
  hemi.color.set(skyC).multiply(sky.skyC); hemi.groundColor.set(groundC).multiply(sky.skyC); hemi.intensity = skyI * sky.skyK;
  sun.color.set(sunC).multiply(sky.lightC); sun.intensity = sunI * sky.lightK;
  U.uLamp.value = sky.lampK;
  (scene.background as THREE.Color).copy(sky.horizon);
}

let hdMod: typeof import('./hd2d') | null = null, wanted = false;
function look(on: boolean) {
  hd.on = on; U.uHd.value = +on;
  setLamps(on);
  for (const o of movers) o.castShadow = on;
  renderer.domElement.style.imageRendering = on ? 'auto' : '';
  resize();
  dirtyShadow();
  if (!on) hdMod?.release();
}
const warm = () => new Promise<void>((done) => {
  const jobs = new Set<() => void>(), gl = renderer.getContext() as WebGL2RenderingContext;
  scene.traverse((o) => { if (o instanceof THREE.Mesh) for (const m of [o.material].flat()) m.userData.warm?.forEach((j: () => void) => jobs.add(j)); });
  const run = () => {
    for (const end = performance.now() + 6; jobs.size && performance.now() < end;) { const [j] = jobs; jobs.delete(j); j(); }
    if (!jobs.size) return done();
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!, poll = () => (gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED ? (gl.deleteSync(fence), run()) : void setTimeout(poll, 4));
    poll();
  };
  run();
});
export async function setLighting(on: boolean) {
  wanted = on;
  if (on) { hdMod ??= await import('./hd2d'); if (!hd.on) await warm(); }
  if (wanted === on && hd.on !== on) look(on);
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
  for (const l of [hemi, sun, spot, ...lamps]) l.layers.enable(LAYER_FX);
  scene.add(hemi, sun, sun.target, ...lamps, spot, spot.target);
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
    look(false);
    disposeTree(scene);
    scene.clear();
    for (const o of [rt, post.geometry, post.material, sun.shadow]) o.dispose();
  };
}
