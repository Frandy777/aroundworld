import * as THREE from 'three';
import { TILES } from '../shared/data';
import { command } from '../shared/state';
import type { Cmd } from '../shared/types';
import { AUDIO_AUDITIONS, auditionSound, renderAuditionPcm } from './audio';
import { leaveRoom, quickGame } from './controller';
import { busy } from './director';
import { send, socketReadyState } from './net';
import { LOT, PAD, POS } from './render/layout';
import { U } from './render/light';
import { camera, controls, dirtyShadow, finishTweens, fitZoom, jumpTo, lod, renderer, scene, viewAngles } from './render/scene';
import { clock, sky, wallHour } from './render/sky';
import { FLOAT } from './render/world';
import { SCENARIOS, runScenario, type SceneDrv } from './scenarios';
import { cam, isolateTile, loop, playStrike, rebuildTile, selectTile, setLot } from './stage';
import { G, actionBtn, cards, cardsSetAside, paused, session, stageOnly, waitingFor } from './store';

// ---- Dev bridge (development builds only, loaded from main.tsx) ----
// URL flags set the stage on boot (?dev=1&hour=0&tile=1&zoom=2&autostart=1&clean=1&ui=0);
// `window.__aw` gives scripts and browser tools one live handle to drive the scene without clicking UI or fighting HMR module copies;
// `until` / `idle` / `ui` / `click` / `cmd` (below) drive the HUD and cards the way a player does, with waits that follow the game instead of fixed sleeps.

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
  hour?: number | null; // 0..24 freezes the clock there; null returns to live wall time
  clean?: boolean; // hide Title / Lobby / HUD chrome while keeping the DEV button
  ui?: boolean; // false hides #root altogether for bare-canvas captures
}

const mod24 = (h: number) => ((h % 24) + 24) % 24;
const num = (v: string | null) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : undefined);
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const hmrData: { booted?: boolean } = import.meta.hot?.data ?? {};

/** Runs once before `initStage()` and `boot()` so initial look, clock and room flags take effect before the first frame or socket. */
export function preBoot() {
  if (hmrData.booted) return;
  const q = new URLSearchParams(location.search);
  if (q.get('fresh') === '1' || q.get('autostart') === '1' || q.has('bots') || q.has('scenario')) sessionStorage.removeItem('room');
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
    gamePaused: paused.get(),
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

// ---- Driving the UI from a script ----
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const label = (e: Element | null) => (e as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Where the page stands when a wait fails: enough to tell a dead ask from a frozen room (or the wrong window) in one error, with no further console queries. Every read is optional, so it still answers something on a bare title. */
function diag() {
  const S = G.S, me = G.myPlayer, who = waitingFor.get(), cur = S ? S.turnOrder[S.turnIndex] : -1, st = socketReadyState();
  const narrow = document.getElementById('narrow'), card = topCard();
  return {
    view: session.get().view,
    me: S && me >= 0 ? { pi: me, name: S.players[me]?.name, out: !!S.players[me]?.bankruptRound } : null,
    turn: S ? { round: S.round, step: S.step, pi: cur, name: S.players[cur]?.name } : null,
    over: !!S?.over,
    waiting: S && who >= 0 ? (S.players[who]?.name ?? who) : null,
    action: actionBtn.get()?.label ?? null,
    card: card ? { title: label(card.querySelector('.hd span')), buttons: [...card.querySelectorAll<HTMLElement>('.ft .btn')].map((b) => label(b)) } : null,
    aside: cardsSetAside.get(),
    busy: busy(),
    gamePaused: paused.get(),
    renderPaused: loop.paused,
    hidden: document.hidden,
    viewport: [innerWidth, innerHeight],
    narrow: !!(narrow && narrow.getClientRects().length),
    ws: ['connecting', 'open', 'closing', 'closed'][st] ?? 'none',
  };
}
/** The one-line failure scene appended to a driver's error; it never throws, so it can never swallow the real reason. */
const diagText = () => {
  try { return `\n${JSON.stringify(diag())}`; } catch { return ''; }
};

/** Polls `pred` until it gives something truthy, and hands that back. Throws after `ms`, so a script never hangs on a state that does not come. */
async function until<T>(pred: () => T, ms = 10_000): Promise<NonNullable<T>> {
  for (const end = performance.now() + ms; ; await sleep(50)) {
    const v = pred();
    if (v) return v as NonNullable<T>;
    if (performance.now() > end) throw new Error(`__aw.until: not met in ${ms} ms: ${String(pred).replace(/\s+/g, ' ').slice(0, 120)}${diagText()}`);
  }
}

// The screen is at rest when nothing is being played, or what is playing waits on a decision (a card, the action button)
const resting = () => !busy() || !!actionBtn.get() || cards.get().length > 0;
/** Resolves once the screen has rested for 200 ms (the server's answer to a press takes a moment to come back), or throws after `ms`. The default holds a round of three bots. */
async function idle(ms = 60_000) {
  let since = 0;
  await until(() => { const t = performance.now(); since = resting() ? since || t : 0; return since && t - since >= 200; }, ms).catch(() => { throw new Error(`__aw.idle: still playing after ${ms} ms: ${JSON.stringify(ui())}${diagText()}`); });
}

const topCard = () => [...document.querySelectorAll<HTMLElement>('.modal')].filter((m) => !m.closest('[hidden]')).pop(); // the card a key reaches (see keys.ts): not one set aside
const reachable = (e: HTMLElement) => e.getClientRects().length > 0 && !(e as HTMLButtonElement).disabled;
const pressable = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('button, .item, .pcard')].filter(reachable);
/** What a press on `what` hits: a CSS selector, else a button by its data-id or its text (all of it, then the start of it), case aside. A card that is up covers the window, so only it is searched. */
function find(what: string) {
  const root = topCard() ?? document, all = pressable(root), w = norm(what);
  let hit: HTMLElement | undefined;
  try { hit = [...root.querySelectorAll<HTMLElement>(what)].find(reachable); } catch { /* not a selector: it is text */ }
  return hit ?? all.find((e) => e.dataset.id === what || norm(label(e)) === w) ?? all.find((e) => norm(label(e)).startsWith(w));
}
/** Presses what `find` gives (waiting up to `ms` for it to be there); when nothing comes, the error says what can be pressed. */
async function click(what: string, ms = 5000) {
  const name = (e: HTMLElement) => `${label(e).slice(0, 30) || e.title || e.id}${e.dataset.id ? ` [${e.dataset.id}]` : ''}`;
  const el = await until(() => find(what), ms).catch(() => { throw new Error(`__aw.click: nothing to press for "${what}"; pressable now: ${pressable(topCard() ?? document).map(name).join(' | ') || 'nothing'}${diagText()}`); });
  el.click();
  await nextFrame();
}

/** What is on screen, as the cards and the action bar say it: the top card with its buttons, the action button, who the game waits for. */
function ui() {
  const card = topCard(), btn = actionBtn.get(), who = waitingFor.get(), S = G.S;
  return {
    view: session.get().view,
    busy: busy(), // the director is still playing something (`idle()` waits for this to end)
    action: btn?.label ?? null, // the action bar's button: ROLL DICE, END TURN
    waiting: who >= 0 && S ? S.players[who].name : null,
    aside: cardsSetAside.get() && cards.get().length > 0, // cards are up but set aside: click 'SHOW CARD' to bring them back
    modal: card ? { title: label(card.querySelector('.hd span')), sub: label(card.querySelector('.hd small')), buttons: [...card.querySelectorAll<HTMLButtonElement>('.ft .btn')].map((b) => ({ id: b.dataset.id, text: label(b), disabled: b.disabled })) } : null,
    toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => label(t)),
  };
}

const runCmd = (c: Cmd) => {
  const run = actionBtn.get()?.submitAnswer, S = G.S;
  if (!run || !S || !command(S, c)) return false;
  run(c);
  return true;
};
/** The dev panel's commands ride on the roll question: with `{ wait }` ms the call holds on for it to open (and throws if it never does) instead of answering false at once. */
function cmd(c: Cmd): boolean;
function cmd(c: Cmd, o: { wait: number }): Promise<boolean>;
function cmd(c: Cmd, o?: { wait: number }) {
  return o ? until(() => actionBtn.get()?.submitAnswer, o.wait).then(() => runCmd(c), () => { throw new Error(`__aw.cmd: no roll question to answer within ${o.wait} ms${diagText()}`); }) : runCmd(c);
}

export function initDev() {
  const q = new URLSearchParams(location.search);
  const urlView = parseUrlView();
  const scenarioName = q.get('scenario');
  const booted = hmrData.booted; // a hot update re-runs initDev on the same page: the room in it is kept, not replayed
  const startBots = !booted && !scenarioName && (q.get('autostart') === '1' || q.has('bots')) ? (num(q.get('bots')) ?? 3) : null;
  hmrData.booted = true;

  // A scene still in flight belongs to this run of the page: once a hot update replaces it, its driver goes stale
  // rather than steering whatever room the new run kept or opened.
  let live = true;
  const stale = new Error('scenario: superseded by a hot update');
  const driver: SceneDrv = {
    until: (p, ms) => (live ? until(p, ms) : Promise.reject(stale)),
    cmd: (c, o) => (live ? cmd(c, o) : Promise.reject(stale)),
    send: (m) => { if (live) send(m); },
    quickGame: (n) => (live ? quickGame(n) : Promise.reject(stale)),
    ui: () => (live ? ui() : null),
  };
  const ready = (async () => {
    if (startBots !== null) await driver.quickGame(startBots);
    if (scenarioName && !booted) console.log(`scenario ${scenarioName}:`, await runScenario(scenarioName, driver));
    if (urlView) await setView(urlView);
    else { loop.draw(); await nextFrame(); }
  })().catch((e) => {
    if (live) throw e; // superseded by a hot update: die quietly — the new page owns the room now
  });

  const api = {
    ready,
    state: readState,
    setView,
    setHour: (hour: number | null) => setView({ hour }),
    setClean: (clean: boolean) => setView({ clean }),
    setUi: (ui: boolean) => setView({ ui }),
    setLoop: (opts: { paused?: boolean; scale?: number }) => {
      if (opts.paused !== undefined) loop.paused = opts.paused;
      if (opts.scale !== undefined) loop.scale = Math.max(0, opts.scale);
      loop.draw();
    },
    // A dev room's real pause: no question's clock runs on the server (the game still takes answers). Render-side freeze stays `setLoop`'s own.
    pause: (on: boolean) => send({ t: 'pause', paused: on }),
    step: async (dt: number) => { loop.step(dt); await nextFrame(); },
    scrub: async (t: number) => { loop.scrub(t); await nextFrame(); }, // the world clock to t outright: `tick`-driven models pose there exactly
    // A lot's look, with no room and no turn: { owner: -1 vacant, level, mortgaged, sign: false hides the SALE board on a vacant lot }
    setLot: async (i: number, o: { owner?: number; level?: number; mortgaged?: boolean; sign?: boolean } | null) => { setLot(i, o); loop.draw(); await nextFrame(); },
    rebuild: async (i: number) => { rebuildTile(i); loop.draw(); await nextFrame(); }, // re-draw a tile's props from its model file, state untouched
    isolate: async (i: number | null) => { isolateTile(i); loop.draw(); await nextFrame(); }, // one tile alone over its plot outline (null: the whole board again)
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
    cmd,
    until,
    idle,
    ui,
    click,
    diag,
    scenario: (name: string) => runScenario(name, driver), // a fresh dev room played to a named resting state, then paused: `scenarios` says what each rests on
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, s]) => [k, s.hint])),
    snapDataUrl: () => (loop.draw(), renderer.domElement.toDataURL('image/png')),
    audio: { labels: AUDIO_AUDITIONS.map(([k]) => k), play: auditionSound, renderPcm: renderAuditionPcm },
    refs: { G, TILES, POS, LOT, PAD, clock, sky, U, camera, controls, renderer, scene, loop },
  };
  (window as unknown as { __aw?: typeof api }).__aw = api;
  return () => { live = false; delete (window as unknown as { __aw?: typeof api }).__aw; };
}
