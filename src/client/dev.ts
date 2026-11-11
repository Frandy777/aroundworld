import * as THREE from 'three';
import { TILES } from '../shared/data';
import { command } from '../shared/state';
import type { Cmd } from '../shared/types';
import { leaveRoom, quickGame } from './controller';
import { POS } from './render/layout';
import { U, hd } from './render/light';
import { camera, controls, dirtyShadow, finishTweens, fitZoom, hdCam, jumpTo, lod, renderer, scene, setLighting, viewAngles } from './render/scene';
import { clock, sky, wallHour } from './render/sky';
import { FLOAT } from './render/world';
import { cam, loop, playStrike, selectTile } from './stage';
import { G, actionBtn, hd2d, session, stageOnly } from './store';

// ---- Dev bridge (development builds only, loaded from main.tsx) ----
// URL flags set the stage on boot (?dev=1&hd=1&hour=0&tile=1&zoom=2&autostart=1&clean=1&ui=0);
// `window.__aw` gives scripts and browser tools one live handle to drive the scene without clicking UI or fighting HMR module copies.

export interface ViewOpts {
  tile?: number;
  select?: boolean;
  x?: number;
  z?: number;
  lift?: number;
  zoom?: number | 'fit';
  elev?: number;
  az?: number;
  rotate?: boolean;
  hd?: boolean;
  hour?: number | null; // 0..24 freezes the clock there; null returns to live wall time
  clean?: boolean; // hide Title / Lobby / HUD chrome while keeping the DEV button
  ui?: boolean; // false hides #root altogether for bare-canvas captures
}

const mod24 = (h: number) => ((h % 24) + 24) % 24;
const num = (v: string | null) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : undefined);
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const kept: { booted?: boolean } = import.meta.hot?.data ?? {};

/** Runs once before `initStage()` and `boot()` so initial look, clock and room flags take effect before the first frame or socket. */
export function preBoot() {
  if (kept.booted) return;
  const q = new URLSearchParams(location.search);
  if (q.get('fresh') === '1' || q.get('autostart') === '1' || q.has('bots')) sessionStorage.removeItem('room');
  if (q.has('hd')) hd2d.set(q.get('hd') === '1');
  const h = num(q.get('hour'));
  if (h !== undefined) clock.stop = mod24(h);
  if (q.get('clean') === '1') stageOnly.set(true);
  if (q.get('ui') === '0') document.getElementById('root')!.hidden = true;
  const sp = num(q.get('speed'));
  if (sp !== undefined) loop.scale = Math.max(0, sp);
  if (q.get('paused') === '1') loop.paused = true;
}

async function setView(opts: ViewOpts = {}) {
  if (opts.clean !== undefined) stageOnly.set(opts.clean);
  if (opts.ui !== undefined) document.getElementById('root')!.hidden = !opts.ui;
  if (opts.hd !== undefined) { hd2d.set(opts.hd); await setLighting(opts.hd); }
  if (opts.hour !== undefined) {
    clock.stop = opts.hour === null ? null : mod24(opts.hour);
    if (opts.hour === null) clock.shift = 0;
    dirtyShadow();
  }
  const spatial = opts.tile !== undefined || opts.x !== undefined || opts.z !== undefined || opts.lift !== undefined || opts.zoom !== undefined || opts.elev !== undefined || opts.az !== undefined;
  if (spatial) {
    cam.follow = -1;
    if (opts.rotate === undefined) controls.autoRotate = false;
    let tx = opts.x ?? controls.target.x, tz = opts.z ?? controls.target.z;
    let lift = opts.lift ?? (opts.tile !== undefined || opts.x !== undefined || opts.z !== undefined || opts.zoom !== undefined ? 0 : controls.target.y);
    if (opts.tile !== undefined) {
      const i = THREE.MathUtils.clamp(Math.trunc(opts.tile), 0, TILES.length - 1);
      tx = POS[i].x; tz = POS[i].z; lift = opts.lift ?? 0;
      if (opts.select) selectTile(i);
    }
    const cur = viewAngles();
    jumpTo(tx, tz, opts.zoom ?? camera.zoom, opts.elev ?? cur.elev, opts.az ?? cur.az, lift);
  }
  if (opts.rotate !== undefined) controls.autoRotate = opts.rotate;
  finishTweens();
  dirtyShadow();
  loop.draw();
  await nextFrame();
}

function readState() {
  const { elev, az } = viewAngles(), t = controls.target, hour = clock.stop ?? mod24(wallHour() + clock.shift);
  return {
    view: session.get().view,
    look: hd.on ? 'hd2d' : 'pixel',
    hour: +hour.toFixed(3),
    zoom: +camera.zoom.toFixed(3),
    fitZoom: +fitZoom.toFixed(3),
    maxZoom: controls.maxZoom,
    lod: lod.n,
    lodName: (['far', 'mid', 'near'] as const)[lod.n] ?? 'init',
    target: { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) },
    elev: +elev.toFixed(2),
    az: +az.toFixed(2),
    autoRotate: controls.autoRotate,
    paused: loop.paused,
    scale: loop.scale,
    clean: stageOnly.get(),
    ui: !document.getElementById('root')!.hidden,
  };
}

function parseUrlView(): ViewOpts | null {
  const q = new URLSearchParams(location.search), opts: ViewOpts = {};
  const tile = num(q.get('tile')), x = num(q.get('x')), z = num(q.get('z')), lift = num(q.get('lift')), elev = num(q.get('elev')), az = num(q.get('az'));
  const zRaw = q.get('zoom'), zoom = zRaw === 'fit' ? 'fit' : num(zRaw);
  if (tile !== undefined) opts.tile = tile;
  if (x !== undefined) opts.x = x;
  if (z !== undefined) opts.z = z;
  if (lift !== undefined) opts.lift = lift;
  if (zoom !== undefined) opts.zoom = zoom;
  if (elev !== undefined) opts.elev = elev;
  if (az !== undefined) opts.az = az;
  if (q.has('rot')) opts.rotate = q.get('rot') === '1';
  return Object.keys(opts).length ? opts : null;
}

export function initDev() {
  const q = new URLSearchParams(location.search);
  const urlView = parseUrlView();
  const startBots = !kept.booted && (q.get('autostart') === '1' || q.has('bots')) ? (num(q.get('bots')) ?? 3) : null;
  kept.booted = true;

  const ready = (async () => {
    await setLighting(hd2d.get());
    if (startBots !== null) await quickGame(startBots);
    if (urlView) await setView(urlView);
    else { loop.draw(); await nextFrame(); }
  })();

  const api = {
    ready,
    state: readState,
    setView,
    setLook: (on: boolean) => setView({ hd: on }),
    setHour: (hour: number | null) => setView({ hour }),
    setClean: (clean: boolean) => setView({ clean }),
    setUi: (ui: boolean) => setView({ ui }),
    setLoop: (opts: { paused?: boolean; scale?: number }) => {
      if (opts.paused !== undefined) loop.paused = opts.paused;
      if (opts.scale !== undefined) loop.scale = Math.max(0, opts.scale);
      loop.draw();
    },
    step: async (dt: number) => { loop.step(dt); await nextFrame(); },
    overview: () => setView({ x: 0, z: 0, lift: FLOAT, zoom: 1.1, elev: THREE.MathUtils.radToDeg(52 * Math.PI / 180), az: 0 }),
    strike: async (from = 6, to = 28, atTime?: number) => {
      if (atTime === undefined) { await playStrike(from, to); return; }
      finishTweens();
      loop.paused = true;
      void playStrike(from, to);
      loop.step(atTime);
      await nextFrame();
    },
    quickGame,
    leaveRoom,
    cmd: (c: Cmd) => {
      const run = actionBtn.get()?.reply, S = G.S;
      if (!run || !S || !command(S, c)) return false;
      run(c);
      return true;
    },
    snapDataUrl: () => (loop.draw(), renderer.domElement.toDataURL('image/png')),
    refs: { G, TILES, POS, clock, sky, U, camera, hdCam, controls, renderer, scene, loop },
  };
  (window as unknown as { __aw?: typeof api }).__aw = api;
  return () => { delete (window as unknown as { __aw?: typeof api }).__aw; };
}
