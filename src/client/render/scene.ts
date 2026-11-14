import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ORM, hd, lamps, lit, setLamps, spot, texOf, U, type Pbr } from './light';
import { canvas, flatMask, maskOf } from './art';
import { sky, updateSky } from './sky';

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
// The levels out of view can wait: they are made in the idle time, a few ms at a time (Safari has no requestIdleCallback: a timer stands in)
const later: (() => void)[] = [];
const idle = (f: (d?: IdleDeadline) => void) => ('requestIdleCallback' in window ? requestIdleCallback(f) : setTimeout(f, 16));
function drain(d?: IdleDeadline) {
  // A job can be queued while the page is still booting, before initScene has made the renderer: the queue waits for it.
  if (renderer) for (const end = performance.now() + (d?.timeRemaining() ?? 8); later.length && performance.now() < end;) later.shift()!();
  if (later.length) idle(drain);
}
// A material whose map has one drawing per level: make(level, hd) -> texture. Every draw takes the level in view (nothing is registered anywhere, so nothing outlives the material).
// The level in view is made when it is first drawn, the other two (and their upload) when the page is idle, so a level switch is a pointer swap by the time anyone zooms;
// one that comes sooner makes its level on the spot. `slot` is the map it fills: the colour (`map`), or the lamps (`emissiveMap`, drawn on the same grid, see `nightlit`): a material can have both.
// HD-2D never swaps levels: it draws a lit material from `chainOf`, the three drawings as the mips of one texture, so every pixel takes the level it needs (see light.ts hdSample). A `make` that takes `hd` has a drawing of its
// own for the chain, which `lodMap` asks it for (the ring of a tile's edge, see labels.ts); the others share the restrained look's. A drawing's mask (art.ts `maskOf`) goes through the same levels, as the texture `ormMap` in light.ts.
export const lodMap = <M extends THREE.Material & { map: THREE.Texture | null }>(mat: M, make: (L: number, hd: boolean) => THREE.Texture, slot: 'map' | 'emissiveMap' = 'map'): M => {
  const maps = (mat.userData.maps ??= []) as THREE.Texture[], was = mat.onBeforeRender, toony = mat instanceof THREE.MeshToonMaterial; // maps: every texture made for the material, for disposeTree. Only a toon material's shader reads the chain
  const mine = <T extends THREE.Texture>(t: T) => (maps.push(t), (t.userData.lod = true), t); // flagged: its filters are lodMap's to set (see `toon`)
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
    if (slot === 'map' && toony) { const u = texOf(mat), orm = chained ? (ch!.userData.orm as THREE.Texture | undefined) : undefined; u.ormMap.value = orm ?? ORM; u.uOrm.value = +!!orm; } // the restrained look has no use for a mask
  };
  if (typeof document !== 'undefined') { // the idle pre-upload needs the renderer: there is none under Node
    if (!later.length) idle(drain);
    for (const L of [0, 1, 2]) later.push(() => renderer.initTexture(get(L)));
    if (toony) {
      const job = () => { const c = chain(); renderer.initTexture(c); if (c.userData.orm) renderer.initTexture(c.userData.orm); }; // HD-2D's chain: made now for a material made while it is on, and by `warm` before it is switched on
      (mat.userData.warm ??= []).push(job);
      if (hd.on) later.push(job);
    }
  }
  return mat;
};
// The three drawings of a texture (`cs`, near to far: canvases) as the mips of one texture. Mips must halve exactly and a drawing does not always (a wall is 31 texels tall near and 15 mid), so a drawing is padded up to the size its mip
// needs, its edge texels repeated (on the right and at the top: it rests on the bottom left, where UV 0 is once the upload has flipped it), and its own size goes to the shader (`uLv`) for the grid of that mip. The mips past the third are
// boxed down from the far one. A texture that repeats (the roof, the stone, the length of the side wall) halves exactly, so is never padded: the padding would be what the repeat wraps to. `mask`: the chain of masks (linear, not colour).
const padded = (c: HTMLCanvasElement, w: number, h: number) => (w === c.width && h === c.height ? c : canvas(w, h, (g) => {
  const [cw, ch] = [c.width, c.height], [dx, dy] = [w - cw, h - ch];
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, dy);
  g.drawImage(c, 0, 0, cw, 1, 0, 0, cw, dy); // the rows above it
  g.drawImage(c, cw - 1, 0, 1, ch, cw, dy, dx, ch); // the columns to its right
  g.drawImage(c, cw - 1, 0, 1, 1, cw, 0, dx, dy); // and the corner
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
const chains = new WeakMap<HTMLCanvasElement, THREE.Texture>(); // the chain of a set of drawings, by its near one: materials that draw alike (the 92 side walls) share it, and so its upload

// ---- Pixel pipeline: the scene renders at 1/PX of the canvas size and CSS upscales it with nearest-neighbour, so an art pixel is PX = 2 CSS px at every zoom: the
// same grid as the UI frames. A buffer pixel bigger than a texel would average texels away, so a level is shown once its texels are a whole buffer pixel tall.
// (HD-2D draws at the screen's own sharpness instead: PX is then below 1, see resize. The lettering and the cursors stay sized by the art pixel of 2 CSS px, `artH`.) ----
let PX = 2;
const VIEW_H = 50; // world units on screen vertically at zoom 1
const cssH = () => (hd.on ? renderer.domElement.clientHeight : rt.height * PX); // the canvas's height, CSS px
export const artH = () => (hd.on ? renderer.domElement.clientHeight / 2 : rt.height); // ... and in art pixels: buffer pixels in the restrained look, pairs of CSS px in HD-2D
const texelPx = () => (cssH() * camera.zoom * Math.sin(ELEV)) / (VIEW_H * DENSITY);
export const pxUnit = (zoom = camera.zoom) => VIEW_H / (zoom * artH()); // world units per art pixel, at the view's zoom or at another
// Up as soon as a threshold is reached, down only 8% below it, so a zoom resting on a threshold doesn't flicker between two designs.
const levelNow = () => {
  const t = texelPx(), step = [PX / 2, PX]; // CSS px height of a near texel (a mid one is 2x that, a far one 4x) where the level goes far -> mid -> near
  let L = 0;
  while (L < step.length && t >= step[L] * (L < lod.n ? 0.92 : 1)) L++;
  return L;
};

// The GL context is the page's, not this module's: a hot update keeps the renderer (a second one on the canvas would take over its one context).
// It is made by initScene, not on import: model files pull this module in under Node too (see scripts/check.mjs), where there is no canvas or GL.
const kept = import.meta.hot?.data ?? {};
export let renderer!: THREE.WebGLRenderer;
// The 4096 x 4096 shadow map is drawn by the next render() after a dirtyShadow(), not every frame: the sun's frame moved (fitShadow), a tween, a tile or a landing token is still
// moving, a plot's building changed. The endless loops (the globe's float, the tokens' bob) are no reason: their shadows catch up whenever the map is next drawn. HD-2D is the exception: it draws the map every
// frame (see render), because its sun never steps (sky.ts) and so much of its world moves through it (the ships and the dolphin, the sails and the smoke, a token's bob, a rocket), with a spot's own map beside it.
export const dirtyShadow = () => { if (renderer) renderer.shadowMap.needsUpdate = true; };
/** What moves and casts a shadow in HD-2D only (scenery.ts adds its ships, its dolphin, the sails and the smoke), switched at the change of look: the restrained look draws its map only when something asks (see dirtyShadow),
 * so what moves would leave its shadow where the map was last drawn, and what it draws must stay what it was. */
export const movers: THREE.Object3D[] = [];

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14213d);

// Banded (toon) shading: seven flat steps per light, like a 16-bit palette ramp. Seven, because a face square to the light (its dot product is exactly 0.5)
// must land in the middle of a step, not on the seam between two.
const GRAD = new THREE.DataTexture(new Uint8Array([66, 90, 118, 150, 188, 224, 255]), 7, 1, THREE.RedFormat);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
GRAD.needsUpdate = true;
// A plain pixel texture (one drawing, see pixelTexture) is read with nearest taps by the restrained look and with bilinear ones by HD-2D's pixel filter (light.ts hdSample): a lit material puts its textures in the look
// it is drawn in, as it is drawn (nothing is registered anywhere). A lodMap's drawings are flagged, and left alone: the restrained look keeps them nearest, and HD-2D reads its chain instead.
const follow = (t: THREE.Texture | null) => {
  const min = hd.on ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapNearestFilter;
  if (t && !t.userData.lod && t.minFilter !== min) { t.minFilter = min; t.magFilter = hd.on ? THREE.LinearFilter : THREE.NearestFilter; t.needsUpdate = true; }
};
// `pbr`: how the material answers the HD-2D light (see light.ts); the default is a matte stone.
export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}, pbr?: Pbr) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...extra });
  m.onBeforeCompile = lit;
  m.onBeforeRender = () => { follow(m.map); follow(m.emissiveMap); };
  if (pbr) m.userData.pbr = pbr;
  return m;
};

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
// The near plane lies as far behind the camera as the far plane lies before it: the view is orthographic, so the camera's own plane is no reason to cut the world. At the lowest
// tilt and the farthest zoom the sea along the bottom of the screen is behind it, and a band of bare background would show there.
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -600, 600);
export const ELEV = THREE.MathUtils.degToRad(52);
camera.position.set(0, Math.sin(ELEV) * 150, Math.cos(ELEV) * 150);

export const controls = new OrbitControls(camera); // listens to nothing until initScene connects it to the canvas
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false,
  maxZoom: 3, minPolarAngle: THREE.MathUtils.degToRad(22), maxPolarAngle: THREE.MathUtils.degToRad(68), // minZoom: see resize
});
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

// HD-2D looks through a perspective lens, so the board has depth: far things smaller, the sea running off to a horizon. It is the view of the orthographic camera from farther
// back, with the field of view that shows the same height at the target: where it looks, the size at the target and the way a pan moves are unchanged, so the controls, the
// focus and the sun's frame all keep working on the orthographic camera, and the lens follows it each frame.
export const hdCam = new THREE.PerspectiveCamera();
export const LENS = 300; // its distance from the target
// The lens makes the board's near edge bigger than the orthographic view does (by NEAR, 1 at the target) and its far edge smaller (by FAR): the whole board looks pushed down the screen
// by DROP (world units on screen), and is NEAR times wider at its foot. `lens` takes the drop back, and the whole-board zoom (fitZoom) makes room for the width.
const EDGE = 24 * BOARD_K, NEAR = LENS / (LENS - EDGE * Math.cos(ELEV)), FAR = LENS / (LENS + EDGE * Math.cos(ELEV)), DROP = (EDGE * Math.sin(ELEV) * (NEAR - FAR)) / 2;
/** How far the view has come in from the whole board: 0 at its zoom (or farther out), 1 from twice it on. The drop is taken back for the whole board (a close view keeps its target in the middle),
 * and HD-2D's tilt-shift is for a close view (the whole board is read at a glance, its outer rows are at the top and bottom of the screen). */
export const zoomed = () => THREE.MathUtils.smoothstep(camera.zoom / fitZoom, 1, 2);
const lensView = [1, 1, 0]; // the buffer's size and the view's offset in it (see resize)
function lens() {
  const t = controls.target;
  hdCam.position.copy(camera.position).sub(t).setLength(LENS).add(t);
  hdCam.quaternion.copy(camera.quaternion);
  Object.assign(hdCam, { fov: THREE.MathUtils.radToDeg(2 * Math.atan(VIEW_H / 2 / LENS)), zoom: camera.zoom, aspect: (camera.right - camera.left) / (camera.top - camera.bottom), near: 40, far: LENS + 900 });
  const drop = (DROP * (1 - zoomed()) * lensView[1] * camera.zoom) / VIEW_H; // in buffer pixels: the whole board sits where the orthographic view has it, a close view keeps its target in the middle
  hdCam.setViewOffset(lensView[0], lensView[1], lensView[2], Math.round(drop), lensView[0], lensView[1]);
  hdCam.updateMatrixWorld();
}

// ---- Ink pass: draw to a colour+depth target, then work on the depth alone. The view is orthographic, so depth is linear and a flat face is a plane in it:
// - a pixel right behind a nearer one is the silhouette: inked in a dark shade of the nearer colour (outlines);
// - on a flat face the depth around a pixel averages to its own; where two faces meet it does not. A pixel that is nearer than its surroundings sits on a
//   convex edge (a roof ridge, the top of a wall) and is lit; one that is farther sits in a concave corner (where a wall meets the ground) and is darkened.
//   `unit` (world units per pixel) turns the depth difference into a number of pixels, so the same line is drawn at every zoom. ----
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
      float z = texture2D(td, v).x * span, top = lim, sum = 0.; // lim: the depth step of a silhouette, 0.72 world units or more (see snap)
      bool rim = false; // on a silhouette (just behind a nearer pixel, or just in front of a farther one) the depth step is no crease
      for (int i = 0; i < 4; i++) {
        vec2 u = v + n[i] * texel;
        float d = texture2D(td, u).x * span - z; // > 0: the neighbour is farther
        sum += d;
        float s = d - n[i].y * ramp; // the step with the ramp of level ground taken out (up the screen it is ramp deeper a pixel, down it as much nearer): 0 on the ground, a ledge's own depth at its edge
        if (-s > top) { top = -s; c = texture2D(tc, u).rgb * 0.07 + vec3(0.003, 0.006, 0.02); }
        rim = rim || abs(s) > lim;
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
  const m = camera.matrixWorld.elements, p = camera.position, u = pxUnit();
  const a = p.x * m[0] + p.y * m[1] + p.z * m[2], b = p.x * m[4] + p.y * m[5] + p.z * m[6]; // the position along the camera's right and up axes
  const ox = (rt.width & 1) / 2, oy = (rt.height & 1) / 2; // with an odd number of pixels the centre pixel is centred on the camera: offset half a pixel
  const da = (Math.round(a / u - ox + 1e-6) + ox) * u - a, db = (Math.round(b / u - oy + 1e-6) + oy) * u - b; // + 1e-6 settles the tie of a camera dead on the view axis (the title orbit, odd buffer): float noise would flip the rounding, and the picture a pixel, every frame
  camera.position.add(snapped.set(m[0] * da + m[4] * db, m[1] * da + m[5] * db, m[2] * da + m[6] * db));
  camera.updateMatrixWorld();
  unit.value = u;
  // Flat ground is a ramp in depth: up the screen it steps u * tan(polar angle) deeper per pixel. The shader takes that ramp out of every step it measures, so a ledge is its own depth (its height over sin(tilt)) at any
  // zoom: a plot's 0.3 used to pass 0.72 once a pixel had grown big enough for the ramp to make up the rest, and was inked as a silhouette. What is left to mistake is the steepest face a pixel can run along, a wall: it is
  // nearer by u / tan(polar angle) a pixel up, which beside the ground's ramp is u * (tan + 1 / tan) off level. Far out and tilted far either way (the farthest zoom at the lowest tilt, or from the highest) that passes
  // 0.72, and every pixel of a wall would be taken for the silhouette of the one above it and inked dark. A silhouette must then step a quarter deeper than that.
  const t = Math.tan(controls.getPolarAngle());
  ramp.value = u * t;
  lim.value = Math.max(0.72, 1.25 * u * (t + 1 / t));
}
export function render() {
  if (hd.on && hdMod) { dirtyShadow(); return hdMod.render(); } // every frame: see dirtyShadow
  snap();
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  camera.position.sub(snapped);
  camera.updateMatrixWorld();
}

// The zoom that shows the whole board, which with its margin is 52 * BOARD_K world units across: a canvas wider than tall is bound by its height (leaving room above and below for the bars), a narrow one by its width.
// In a game, in the overlay layout, the column floats over the canvas, and the page says how far it reaches into it from the right edge (--cr): the view then looks at the middle of what it leaves,
// the stage, and the board is fitted to it, to its whole height (the action bar, over the bottom, is not made room for).
let framed = false;
export let fitZoom = 0.5; // worked out by resize
export const free = { w: 1 }; // the share of the canvas's width that the column leaves
export const frame = (on: boolean) => { if (on !== framed) { framed = on; resize(); } }; // a game begins, or ends

function resize() {
  const cv = renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return; // squeezed out of the page: it keeps the size it had
  PX = hd.on ? 1 / Math.max(1, Math.min(devicePixelRatio, Math.sqrt(3.2e6 / (w * h)))) : 2; // HD-2D: the screen's own pixels, as many as the passes can afford (about 3.2 million)
  renderer.setPixelRatio(1 / PX);
  renderer.setSize(w, h, false); // the page sizes the canvas (see style.css): the window, or what the panels leave of it
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (hd.on) { rt.setSize(1, 1); hdMod?.resize(buf.x, buf.y); } else rt.setSize(buf.x, buf.y);
  texel.set(1 / buf.x, 1 / buf.y);
  const a = buf.x / buf.y; // the buffer's aspect, not the canvas's (it is rounded down): a world unit is then as many pixels across as down, which the pixel-exact lettering relies on
  Object.assign(camera, { left: -VIEW_H * a / 2, right: VIEW_H * a / 2, top: VIEW_H / 2, bottom: -VIEW_H / 2 });
  const cr = framed ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cr')) || 0 : 0; // how far the column reaches in, CSS px
  free.w = 1 - cr / w;
  camera.setViewOffset(buf.x, buf.y, Math.round(cr / 2 / PX), 0, buf.x, buf.y); // the canvas's middle moves left by half of what is covered, in whole buffer pixels (see snap)
  lensView.splice(0, 3, buf.x, buf.y, Math.round(cr / 2 / PX));
  const wide = hd.on ? NEAR : 1; // the lens makes the board's foot wider: it needs that much more room across
  fitZoom = cr ? (VIEW_H / (52 * BOARD_K)) * Math.min((a * free.w) / wide, 1 / Math.sin(ELEV)) : Math.min(1, (a * VIEW_H) / 52 / wide) / BOARD_K;
  controls.minZoom = fitZoom;
  if (hd.on) lens();
}

// Smooth "go look at X" camera goal; any user drag/zoom cancels it. 'fit' is the whole board, whatever the canvas and the panels are: the view follows it as they change.
// `view` (degrees) also asks the camera to swing round to an azimuth and elevation while it goes: kept like `zoom` until a drag, an orbit or a jump says otherwise.
let goal: { x: number; z: number; zoom?: number | 'fit'; view?: { az: number; elev: number } } | null = null;
controls.addEventListener('start', () => (goal = null));
export const focus = (x: number, z: number, zoom?: number | 'fit', view?: { az: number; elev: number }) =>
  (goal = { x, z, zoom: zoom ?? goal?.zoom, view: view ?? goal?.view });
// Held pan keys slide the view over the board (stage.ts binds WASD and the arrows): `x` right, `y` up the screen,
// whatever the azimuth, at about the visible height a second — zoomed out it crosses more ground. Held, they cancel
// any "go look at" goal, as a drag would.
export const pan = { x: 0, y: 0 };

export function updateCamera(dt: number) {
  const t = controls.target;
  if (pan.x || pan.y) {
    goal = null;
    const a = Math.atan2(camera.position.x - t.x, camera.position.z - t.z), n = Math.hypot(pan.x, pan.y), v = (0.9 * dt * VIEW_H) / (camera.zoom * n);
    const dx = (pan.x * Math.cos(a) - pan.y * Math.sin(a)) * v, dz = -(pan.x * Math.sin(a) + pan.y * Math.cos(a)) * v;
    t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz;
  }
  const cx = THREE.MathUtils.clamp(t.x, -45 * BOARD_K, 45 * BOARD_K), cz = THREE.MathUtils.clamp(t.z, -30 * BOARD_K, 30 * BOARD_K); // keep the board in reach
  if (cx !== t.x || cz !== t.z) { camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.set(cx, t.y, cz); }
  if (goal) {
    const k = 1 - Math.pow(0.003, dt), dx = (goal.x - t.x) * k, dy = -t.y * k, dz = (goal.z - t.z) * k; // the view also comes down to the ground (the title orbits the globe in the air)
    t.x += dx; t.y += dy; t.z += dz; camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
    if (goal.zoom) { camera.zoom += ((goal.zoom === 'fit' ? fitZoom : goal.zoom) - camera.zoom) * k; camera.updateProjectionMatrix(); }
    if (goal.view) { // the orbit keeps its distance; only the facing moves, taking the short way round to the asked azimuth
      const off = camera.position.clone().sub(t), L = off.length(), a0 = Math.atan2(off.x, off.z), e0 = Math.atan2(off.y, Math.hypot(off.x, off.z));
      const a1 = THREE.MathUtils.degToRad(goal.view.az), e1 = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(goal.view.elev, 22, 68)); // the controls' tilt limits
      const a = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * k, e = e0 + (e1 - e0) * k;
      camera.position.set(t.x + Math.sin(a) * Math.cos(e) * L, t.y + Math.sin(e) * L, t.z + Math.cos(a) * Math.cos(e) * L);
    }
  }
  controls.update();
  lod.n = levelNow(); // when the texel size crosses a threshold, the other level's art is drawn from this frame on
  daylight();
  fitShadow();
  if (hd.on) lens();
}

// The title's view: the camera looks at a point `lift` above the ground (the globe), and the first focus brings it back down.
export function overview(lift: number) {
  goal = null; // the orbit is its own motion: nothing left over from a game should pull it
  controls.target.set(0, lift, 0);
  camera.position.set(0, Math.sin(ELEV) * 150 + lift, Math.cos(ELEV) * 150);
  camera.zoom = 1.1;
  camera.updateProjectionMatrix();
}

/** Where the camera stands round its target: elevation above the ground and azimuth, in degrees. */
export function viewAngles() {
  const off = camera.position.clone().sub(controls.target), r = Math.hypot(off.x, off.z);
  return { elev: THREE.MathUtils.radToDeg(Math.atan2(off.y, r)), az: THREE.MathUtils.radToDeg(Math.atan2(off.x, off.z)) };
}

/** Put the camera on `(x, lift, z)` at once, with no tween or damping lag, and mark shadows to redraw. */
export function jumpTo(x: number, z: number, zoom: number | 'fit' = camera.zoom, elev = THREE.MathUtils.radToDeg(ELEV), az = 0, lift = 0) {
  goal = null;
  const el = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az), h = Math.cos(el) * 150;
  controls.target.set(x, lift, z);
  camera.position.set(x + Math.sin(a) * h, lift + Math.sin(el) * 150, z + Math.cos(a) * h);
  camera.zoom = THREE.MathUtils.clamp(zoom === 'fit' ? fitZoom : zoom, controls.minZoom, controls.maxZoom);
  camera.updateProjectionMatrix();
  const damp = controls.enableDamping;
  controls.enableDamping = false;
  updateCamera(0);
  controls.enableDamping = damp;
  dirtyShadow();
}

// Orbit to an axis-aligned azimuth, where the tiles face the camera squarely. pickY may also lift the camera back to a height
// (resetView restores the default ELEV pitch after a free drag; rotateView keeps the height it has).
const Q = Math.PI / 2;
function orbitTo(pickAngle: (a: number) => number, pickY: (r: number, y: number) => number = (_r, y) => y) {
  if (goal) goal.view = undefined; // an explicit orbit takes the camera's facing back from a goal's view
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

// ---- Tweens (promise based, driven by the main loop) ----
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
interface Tween { t: number; dur: number; fn: (k: number) => void; ease: (t: number) => number; res: () => void }
const tweens = new Set<Tween>();
export const pace = { speed: 1 }; // how many times faster than designed the tweens run (and the cards' timers, see dialogs): the director raises it when the screen is far behind the game
// A visible but occluded window gets no frames at all (the OS pauses the loop with no visibilitychange): a tween would wait on one forever, the
// director's queue piling up behind it. While tweens wait, a watchdog finishes them when no frame has run for a second.
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
export const wait = (s: number) => tween(s, still); // moves nothing, so it is no reason to draw the shadows again
export function updateTweens(dt: number) {
  lastFrame = performance.now();
  for (const tw of tweens) {
    tw.t = Math.min(1, tw.t + (dt * pace.speed) / tw.dur);
    tw.fn(tw.ease(tw.t));
    if (tw.fn !== still) dirtyShadow();
    if (tw.t >= 1) { tweens.delete(tw); tw.res(); }
  }
}

// A hidden tab draws no frames: its tweens end at once (and new ones are over before they start), so the game is not held up by animations nobody sees.
export function finishTweens() {
  for (const tw of tweens) { tw.fn(tw.ease(1)); tw.res(); }
  tweens.clear();
  dirtyShadow();
}

// ---- Picking & projection ----
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// The index of the nearest of `objects` under the point (x, y) of the window, or -1. Only they are tested, not their children: pass plain shapes (the tiles' slabs), not the models standing on them.
export function pick(x: number, y: number, objects: THREE.Object3D[]) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, hd.on ? hdCam : camera);
  const hit = ray.intersectObjects(objects, false)[0]?.object;
  return hit ? objects.indexOf(hit) : -1;
}
/** Where a world point is on the canvas, as a fraction of it across and down. */
export function toScreen(v: THREE.Vector3): [number, number] {
  const p = v.clone().project(hd.on ? hdCam : camera);
  return [(p.x + 1) / 2, (1 - p.y) / 2];
}

// ---- Lights ----
const hemi = new THREE.HemisphereLight(); // the light of the sky
// Full daylight in each look, restrained then HD-2D: the hemisphere's sky colour, ground colour and intensity, the sun's colour and intensity (HD-2D: a cool sky over a warm bounce, a low warm sun).
// The light of the hour (sky.ts) is a share of it, so at midday each look is what it always was.
const DAYLIGHT = [[0xd8ecff, 0x56648a, 1.6, 0xfff0d0, 2.4], [0xa9c4ff, 0x6b5a58, 1.1, 0xffe0b0, 3.4]];
// The sun stands where the clock puts it (sky.ts), fixed in the world like the tiles: the camera turns round it, so each side shows its own light and shadow. By night this light is the moon's.
const SUN_AT = 100 * BOARD_K; // how far it stands from the view target
export const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { near: 1, far: 220 * BOARD_K });
sun.shadow.bias = -0.0006 / BOARD_K;
sun.shadow.normalBias = 0.04; // walls facing the camera lie along the light's rays: nudge their lookups off the wall, or the shadow map speckles them

// Shadow texels match ground texels: 4096 of them span ~190 x 150 world units, so the shadow frustum follows the view target (snapped to whole shadow
// texels, so shadows never crawl) and only doubles when the visible ground would spill over its edge (far zoomed out, where a shadow texel is a
// fraction of a screen pixel anyway). The frustum is as tall, in the light's own view, as the ground it covers is deep times the sine of the light's elevation: that is what makes a texel square
// on the ground. It is not made lower than LOW of its width, or a tower would stand out of it when the sun is low.
const LOW = 0.3;
const SUN_X = new THREE.Vector3(), SUN_Y = new THREE.Vector3(), drawn = new THREE.Vector3(); // the light's axes (across it along the horizon, and up its view), and the light as the shadow map was last drawn for it
let shadowScale = 0, shadowX = 0, shadowY = 0, shadowH = 1; // the frustum's size and its texel on the lattice, as the shadow map was last drawn for them, and its height as a share of its width
function fitShadow() {
  const L = sky.light, turned = !L.equals(drawn); // the sun has moved a step: the light's axes turn with it, and the map is drawn again
  if (turned) {
    drawn.copy(L);
    SUN_X.set(L.z, 0, -L.x).normalize(); SUN_Y.crossVectors(L, SUN_X);
    shadowH = Math.max(L.y, LOW);
  }
  const t = controls.target, off = camera.position.clone().sub(t), half = 2048 / DENSITY;
  const reach = (Math.hypot(camera.right - camera.left, ((camera.top - camera.bottom) * off.length()) / off.y) / (2 * camera.zoom)) * (hd.on ? 1.3 : 1); // radius of the visible ground (the lens sees more of it far up the screen)
  const s = reach > half ? 2 : 1, tx = s / DENSITY, ty = tx * shadowH, x = t.dot(SUN_X), y = t.dot(SUN_Y), i = Math.round(x / tx), j = Math.round(y / ty);
  if (turned || s !== shadowScale || i !== shadowX || j !== shadowY) { // turned, resized, or on another texel: the map is drawn again (within a texel, or along the light, it would come out the same)
    if (turned || s !== shadowScale) {
      Object.assign(sun.shadow.camera, { left: -half * s, right: half * s, top: half * s * shadowH, bottom: -half * s * shadowH });
      sun.shadow.camera.updateProjectionMatrix();
    }
    [shadowScale, shadowX, shadowY] = [s, i, j];
    dirtyShadow();
  }
  U.uSh.value.set(sun.shadow.camera.far - sun.shadow.camera.near, tx); // for the soft shadows (HD-2D)
  sun.target.position.copy(t).addScaledVector(SUN_X, i * tx - x).addScaledVector(SUN_Y, j * ty - y);
  sun.position.copy(sun.target.position).addScaledVector(L, SUN_AT);
}

// The light of the hour: the sky of sky.ts, as a share of the look's full daylight
function daylight() {
  updateSky();
  const [skyC, groundC, skyI, sunC, sunI] = DAYLIGHT[+hd.on];
  hemi.color.set(skyC).multiply(sky.skyC); hemi.groundColor.set(groundC).multiply(sky.skyC); hemi.intensity = skyI * sky.skyK;
  sun.color.set(sunC).multiply(sky.lightC); sun.intensity = sunI * sky.lightK;
  U.uLamp.value = sky.lampK;
  (scene.background as THREE.Color).copy(sky.horizon);
}

// ---- The look of the light: the restrained pixel look above, or HD-2D (light.ts for the materials and the lamps, hd2d.ts for the passes, which loads the first time it is asked for) ----
let hdMod: typeof import('./hd2d') | null = null, wanted = false;
function look(on: boolean) {
  hd.on = on; U.uHd.value = +on;
  setLamps(on);
  for (const o of movers) o.castShadow = on;
  renderer.domElement.style.imageRendering = on ? 'auto' : ''; // the restrained look is magnified with nearest-neighbour (see style.css)
  resize(); // the buffer takes its other size
  dirtyShadow();
  if (!on) hdMod?.release();
}
// The chains of every lit material (see lodMap) are made and uploaded before HD-2D is switched on: made in its first frame they stall it for over a second. A few ms at a time, like the levels, but not in the idle time, which a page
// that draws has too little of (the wait would be seconds). The GPU is the slow part (it draws the canvases as it takes them in), so each slice waits for a fence: it is never more than a slice behind, and the switch has no backlog to wait out.
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

// ---- Life cycle: what the module does to the page is done here, not on import, and the function it returns undoes it (the page keeps the renderer, see above) ----
// What the GPU holds for a tree of objects: their geometries and the textures of their materials. Whatever is drawn again later (a retained cache) is uploaded again.
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
  renderer.shadowMap.type = THREE.BasicShadowMap; // hard, stair-stepped shadows
  renderer.shadowMap.autoUpdate = false;
  controls.connect(renderer.domElement);
  scene.add(hemi, sun, sun.target, ...lamps, spot, spot.target);
  daylight();
  renderer.domElement.style.width = renderer.domElement.style.height = ''; // the page sizes the canvas (see resize): drop a size that an older hot update gave it
  const fit = new ResizeObserver(() => { resize(); render(); }); // a resized canvas is blank until it is drawn again, and the next frame may not be this one
  fit.observe(renderer.domElement);
  resize();
  return () => {
    fit.disconnect();
    controls.disconnect();
    finishTweens();
    goal = null;
    later.length = 0;
    look(false); // the page starts again from the restrained look (the stage asks for HD-2D again if it is wanted)
    disposeTree(scene);
    scene.clear();
    for (const o of [rt, post.geometry, post.material, sun.shadow]) o.dispose();
  };
}
