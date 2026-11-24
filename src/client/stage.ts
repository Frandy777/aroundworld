import * as THREE from 'three';
import { PLAYER_DEFS, TILES, maxLevel } from '../shared/data';
import type { GameState, Owned } from '../shared/types';
import { playTileHover, playTileSelect } from './audio';
import { addToken, clearTokens, initActors, placeAt, setActive, tokens, updateActors } from './render/actors';
import { createBoard } from './render/board';
import { POS } from './render/layout';
import { camera, controls, finishTweens, focus, frame, initScene, overview, pan, pick, render, renderer, resetView, toScreen, updateCamera, updateTweens } from './render/scene';
import { strike } from './render/strike';
import { FLOAT, initWorld, updateWorld } from './render/world';
import { DEMO_LOTS, DEMO_TOKEN_TILES } from './seed';
import { G, activeTab, autoFocus, hoveredTileTip, hudLive, selectedTile } from './store';

let board: ReturnType<typeof createBoard>;
export const cam = { follow: -1 };
export const loop = { paused: false, scale: 1, time: 0, step: (_dt: number) => {}, scrub: (_t: number) => {}, draw: () => {} };

export const setOwner = (i: number, o: Owned | null, S: GameState) => board.setOwner(i, o && { color: S.players[o.owner].color, level: o.level, mortgaged: o.mortgaged });
export const setLot = (i: number, lot: { owner?: number; level?: number; mortgaged?: boolean; sign?: boolean } | null) =>
  board.setOwner(i, lot?.owner === undefined || lot.owner < 0 ? null : { color: PLAYER_DEFS[lot.owner].color, level: lot.level ?? 0, mortgaged: !!lot.mortgaged }, { sign: lot?.sign });
export const rebuildTile = (i: number) => board.rebuild(i);
export const isolateTile = (i: number | null) => board.isolate(i);
export async function playStrike(from: number, to: number) {
  const start = board.launcher(from, false);
  try { await strike(from, to, start, board.impact(to)); }
  finally { board.launcher(from, true); }
}
const eachLot = (f: (i: number) => void) => TILES.forEach((t) => t.type !== 'public' && f(t.i));

export function showState(S: GameState) {
  clearTokens();
  S.players.forEach((p, i) => {
    if (p.bankruptRound) return;
    const t = addToken(i, p.color, p.tile);
    if (p.jail) { t.jailed = true; placeAt(t, p.tile); }
  });
  eachLot((i) => setOwner(i, S.ownedByTile[i] ?? null, S));
  setActive(S.turnOrder[S.turnIndex]);
  board.select(-1);
  board.hover(-1);
}

export function enterDemo() {
  clearTokens();
  PLAYER_DEFS.forEach((p, i) => addToken(i, p.color, DEMO_TOKEN_TILES[i]));
  eachLot((i) => {
    const [owner, level, mortgaged] = DEMO_LOTS[i] ?? [-1, 0];
    board.setOwner(i, owner < 0 ? null : { color: PLAYER_DEFS[owner].color, level: Math.min(level, maxLevel(TILES[i])), mortgaged: !!mortgaged });
  });
  board.select(-1);
  cam.follow = -1;
  Object.assign(controls, { autoRotate: true, autoRotateSpeed: 0.5 });
  frame(false);
  overview(FLOAT);
}

export function enterGame() {
  controls.autoRotate = false;
  cam.follow = -1;
  frame(true);
  const cur = G.S!.turnOrder[G.S!.turnIndex];
  if (autoFocus.get() && tokens[cur]) focusTok(cur);
  else { resetView(); focus(0, 0, 'fit'); }
}

const FOCUS_VIEW = { az: 45, elev: 20 };
export const focusTok = (pi: number, zoom = 2) => {
  const t = tokens[pi];
  if (!t) return;
  cam.follow = pi;
  focus(t.g.position.x, t.g.position.z, zoom, FOCUS_VIEW);
};
const lookAt = (x: number, z: number, zoom: number | 'fit' = 2) => { cam.follow = -1; focus(x, z, zoom); };
const zoom = (k: number) => lookAt(controls.target.x, controls.target.z, THREE.MathUtils.clamp(camera.zoom * k, controls.minZoom, controls.maxZoom));
export const CAM = {
  in: () => zoom(1.5), out: () => zoom(1 / 1.5),
  follow: () => focusTok(G.S!.turnOrder[G.S!.turnIndex]), map: () => { resetView(); lookAt(0, 0, 'fit'); },
};
export const lookAtTile = (i: number) => { selectTile(i); lookAt(POS[i].x, POS[i].z); };

export function selectTile(i: number) {
  selectedTile.set(i);
  activeTab.set('tile');
  board.select(i);
  if (i >= 0) playTileSelect(i);
}

export function tokenSpot(pi: number): [number, number] | null {
  const t = tokens[pi];
  if (!t) return null;
  const [fx, fy] = toScreen(new THREE.Vector3(t.g.position.x, t.g.position.y + 3.8, t.g.position.z)), r = renderer.domElement.getBoundingClientRect();
  return fx < 0 || fx > 1 || fy < 0 || fy > 1 ? null : [r.left + fx * r.width, r.top + fy * r.height];
}

function bindCanvas(signal: AbortSignal) {
  const cv = renderer.domElement;
  let down: [number, number] | null = null, moved: [number, number] | null = null;
  const hover = (i: number, x = 0, y = 0) => {
    const prev = hoveredTileTip.get()?.tile ?? -1;
    if (i >= 0 && i !== prev) playTileHover(i);
    board.hover(i); cv.classList.toggle('hot', i >= 0); hoveredTileTip.set(i >= 0 ? { tile: i, x, y } : null);
  };
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

const PAN_KEYS: Record<string, [number, number]> = { KeyW: [0, 1], KeyA: [-1, 0], KeyS: [0, -1], KeyD: [1, 0], ArrowUp: [0, 1], ArrowLeft: [-1, 0], ArrowDown: [0, -1], ArrowRight: [1, 0] };
const held = new Set<string>(), rePan = () => { pan.x = pan.y = 0; for (const k of held) { pan.x += PAN_KEYS[k][0]; pan.y += PAN_KEYS[k][1]; } };
function bindPan(signal: AbortSignal) {
  addEventListener('keydown', (e) => {
    const k = e.code;
    if (!(k in PAN_KEYS) || controls.autoRotate || (e.target as HTMLElement).matches('input, textarea, select')) return;
    e.preventDefault();
    if (held.has(k)) return;
    held.add(k); rePan();
    controls.dispatchEvent({ type: 'start' });
  }, { signal });
  addEventListener('keyup', (e) => { if (held.delete(e.code)) rePan(); }, { signal });
  addEventListener('blur', () => { held.clear(); rePan(); }, { signal });
}

export function initStage() {
  const undo: (() => void)[] = [], dispose = () => undo.splice(0).reverse().forEach((f) => f());
  try {
    undo.push(initScene());
    initWorld(); initActors();
    board = createBoard();
    if (G.S) { showState(G.S); enterGame(); } else enterDemo();
    const off = new AbortController(), unfollow = () => (cam.follow = -1), hoverStep = bindCanvas(off.signal);
    bindPan(off.signal);
    controls.addEventListener('start', unfollow);
    let last = 0, t = 0;
    const advance = (dt: number) => { t += dt; loop.time = t; updateTweens(dt); updateWorld(t, dt); updateActors(t, dt); board.update(t, dt); };
    const draw = (camDt = 0) => {
      if (cam.follow >= 0 && tokens[cam.follow]) { const p = tokens[cam.follow].g.position; focus(p.x, p.z); }
      updateCamera(camDt);
      board.labels();
      render();
    };
    loop.draw = () => draw(0);
    loop.step = (dt: number) => { advance(Math.max(0, dt)); draw(0); };
    loop.scrub = (T: number) => { t = T; advance(0); draw(0); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { finishTweens(); last = 0; } }, { signal: off.signal });
    undo.push(() => { off.abort(); controls.removeEventListener('start', unfollow); held.clear(); rePan(); loop.step = loop.draw = () => {}; });
    renderer.setAnimationLoop((now) => {
      const raw = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      hoverStep();
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
