import * as THREE from 'three';
import { PLAYER_DEFS, TILES, maxLevel } from '../shared/data';
import type { GameState, Owned } from '../shared/types';
import { addToken, clearTokens, initActors, placeAt, setActive, tokens, updateActors } from './render/actors';
import { createBoard } from './render/board';
import { POS } from './render/layout';
import { camera, controls, finishTweens, focus, frame, initScene, overview, pan, pick, render, renderer, resetView, rotateView, setLighting, toScreen, updateCamera, updateTweens } from './render/scene';
import { strike } from './render/strike';
import { FLOAT, initWorld, updateWorld } from './render/world';
import { SEED, SEED_AT } from './seed';
import { G, activeTab, hd2d, hudLive, selectedTile, tip } from './store';

// The 3D side: the board, the tokens and the camera. The frame loop runs for the whole life of the page (or until a hot update, see initStage).
let board: ReturnType<typeof createBoard>;
export const cam = { follow: -1 }; // the player the camera tracks (-1: free)
export const loop = { paused: false, scale: 1, time: 0, step: (_dt: number) => {}, scrub: (_t: number) => {}, draw: () => {} }; // dev: pause, slow or step the world's clock while keeping the camera live

// ---- The board and its tokens ----
export const setOwner = (i: number, o: Owned | null, S: GameState) => board.setOwner(i, o && { color: S.players[o.p].color, lv: o.lv, m: o.m });
// Dev previews of ownership, with no room and no turn: who owns the lot (a player index, none: vacant), its level, mortgaged, and whether the SALE sign stands on a vacant one.
export const setLot = (i: number, o: { p?: number; lv?: number; m?: boolean; sign?: boolean } | null) =>
  board.setOwner(i, o?.p === undefined || o.p < 0 ? null : { color: PLAYER_DEFS[o.p].color, lv: o.lv ?? 0, m: !!o.m }, { sign: o?.sign });
export const rebuildTile = (i: number) => board.rebuild(i);
export const isolateTile = (i: number | null) => board.isolate(i);
export async function playStrike(from: number, to: number) {
  const start = board.launcher(from, false);
  try { await strike(from, to, start, board.impact(to)); }
  finally { board.launcher(from, true); }
}
const eachLot = (f: (i: number) => void) => TILES.forEach((t) => t.type !== 'public' && f(t.i));

/** The board and tokens as the state has them (a new game, or a snapshot). */
export function showState(S: GameState) {
  clearTokens();
  S.players.forEach((p, i) => {
    if (p.out) return;
    const t = addToken(i, p.color, p.tile);
    if (p.jail) { t.jailed = true; placeAt(t, p.tile); }
  });
  eachLot((i) => setOwner(i, S.own[i] ?? null, S));
  setActive(S.order[S.turn]);
  board.select(-1);
  board.hover(-1);
}

/** The title's and the lobby's board: lived in, four tokens, the camera slowly orbiting the globe. */
export function enterDemo() {
  clearTokens();
  PLAYER_DEFS.forEach((p, i) => addToken(i, p.color, SEED_AT[i]));
  eachLot((i) => {
    const [p, lv, m] = SEED[i] ?? [-1, 0];
    board.setOwner(i, p < 0 ? null : { color: PLAYER_DEFS[p].color, lv: Math.min(lv, maxLevel(TILES[i])), m: !!m });
  });
  board.select(-1);
  cam.follow = -1;
  Object.assign(controls, { autoRotate: true, autoRotateSpeed: 0.5 });
  frame(false);
  overview(FLOAT); // the camera orbits the globe itself, which stays in the middle of the screen
}

export function enterGame() {
  controls.autoRotate = false;
  cam.follow = -1;
  frame(true);
  resetView();
  focus(0, 0, 'fit');
}

// ---- Camera ----
export const focusTok = (pi: number, zoom = 2) => {
  const t = tokens[pi];
  if (!t) return;
  cam.follow = pi;
  focus(t.g.position.x, t.g.position.z, zoom);
};
const lookAt = (x: number, z: number, zoom: number | 'fit' = 2) => { cam.follow = -1; focus(x, z, zoom); };
const zoom = (k: number) => lookAt(controls.target.x, controls.target.z, THREE.MathUtils.clamp(camera.zoom * k, controls.minZoom, controls.maxZoom));
export const CAM = {
  rotl: () => rotateView(-1), reset: () => resetView(), in: () => zoom(1.5), out: () => zoom(1 / 1.5),
  follow: () => focusTok(G.S!.order[G.S!.turn]), map: () => lookAt(0, 0, 'fit'),
};
export const lookAtTile = (i: number) => { selectTile(i); lookAt(POS[i].x, POS[i].z); };

export function selectTile(i: number) {
  selectedTile.set(i);
  activeTab.set('tile');
  board.select(i);
}

/** Where a token's floating numbers start, in the window; none when the token is off the canvas (the panels are over there). */
export function tokenSpot(pi: number): [number, number] | null {
  const t = tokens[pi];
  if (!t) return null;
  const [fx, fy] = toScreen(new THREE.Vector3(t.g.position.x, t.g.position.y + 3.8, t.g.position.z)), r = renderer.domElement.getBoundingClientRect();
  return fx < 0 || fx > 1 || fy < 0 || fy > 1 ? null : [r.left + fx * r.width, r.top + fy * r.height];
}

// ---- The page ----
/** Binds the pointer until `signal` aborts; returns the per-frame step that finds the tile under it. */
function bindCanvas(signal: AbortSignal) {
  const cv = renderer.domElement;
  let down: [number, number] | null = null, moved: [number, number] | null = null; // moved: where the pointer went since the last frame, picked then (once, however many moves came)
  const hover = (i: number, x = 0, y = 0) => { board.hover(i); cv.classList.toggle('hot', i >= 0); tip.set(i >= 0 ? { i, x, y } : null); };
  cv.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]), { signal });
  cv.addEventListener('pointerup', (e) => {
    if (hudLive.get() && down && e.button === 0 && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) selectTile(pick(e.clientX, e.clientY, board.slabs));
    down = null;
  }, { signal });
  cv.addEventListener('pointermove', (e) => { if (hudLive.get() && !e.buttons) moved = [e.clientX, e.clientY]; else { moved = null; hover(-1); } }, { signal });
  cv.addEventListener('pointerleave', () => { moved = null; hover(-1); }, { signal });
  return () => {
    if (!moved) return;
    const [x, y] = moved;
    moved = null;
    hover(pick(x, y, board.slabs), x, y);
  };
}

/** WASD and the arrow keys: held, they slide the view over the board (`pan` in scene.ts, stepped each frame by updateCamera);
 * a press, like a drag, drops the follow and the "go look at" goal. Not on the orbiting title, nor while typing. */
const PAN_KEYS: Record<string, [number, number]> = { KeyW: [0, 1], KeyA: [-1, 0], KeyS: [0, -1], KeyD: [1, 0], ArrowUp: [0, 1], ArrowLeft: [-1, 0], ArrowDown: [0, -1], ArrowRight: [1, 0] };
const held = new Set<string>(), rePan = () => { pan.x = pan.y = 0; for (const k of held) { pan.x += PAN_KEYS[k][0]; pan.y += PAN_KEYS[k][1]; } };
function bindPan(signal: AbortSignal) {
  addEventListener('keydown', (e) => {
    const k = e.code;
    if (!(k in PAN_KEYS) || controls.autoRotate || (e.target as HTMLElement).matches('input, textarea, select')) return;
    e.preventDefault(); // arrows, lest they scroll
    if (held.has(k)) return; // an auto-repeat: the direction it adds is already in
    held.add(k); rePan();
    controls.dispatchEvent({ type: 'start' });
  }, { signal });
  addEventListener('keyup', (e) => { if (held.delete(e.code)) rePan(); }, { signal });
  addEventListener('blur', () => { held.clear(); rePan(); }, { signal });
}

/**
 * Puts the stage on the page: the 3D world, the pointer and the frame loop. Returns what takes it all down again, whole or as far as it got, so that a
 * hot update can put a new stage in its place. A game under way is shown again as the screen had it (the server's snapshot, which follows, brings it up to date).
 */
export function initStage() {
  const undo: (() => void)[] = [], dispose = () => undo.splice(0).reverse().forEach((f) => f()); // last made, first undone, once
  try {
    undo.push(initScene());
    undo.push(hd2d.sub(() => void setLighting(hd2d.get())));
    void setLighting(hd2d.get()); // the look of the light the player chose (HD-2D loads when it is first wanted)
    initWorld(); initActors();
    board = createBoard();
    if (G.S) { showState(G.S); enterGame(); } else enterDemo();
    const off = new AbortController(), unfollow = () => (cam.follow = -1), hoverStep = bindCanvas(off.signal);
    bindPan(off.signal);
    controls.addEventListener('start', unfollow);
    let last = 0, t = 0; // the frame clock: `t` is only ever fed bounded steps, so a stalled loop cannot leap the world forward
    const advance = (dt: number) => { t += dt; loop.time = t; updateTweens(dt); updateWorld(t, dt); updateActors(t, dt); board.update(t, dt); };
    const draw = (camDt = 0) => {
      if (cam.follow >= 0 && tokens[cam.follow]) { const p = tokens[cam.follow].g.position; focus(p.x, p.z); }
      updateCamera(camDt);
      board.labels();
      render();
    };
    loop.draw = () => draw(0);
    loop.step = (dt: number) => { advance(Math.max(0, dt)); draw(0); };
    loop.scrub = (T: number) => { t = T; advance(0); draw(0); }; // seek the world clock outright: `tick`-driven parts pose at t, tweens are only stepped (see step/strike)
    document.addEventListener('visibilitychange', () => { if (document.hidden) { finishTweens(); last = 0; } }, { signal: off.signal }); // a hidden tab draws no frames: its animations end at once, and it comes back to a zero step, not one huge one
    undo.push(() => { off.abort(); controls.removeEventListener('start', unfollow); held.clear(); rePan(); loop.step = loop.draw = () => {}; });
    renderer.setAnimationLoop((now) => {
      const raw = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      hoverStep(); // against the frame just drawn, before the board reacts to it
      advance(loop.paused ? 0 : raw * loop.scale);
      draw(raw);
    });
    undo.push(() => renderer.setAnimationLoop(null));
    return dispose;
  } catch (e) {
    dispose();
    throw e;
  }
}
