import * as THREE from 'three';
import { PLAYER_DEFS, TILES, maxLevel } from '../shared/data';
import type { GameState, Owned } from '../shared/types';
import { addToken, clearTokens, placeAt, setActive, tokens, updateActors } from './render/actors';
import { POS, createBoard } from './render/board';
import { BOARD_K, camera, controls, finishTweens, focus, overview, pick, render, renderer, resetView, rotateView, toScreen, updateCamera, updateTweens } from './render/scene';
import { FLOAT, updateWorld } from './render/world';
import { SEED, SEED_AT } from './seed';
import { G, activeTab, hudLive, selectedTile, tip } from './store';
import { drawMinimap, invalidateMinimap } from './ui/minimap';

// The 3D side: the board, the tokens and the camera. The frame loop runs for the whole life of the page.
let board: ReturnType<typeof createBoard>;
let minimap: HTMLCanvasElement | null = null;
export const setMinimap = (c: HTMLCanvasElement | null) => (minimap = c);
export const cam = { follow: -1 }; // the player the camera tracks (-1: free)

// ---- The board and its tokens ----
export const setOwner = (i: number, o: Owned | null, S: GameState) => {
  board.setOwner(i, o && { color: S.players[o.p].color, lv: o.lv, m: o.m });
  invalidateMinimap(); // the minimap's chips show the owners
};
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
  Object.assign(controls, { autoRotate: true, autoRotateSpeed: 0.5, minZoom: 0.7 / BOARD_K });
  overview(FLOAT); // the camera orbits the globe itself, which stays in the middle of the screen
}

export function enterGame() {
  controls.autoRotate = false;
  cam.follow = -1;
  resetView();
  focus(0, 0, 1 / BOARD_K);
}

// ---- Camera ----
export const focusTok = (pi: number, zoom = 3) => {
  const t = tokens[pi];
  if (!t) return;
  cam.follow = pi;
  focus(t.g.position.x, t.g.position.z, zoom);
};
const lookAt = (x: number, z: number, zoom = 3) => { cam.follow = -1; focus(x, z, zoom); };
const zoom = (k: number) => lookAt(controls.target.x, controls.target.z, THREE.MathUtils.clamp(camera.zoom * k, 0.8 / BOARD_K, 6));
export const CAM = {
  rotl: () => rotateView(-1), rotr: () => rotateView(1), in: () => zoom(1.5), out: () => zoom(1 / 1.5),
  follow: () => focusTok(G.S!.order[G.S!.turn]), map: () => lookAt(0, 0, 1 / BOARD_K),
};
export const lookAtTile = (i: number) => { selectTile(i); lookAt(POS[i].x, POS[i].z); };
export const lookAtMap = (x: number, z: number) => lookAt(x, z, Math.max(camera.zoom, 2));

export function selectTile(i: number) {
  selectedTile.set(i);
  activeTab.set('tile');
  board.select(i);
}

/** Where a token's floating numbers start, on screen. */
export function tokenSpot(pi: number): [number, number] | null {
  const t = tokens[pi];
  return t && toScreen(new THREE.Vector3(t.g.position.x, t.g.position.y + 3.8, t.g.position.z));
}

// ---- The page ----
/** Binds the pointer; returns the per-frame step that finds the tile under it. */
function bindCanvas() {
  const cv = renderer.domElement;
  let down: [number, number] | null = null, moved: [number, number] | null = null; // moved: where the pointer went since the last frame, picked then (once, however many moves came)
  const hover = (i: number, x = 0, y = 0) => { board.hover(i); cv.classList.toggle('hot', i >= 0); tip.set(i >= 0 ? { i, x, y } : null); };
  cv.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  cv.addEventListener('pointerup', (e) => {
    if (hudLive.get() && down && e.button === 0 && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) selectTile(pick(e.clientX, e.clientY, board.slabs));
    down = null;
  });
  cv.addEventListener('pointermove', (e) => { if (hudLive.get() && !e.buttons) moved = [e.clientX, e.clientY]; else { moved = null; hover(-1); } });
  cv.addEventListener('pointerleave', () => { moved = null; hover(-1); });
  return () => {
    if (!moved) return;
    const [x, y] = moved;
    moved = null;
    hover(pick(x, y, board.slabs), x, y);
  };
}

export function initStage() {
  board = createBoard();
  const hoverStep = bindCanvas();
  enterDemo();
  controls.addEventListener('start', () => (cam.follow = -1));
  document.addEventListener('visibilitychange', () => document.hidden && finishTweens()); // a hidden tab draws no frames: its animations end at once
  const timer = new THREE.Timer();
  timer.connect(document); // a hidden tab comes back with a zero step, not one huge one
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1), t = timer.getElapsed();
    hoverStep(); // against the frame just drawn, before the board reacts to it
    updateTweens(dt); updateWorld(t, dt); updateActors(t, dt); board.update(t, dt);
    if (cam.follow >= 0 && tokens[cam.follow]) { const p = tokens[cam.follow].g.position; focus(p.x, p.z); }
    updateCamera(dt);
    if (hudLive.get() && G.S && minimap) {
      const el = Math.PI / 2 - controls.getPolarAngle();
      drawMinimap(minimap, G.S, tokens, { x: controls.target.x, z: controls.target.z, w: (camera.right - camera.left) / camera.zoom, h: (camera.top - camera.bottom) / camera.zoom / Math.sin(el) });
    }
    board.labels(hudLive.get());
    render();
  });
}
