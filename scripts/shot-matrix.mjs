#!/usr/bin/env node
// Capture a labeled visual comparison sheet — or a scripted list of single shots — via headless Chrome + `window.__aw`.
// Usage:
//   npm run shots
//   node scripts/shot-matrix.mjs --hours=0,6.2,12,18 --tile=1 --zoom=2.2
//   node scripts/shot-matrix.mjs --tile=28 --zoom=1.6 --hours=0,12 --strike=6,28,4.9
// Close-ups (aim at the building, not the lot centre; crop and upscale the cells). --tile takes a name or kind too (--tile=rio,
// --tile="Las Vegas", --tile=bank — a slug ignoring case, spaces and hyphens; a bare number stays an index):
//   node scripts/shot-matrix.mjs --tiles=1,20 --owners=0,1 --lv=2 --az=0,-35 --zoom=3 --tx=1.6 --tz=1 --lift=0.9 --crop=420x340 --scale=2
// Aim in the model's own LOT space instead (the props origin over the plot, like the models' coordinates; --lot=1 is a bare --lx=--ly=--lz=0):
//   node scripts/shot-matrix.mjs --tile=jerusalem --lot=1 --zoom=3 --crop=420x340 --scale=2
//   node scripts/shot-matrix.mjs --tile=hong-kong --lx=-0.4 --ly=1 --lz=-0.15 --zoom=3
// Scripted single shots (one named PNG per entry plus <out>/sheet.png — JSON array inline or a file path; --out=....png or --sheet=file puts the sheet elsewhere):
//   node scripts/shot-matrix.mjs --out=/tmp/aw-shots/hk --list='[{"name":"hk-nite","tile":13,"hour":0,"zoom":3,"lot":true,"lx":-0.25,"ly":2.6,"crop":{"w":360,"h":420,"dx":0,"dy":0},"scale":2}]'
// Compare with another version instead of eyeballing two sheets: --vs[=git-ref] shoots that commit (HEAD when bare: what the uncommitted edits changed)
// from a throwaway copy, and the working tree, each with the world frozen; the sheet lays BEFORE | AFTER | DIFF out per shot and a table says how far
// each moved against the noise between two shots of the same code. --expect=same exits 1 if any shot moved. --cmp=<dir> takes the BEFORE from the
// <name>.png files of an earlier --list run instead of a commit:
//   node scripts/shot-matrix.mjs --hours=0,12,18 --vs --expect=same
//   node scripts/shot-matrix.mjs --list=shots.json --out=/tmp/aw-shots/new --cmp=/tmp/aw-shots/old
// No dev server where the script runs (worktree, delegated checkout): --serve spawns `vite --port 0` for the run.
// Whichever way the server is found it is checked against /__aw-id (the checkout it serves): another worktree's server is
// never shot as this one. Named HUD scenes run a fresh dev room to a resting state, then freeze its clocks:
//   node scripts/shot-matrix.mjs --scene=buy --out=/tmp/aw-shots/buy            # one named scene, 1600x900
//   node scripts/shot-matrix.mjs --list='[{"name":"mort","scene":"mortgage"}]' --out=/tmp/aw-shots/mort
// A failed run writes fail.json (+ a last screenshot) next to the output: the phase, the error, the server's identity and the page's own __aw.diag().

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TILES } from '../src/shared/data.ts';

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)];
  }),
);

if (args.help) {
  console.log(`Usage: node scripts/shot-matrix.mjs [options]

Target:   [--url=http://localhost:5173] [--serve]      without --url/--serve, ports 5173-5176 are probed
          Servers prove their checkout via /__aw-id; one serving another worktree (or an older build
          without the endpoint) is rejected — restart it or pass --serve.
          [--scene=buy|news|mortgage|casino|spectate]   one named HUD scene (fresh dev room, ends paused); same as a --list shot with "scene"
          [--q=vol=1&x=2]                              extra query for the page URL
Rows:     [--zooms=fit|N,...] [--elevs=deg,...] [--tiles=N|name,...] [--owners=p,...] [--lv=0,1,2,3]
Cols:     [--hours=12,18,0] [--az=deg,...] [--time=sec,...]
Lots:     [--m=1] [--nosign=1] [--iso=1|tile] [--lots=t:p:lv[:m[:sign]],...]
Camera:   [--elev=deg] [--tx=N] [--tz=N] [--lift=N]  tile-space aim over the tile centre POS[i]
          [--lot=1] [--lx=N] [--ly=N] [--lz=N]      lot-space aim over the props origin (can't mix with --tx/--tz/--lift)
          [--strike=from,to,sec] [--autostart] [--freeze]   --freeze: pause the world clock at 0 for every shot (frames come out the same each run)
Compare:  [--vs[=git-ref]] [--cmp=dir] [--expect=same]  BEFORE | AFTER | DIFF per shot and a table; both freeze the world.
          --vs: the commit (HEAD when bare) is served from a throwaway copy and shot twice (cached per commit + shot set), the working
          tree once; a shot counts as changed when it moves further than the noise between those two baseline shots.
          --cmp: the BEFORE is dir/<name>.png of an earlier --list run (needs --list; shoot that one with --freeze too); the working
          tree is shot twice for the noise.
          --expect=same: exit 1 if any shot changed.
Output:   [--crop=WxH] [--dx=px] [--dy=px] [--scale=N] [--cols=N] [--raw[=dir]] [--size=WxH] [--dpr=1]
          [--out=matrix.png | shot dir | list sheet.png] [--sheet[=out.png]] [--list='<json array>'|file.json]
          default matrix out: /tmp/aw-shots/matrix.png, or matrix-<tile tags>.png when --tile(s) is given
          default size: 960x540, or 1600x900 when the HUD is shot (--autostart, --scene, or a "scene"/"ui" shot)
          --list: <out>/<name>.png per shot, <out>/sheet.png, <out>/run.json (matrix: <out>.json) with the arguments, git sha and the served identity
          a failed run also writes fail.json (+ fail.png) beside the output: phase, error, server identity, the page's __aw.diag()

Tiles take an index, a name or a kind (--tile=rio|"Las Vegas"|bank, slug-matched); names resolve in --tile(s),
--iso, --lots' first field and the --list shot's tile/iso/lots too.

Shot object (--list): {name, tile, tx, tz, x, z, lift, lot, lx, ly, lz, zoom, elev, az, hour, ui, time, iso, scene,
  setlot:{owner,level,mortgaged,sign}, lots:[[t,owner,level,mortgaged,sign]], strike:[from,to,sec], crop:[x,y,w,h]|{w,h,dx,dy}, scale}
  scene: a named HUD scene (see __aw.scenarios) run before the shot's view is posed`);
  process.exit(0);
}

const list = (v) => v === undefined ? [undefined] : String(v).split(',').map((s) => (s.trim() === 'fit' ? 'fit' : Number(s.trim()))).filter((n) => n === 'fit' || Number.isFinite(n));
const num = (v) => (v === undefined ? undefined : Number(v));
const die = (msg) => { console.error(msg); process.exit(1); };

// A tile reference: a bare number is an index, anything else a name or kind, slug-matched (case, spaces and hyphens ignored).
const slug = (s) => String(s).toLowerCase().replace(/[\s\-_.'’]+/g, '');
const tileIx = (v, what = '--tile') => {
  if (typeof v === 'number' || /^\d+$/.test(String(v).trim())) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n >= TILES.length) die(`${what}: tile index ${n} out of range 0-${TILES.length - 1}`);
    return n;
  }
  const s = slug(v);
  const hits = TILES.filter((t) => slug(t.name) === s || slug(t.kind) === s).map((t) => t.i);
  if (!hits.length) die(`${what}: no tile named or of kind "${v}"`);
  if (hits.length > 1) die(`${what}: "${v}" matches several tiles (${hits.join(', ')}); pass an index instead`);
  return hits[0];
};
const tileTag = (v) => (/^\d+$/.test(String(v).trim()) ? `t${tileIx(v)}` : String(v).toLowerCase().replace(/['’]/g, '').replace(/[\s_.]+/g, '-')); // the tag a --tile token adds to the default output name

let shotList = args.list !== undefined
  ? JSON.parse(fs.existsSync(args.list) ? fs.readFileSync(args.list, 'utf8') : args.list)
  : null;
if (shotList !== null && !Array.isArray(shotList)) die('--list must be a JSON array (inline or a file path)');
if (args.scene !== undefined) { // a named HUD scene (see scenarios.ts): its own fresh dev room, played to a resting state
  if (shotList) die('--scene and --list do not mix: put "scene" on the shot entries instead');
  shotList = [{ name: args.scene, scene: args.scene, ui: true }];
}
if (shotList) for (const s of shotList) { // names resolve up front, so a bad one fails before Chrome even opens
  if (s.tile !== undefined) s.tile = tileIx(s.tile, 'shot.tile');
  if (s.iso !== undefined && s.iso !== true) s.iso = tileIx(s.iso, 'shot.iso');
  if (s.lots) s.lots = s.lots.map((l) => (Array.isArray(l) ? [tileIx(l[0], 'shot.lots'), ...l.slice(1)] : { ...l, t: tileIx(l.t, 'shot.lots') }));
}

const hours = (args.hours ?? '12,18,0').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
// HUD shots need the wide layout (the #narrow mask covers anything else): autostart and named scenes get 1600x900 unless --size says otherwise; bare model shots keep the old default.
const hud = args.autostart === '1' || args.scene !== undefined || !!shotList?.some((s) => s.scene || s.ui);
const [width, height] = (args.size ?? (hud ? '1600x900' : '960x540')).split('x').map(Number);
const dpr = Number(args.dpr ?? 1);
const tileTokens = (args.tiles ?? args.tile)?.split(',').map((s) => s.trim()).filter(Boolean);
const tiles = tileTokens ? tileTokens.map((s) => tileIx(s, '--tile')) : [undefined];
// Default output is split per tile set, so parallel runs shooting different landmarks never overwrite each other's matrix.png
const outFile = args.out ?? (shotList ? (args.scene ? `/tmp/aw-shots/scene-${args.scene}` : '/tmp/aw-shots/list') : `/tmp/aw-shots/matrix${tileTokens ? `-${tileTokens.map(tileTag).join('-')}` : ''}.png`);
const files = !!shotList && !outFile.endsWith('.png'); // list mode with --out a directory: one PNG per shot there; --out=x.png is just the sheet
const sheetOut = shotList // the sheet: --sheet=file.png, else --out itself when it ends in .png, else <out>/sheet.png
  ? args.sheet !== undefined && args.sheet !== '1' ? args.sheet : (outFile.endsWith('.png') ? outFile : path.join(outFile, 'sheet.png'))
  : outFile;
const outDir = shotList ? (outFile.endsWith('.png') ? path.dirname(outFile) : outFile) : path.dirname(outFile); // list mode: --out is the shot directory itself, unless it's the sheet file
const runFile = outFile.endsWith('.png') ? outFile.replace(/\.png$/, '.json') : path.join(outFile, 'run.json');
const zooms = list(args.zooms ?? args.zoom ?? (tiles[0] !== undefined ? '2.2' : 'fit'));
const elevs = list(args.elevs ?? args.elev);
const azs = list(args.az);
const lvs = list(args.lvs ?? args.lv);
const owners = list(args.owners ?? args.p); // -1: vacant
const times = list(args.time);
const mort = args.m === '1' || args.mort === '1';
const nosign = args.nosign === '1';
const iso = args.iso === undefined ? null : (args.iso === '1' ? 'self' : tileIx(args.iso, '--iso')); // --iso=1 isolates each tile shot; --iso=<tile> isolates that one
const lots = (args.lots ?? '').split(',').filter(Boolean).map((s) => { const [t, ...r] = s.split(':'); return [tileIx(t, '--lots'), ...r.map(Number)]; }); // t:p:lv[:m[:sign]], neighbours set once upfront
const strikeSpec = args.strike ? args.strike.split(',').map(Number) : null;
const autostart = args.autostart === '1';
const tx = num(args.tx), tz = num(args.tz), lift = num(args.lift);
const lx = num(args.lx), ly = num(args.ly), lz = num(args.lz);
const lotAim = args.lot === '1' || lx !== undefined || ly !== undefined || lz !== undefined; // aim in the model's own space: over the props origin
if (lotAim && (tx !== undefined || tz !== undefined || lift !== undefined)) die('--lot/--lx/--ly/--lz (lot space) cannot mix with --tx/--tz/--lift (tile space)');
const crop = args.crop ? args.crop.split('x').map(Number) : null; // css px, centred on the frame + --dx/--dy
const cdx = num(args.dx) ?? 0, cdy = num(args.dy) ?? 0;
const scale = num(args.scale ?? args.up) ?? 1;
const colsOverride = num(args.cols);
const rawDir = args.raw === undefined ? null : (args.raw === '1' ? path.join(outDir, shotList ? 'raw' : 'frames') : args.raw);
const query = args.q ? `&${args.q.replace(/^[?&]/, '')}` : '';

if (iso && tiles.includes(undefined)) { console.error('--iso needs --tile'); process.exit(1); }
if ((lvs[0] !== undefined || owners[0] !== undefined || nosign || mort) && tiles.includes(undefined)) { console.error('--lv / --owners / --nosign / --m need --tile=N'); process.exit(1); }

// ---- Compare: --vs (a commit as the BEFORE) or --cmp (an earlier --list run's shots) ----
const vs = args.vs === undefined ? null : (args.vs === '1' ? 'HEAD' : args.vs);
const cmpDir = args.cmp ?? null;
if (vs && cmpDir) die('--vs and --cmp each name the BEFORE: pass one');
if (cmpDir && !shotList) die('--cmp reads the <name>.png files of an earlier --list run: it needs --list');
if (cmpDir && !fs.existsSync(cmpDir)) die(`--cmp: no directory ${cmpDir}`);
if (args.expect !== undefined && args.expect !== 'same') die('--expect: only "same" is known (exit 1 if any shot changed)');
const compare = !!(vs || cmpDir);
if (args.expect && !compare) die('--expect needs --vs or --cmp');
const freeze = compare || args.freeze !== undefined; // a frozen world: every shot poses the clock at 0 and holds it there

// ---- Processes and temp dirs: all swept at exit, however the run ends ----
const repo = path.resolve(import.meta.dirname, '..');
const REPO = fs.realpathSync(repo); // the canonical path of this checkout, compared against a server's /__aw-id `root`
const git = (...a) => { const r = spawnSync('git', a, { cwd: repo, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const vsSha = vs ? git('rev-parse', '--verify', `${vs}^{commit}`) ?? die(`--vs: no commit "${vs}"`) : null;
const procs = new Set(), tmps = [];
const track = (p) => (procs.add(p), p);
const tmp = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); tmps.push(d); return d; };
const stop = async (p) => { // SIGTERM and wait for the exit (Chrome holds its profile dir until it is gone)
  if (p.exitCode === null) {
    p.kill('SIGTERM');
    await new Promise((r) => { p.once('exit', r); setTimeout(r, 1500).unref(); });
  }
  procs.delete(p);
};
process.once('SIGINT', () => { for (const p of procs) p.kill('SIGKILL'); process.exit(130); });
process.on('exit', () => {
  for (const p of procs) p.kill('SIGTERM');
  for (const d of tmps) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const chromeBin = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; // checked at run time: a missing browser is a run failure (fail.json), not a usage error

// ---- Dev servers: vite spawned in a directory, and the working tree's (--url, --serve, or the usual ports probed) ----
// A server says which checkout and which process it is at /__aw-id (vite.config.ts, dev only). Probing must never
// shoot another worktree's server as this one: only an identity that matches REPO counts. A spawned server is held to
// the same check when the endpoint exists; a tree from an old commit may not have it, and that is fine — its directory
// is known because this run put it there.
const servers = new Map(); // url -> what is known about the dev server answering there
// A thrown error that fails the run: `phase` says which stage it died at (written into fail.json), and `server` —
// when set — is reported as the observed/requested server instead of the live map's entry.
const fail = (msg, phase, server) => { throw Object.assign(new Error(msg), { phase, server }); };
async function serverId(u) {
  try {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 1500);
    try { // the bound covers the body too: a stalled response stream must not wait forever on headers already in
      const res = await fetch(`${u}/__aw-id`, { signal: ctrl.signal });
      return res.ok ? await res.json() : null; // null: nothing there, or a build from before the endpoint
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

async function startVite(cwd) {
  try {
    const proc = track(spawn('npx', ['vite', '--port', '0'], { cwd, stdio: ['ignore', 'pipe', 'inherit'] }));
    const url = await new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => reject(new Error(`vite printed no Local URL within 30s:\n${buf}`)), 30_000);
      proc.stdout.on('data', (c) => {
        buf += c;
        const m = buf.match(/Local:\s+(https?:\/\/\S+)/) ?? buf.match(/(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/);
        if (m) { clearTimeout(timer); resolve(m[1].replace(/\/$/, '')); }
      });
      proc.once('exit', (code) => { clearTimeout(timer); reject(new Error(`vite exited early (${code}):\n${buf}`)); });
      proc.once('error', (e) => { clearTimeout(timer); reject(new Error(`vite could not start: ${e.message}`)); });
    });
    const id = await serverId(url);
    if (id && id.root !== fs.realpathSync(cwd)) fail(`spawned vite at ${url} reports root ${id.root}, not ${fs.realpathSync(cwd)}`, 'server', { url, saw: id });
    return [url, proc, id];
  } catch (e) {
    throw Object.assign(e, { phase: e.phase ?? 'server' });
  }
}

async function workingTreeUrl() {
  const found = (url, id, via) => (servers.set(url, { url, id, via }), servers.get(url));
  if (args.serve !== undefined) {
    const [url, , id] = await startVite(repo);
    if (!id) fail(`--serve: the spawned vite at ${url} has no /__aw-id — this checkout's vite.config.ts should provide it`, 'server', { url });
    console.log(`--serve: spawned vite at ${url} (${id.root}, pid ${id.pid})`);
    return found(url, id, 'serve');
  }
  const given = args.url?.replace(/\/$/, '');
  if (given) {
    const id = await serverId(given);
    if (!id) {
      let app = false;
      try { app = (await (await fetch(given, { signal: AbortSignal.timeout(1200) })).text()).includes('id="gl"'); } catch { /* nothing there */ }
      fail(app
        ? `--url: ${given} answers like this app but has no /__aw-id — it was built before that endpoint; restart the dev server to pick up vite.config.ts.`
        : `--url: ${given} has no /__aw-id (unreachable, or not this app at all). Check the address, or pass --serve.`,
        'server', { requested: given, want: REPO, saw: app ? 'this app, no /__aw-id' : null });
    }
    if (id.root !== REPO) fail(`--url: ${given} serves ${id.root}, but this run wants ${REPO}. Start a dev server in this checkout or pass --serve.`, 'server', { requested: given, want: REPO, saw: id });
    console.log(`dev server at ${given} serves ${id.root} (pid ${id.pid})`);
    return found(given, id, 'url');
  }
  const others = [], stale = [];
  for (const p of [5173, 5174, 5175, 5176]) {
    const u = `http://localhost:${p}`, id = await serverId(u);
    if (id) {
      if (id.root === REPO) { console.log(`dev server found at ${u} (${id.root}, pid ${id.pid})`); return found(u, id, 'probe'); }
      others.push(`${u} serves ${id.root}`);
      continue;
    }
    try { // no identity: it may still be this app's page — a server from before the endpoint answers it but cannot be trusted
      const body = await (await fetch(u, { signal: AbortSignal.timeout(1200) })).text();
      if (body.includes('id="gl"')) stale.push(u);
    } catch { /* nothing listening */ }
  }
  const why = [
    ...others.map((s) => `  - ${s}`),
    ...stale.map((u) => `  - ${u} answers like this app but has no /__aw-id (built before it — restart the server to pick up vite.config.ts)`),
  ];
  fail(`No dev server for this checkout (${REPO}) on localhost:5173-5176.${why.length ? `\n${why.join('\n')}` : ''}\nPass --url=http://localhost:<port> or --serve to spawn one here.`,
    'server', { want: REPO, probed: [5173, 5174, 5175, 5176].map((p) => `http://localhost:${p}`), saw: why });
}

function waitWsEndpoint(proc) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for Chrome DevTools:\n${stderr}`)), 10_000);
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited early (${code}):\n${stderr}`)); });
    proc.once('error', (e) => { clearTimeout(timer); reject(new Error(`Chrome could not start: ${e.message}`)); });
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
    // A dead socket must not leave a send pending forever: a shot's failure path (diag, a last screenshot, the
    // process's own cleanup) only runs once the in-flight call gives up.
    const gone = (e) => { for (const p of this.pending.values()) p.reject(e); this.pending.clear(); };
    ws.addEventListener('close', () => gone(new Error('the DevTools socket closed')));
    ws.addEventListener('error', () => gone(new Error('the DevTools socket errored')));
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else {
        for (const fn of this.events) fn(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

const hhmm = (h) => new Date((((h % 24) + 24) % 24) * 36e5).toISOString().slice(11, 16);
// --freeze, before every pose: stop the world clock and seek it to the same point, and step back to the whole board. The level of detail goes down only
// once the texels are 8% past a threshold (scene.ts levelNow), so a zoom inside that band keeps the level the camera came from, which depends on which frames
// were drawn on the way (the switch to HD-2D draws some). Coming up from the whole board, every pose gets the same level.
const HOLD = '(async () => { const a = window.__aw; a.setLoop({ paused: true }); await a.scrub(0); await a.setView({ zoom: "fit" }); })()';

// ---- One Chrome session: the whole shot plan against `base`, a PNG per frame in `dir` (f0.png, f1.png...) ----
async function capture(base, dir, quiet = false) {
  fs.mkdirSync(dir, { recursive: true });
  const profile = tmp('aw-chrome-');
  const chrome = track(spawn(chromeBin, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] }));
  const cells = [], errors = [];
  let phase = 'launch', cdp = null, sessionId = null, evalJs = null;
  try {
    const wsUrl = await waitWsEndpoint(chrome);
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('the DevTools socket never opened')), 10_000);
      ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('the DevTools socket failed')); }, { once: true });
    });
    cdp = new Cdp(ws);

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
    cdp.events.push((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.text ?? 'Uncaught exception');
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false }, sessionId);

    // A frozen world is paused from its first frame, so that whatever integrates the frame time (the globe's spin, the ambient ships) stands where it began in every session.
    // A game cannot be: its animations need the clock, so there only HOLD (below) stops it, once the room is up.
    const entryUrl = `${base}/?dev=1&fresh=1${autostart ? '&autostart=1' : `&ui=0${freeze ? '&paused=1' : ''}`}${query}`;
    phase = 'boot';
    await cdp.send('Page.navigate', { url: entryUrl }, sessionId);

    evalJs = async (expression) => {
      const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
      return res.result?.value;
    };

    await evalJs(`(async () => {
      for (let i = 0; i < 200 && !window.__aw; i++) await new Promise((r) => setTimeout(r, 25));
      if (!window.__aw) throw new Error('window.__aw not available (is the server running in DEV mode?)');
      await window.__aw.ready;
    })()`);

    // Warm-up. The title's camera is still orbiting at boot, and a jump leaves the damped remains of that orbit in the first pose only: the first jump takes them
    // up, the second is exact. Without it the first frame of a session differs from the ones after it. A frozen run also pins the azimuth, which else carries on from the orbit.
    const settle = `window.__aw.setView({ rotate: false, zoom: 'fit', x: 0, z: 0, lift: 0${freeze ? ', az: 0' : ''} })`;
    await evalJs(settle);
    await evalJs(settle);
    phase = 'prepare';

    const snap = async (label, out) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      const file = path.join(dir, `f${cells.length}.png`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      cells.push({ file, label, out });
      return cells[cells.length - 1];
    };
    const setLots = (specs) => specs.reduce((p, s) => p.then(() => {
      const [t, owner, level, mortgaged, sign] = Array.isArray(s) ? s : [s.t, s.owner ?? s.p, s.level ?? s.lv, s.mortgaged ?? s.m, s.sign];
      const o = { owner, ...(level !== undefined ? { level } : {}), ...(mortgaged ? { mortgaged: true } : {}), ...(sign !== undefined ? { sign: !!sign } : {}) };
      return evalJs(`window.__aw.setLot(${t}, ${JSON.stringify(o)}).then(() => window.__aw.step(0.6))`);
    }), Promise.resolve());
    const viewExpr = (v) => `window.__aw.setView(${JSON.stringify(v)})`;
    // tile-centred view, optionally nudged towards the building: tx/tz shift the target in world units, lift raises it; lot space instead
    // measures lx/ly/lz from the props origin (LOT.x/z over the tile, the plot top up: where a model's own coordinates live)
    const aimView = (v, tile) => {
      if (tile !== undefined && lotAim)
        return `(async () => { const a = window.__aw, P = a.refs.POS[${tile}], L = a.refs.LOT, B = a.refs.TILES[${tile}].type === 'public' ? 0 : a.refs.PAD.h; await a.setView({ ...${JSON.stringify(v)}, x: P.x + L.x + ${lx ?? 0}, z: P.z + L.z + ${lz ?? 0}, lift: P.y + B + ${ly ?? 0} }); })()`;
      if (tile !== undefined && (tx !== undefined || tz !== undefined || lift !== undefined))
        return `(async () => { const a = window.__aw, P = a.refs.POS[${tile}]; await a.setView({ ...${JSON.stringify(v)}, x: P.x + ${tx ?? 0}, z: P.z + ${tz ?? 0}, lift: ${lift ?? 0} }); })()`;
      if (tile !== undefined) return viewExpr({ ...v, tile });
      return viewExpr({ ...v, x: tx ?? 0, z: tz ?? 0, lift: lift ?? 0 });
    };

    await setLots(lots);

    if (shotList) {
      // ---- Scripted shots: each entry poses its own view and writes <out>/<name>.png ----
      for (const [i, s] of shotList.entries()) {
        const name = s.name ?? `shot${i}`;
        phase = `shot "${name}"`;
        if (s.scene) await evalJs(`window.__aw.scenario(${JSON.stringify(s.scene)})`); // a named scene: fresh dev room, driven to its resting state
        if (s.iso) await evalJs(`window.__aw.isolate(${s.iso === true ? (s.tile ?? tiles[0] ?? 0) : s.iso})`);
        await setLots(s.lots ?? []);
        if (s.setlot !== undefined) await evalJs(`window.__aw.setLot(${s.tile ?? tiles[0] ?? 0}, ${JSON.stringify({ owner: s.setlot.owner ?? s.setlot.p, level: s.setlot.level ?? s.setlot.lv, mortgaged: s.setlot.mortgaged ?? s.setlot.m, sign: s.setlot.sign })}).then(() => window.__aw.step(0.6))`);
        await evalJs(`(async () => { const a = window.__aw, s = ${JSON.stringify(s)};
          ${freeze ? `await ${HOLD};` : ''}
          const v = { hour: s.hour ?? 12, rotate: !!s.rotate, ui: s.ui ?? (${autostart} || !!s.scene), zoom: s.zoom ?? (s.tile !== undefined ? 3 : 'fit') };
          if (s.tile !== undefined) {
            const P = a.refs.POS[s.tile];
            if (s.lot || s.lx !== undefined || s.ly !== undefined || s.lz !== undefined) { // lot space: over the props origin, ly up from the plot top
              const L = a.refs.LOT, B = a.refs.TILES[s.tile].type === 'public' ? 0 : a.refs.PAD.h;
              v.x = P.x + L.x + (s.lx ?? 0); v.z = P.z + L.z + (s.lz ?? 0); v.lift = P.y + B + (s.ly ?? 0);
            } else { v.x = P.x + (s.tx ?? 0); v.z = P.z + (s.tz ?? 0); v.lift = s.lift ?? 0; }
          }
          else { v.x = s.x ?? 0; v.z = s.z ?? 0; v.lift = s.lift ?? 0; }
          if (s.elev !== undefined) v.elev = s.elev; if (s.az !== undefined) v.az = s.az;
          await a.setView(v);
          if (s.strike) await a.strike(...s.strike);
          if (s.time !== undefined) await a.scrub(s.time);
        })()`);
        if (s.strike && !freeze) await evalJs('window.__aw.setLoop({ paused: false })');
        const c = await snap(name, path.join(outDir, `${name}.png`));
        if (s.crop) c.crop = Array.isArray(s.crop) ? { box: s.crop } : s.crop; // [x,y,w,h] css px or centred {w,h,dx,dy}
        const sc = s.scale ?? scale;
        if (sc !== 1) c.scale = sc;
        if (!quiet) console.log(`${name}: ${c.out}`);
      }
    } else {
      // ---- Matrix: rows = zooms x elevs x tiles x owners x lvs, cols = hours x azs x times ----
      phase = 'shots';
      for (const zoom of zooms) for (const elev of elevs) for (const tile of tiles) for (const p of owners) for (const lv of lvs) {
        if (tile !== undefined) {
          if (iso) await evalJs(`window.__aw.isolate(${iso === 'self' ? tile : iso})`);
          if (p !== undefined || lv !== undefined) {
            const o = { owner: p ?? 0, ...(lv !== undefined ? { level: lv } : {}), ...(mort ? { mortgaged: true } : {}), ...(nosign ? { sign: false } : {}) };
            await evalJs(`window.__aw.setLot(${tile}, ${JSON.stringify(o)}).then(() => window.__aw.step(0.6))`); // let the pop-in squash settle before the shots
          } else if (nosign) await evalJs(`window.__aw.setLot(${tile}, { owner: -1, sign: false })`);
        }
        for (const hour of hours) {
          for (const az of azs) for (const time of times) {
            const viewOpts = { hour, rotate: false, ui: autostart, zoom, ...(elev !== undefined ? { elev } : {}), ...(az !== undefined ? { az } : {}) };
            if (freeze) await evalJs(HOLD);
            await evalJs(aimView(viewOpts, tile));
            if (strikeSpec) {
              const [from = 6, to = 28, sec = 1.4] = strikeSpec;
              await evalJs(`window.__aw.strike(${from}, ${to}, ${sec})`);
            }
            if (time !== undefined) await evalJs(`window.__aw.scrub(${time})`);
            const state = await evalJs('window.__aw.state()');
            if (strikeSpec && !freeze) await evalJs('window.__aw.setLoop({ paused: false })');
            const label = `${hhmm(hour)}${tile !== undefined ? `  t${tile}` : ''}${p !== undefined ? `  p${p}` : ''}${lv !== undefined ? `  lv${lv}` : ''}${mort ? '  MORT' : ''}${az !== undefined ? `  az${az}` : ''}${elev !== undefined ? `  el${elev}` : ''}${time !== undefined ? `  t${time}` : ''}  z=${state.zoom} (${state.lodName})`;
            const c = await snap(label);
            if (crop) c.crop = { w: crop[0], h: crop[1], dx: cdx, dy: cdy };
            if (scale !== 1) c.scale = scale;
          }
        }
      }
      if (iso !== null) await evalJs('window.__aw.isolate(null)');
      if (autostart) await evalJs('window.__aw.leaveRoom()');
    }
    ws.close();
    return { cells, errors };
  } catch (e) {
    e.phase = phase;
    e.url = base;
    // What the page had to say for itself when it failed — a shot of it and its own `diag()`. Both are bounded: a dead
    // page answers with a fast error, a stalled one is given up on, so saving the failure never hangs the run.
    const within = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('diag timed out')), ms))]);
    if (evalJs && sessionId) {
      try { e.scene = await within(evalJs('window.__aw?.diag?.() ?? null'), 3000); } catch { e.scene = null; }
      try { e.png = (await within(cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId), 3000)).data; } catch { /* the page is already gone: the JSON still says where it stopped */ }
    }
    throw e;
  } finally {
    await stop(chrome);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

// ---- --vs: the BEFORE is a commit, served from a throwaway copy of its tree and shot twice (what differs between the two shots is the noise the
// change is judged against). Kept per commit + shot set + this script's own text, so comparing against it again only shoots the working tree. ----
const cacheDir = path.join(os.tmpdir(), 'aw-shots-cache');
async function baseline(ref, sha) {
  const skip = new Set(['out', 'sheet', 'raw', 'vs', 'cmp', 'expect', 'url', 'serve', 'cols']); // arguments that change where the result goes, not what is shot
  const plan = crypto.createHash('sha1').update(JSON.stringify([Object.entries(args).filter(([k]) => !skip.has(k)).sort(), shotList, fs.readFileSync(import.meta.filename, 'utf8')])).digest('hex').slice(0, 12);
  const dir = path.join(cacheDir, `${sha.slice(0, 12)}-${plan}`);
  const runs = [1, 2].map((n) => path.join(dir, String(n)));
  if (fs.existsSync(dir)) { fs.utimesSync(dir, new Date(), new Date()); return { runs, errors: [], cached: dir }; } // the cache is the source; no server was started for it this run

  console.log(`--vs: shooting ${ref} (${sha.slice(0, 8)}) from a throwaway copy, twice`);
  const tree = tmp('aw-tree-');
  try {
    if (spawnSync('sh', ['-c', 'git archive "$0" | tar -x -C "$1"', sha, tree], { cwd: repo }).status !== 0) fail(`--vs: git archive ${sha} failed`, 'setup');
    const modules = path.join(repo, 'node_modules');
    if (spawnSync('cp', ['-cR', modules, tree]).status !== 0) spawnSync('cp', ['-R', modules, tree]); // an APFS clone is instant, a plain copy is not
    const [url, vite, id] = await startVite(tree); // a throwaway server of that commit's tree: /__aw-id may not exist on old commits, and then the directory is the identity — this run put it there
    servers.set(url, { url, id: id ?? null, via: 'vs-baseline', dir: tree });
    const aside = `${dir}.${process.pid}`; // built next to its place and renamed in, so a parallel run never reads half of it
    const errors = [];
    try {
      for (const n of [1, 2]) errors.push(...(await capture(url, path.join(aside, String(n)), true)).errors);
    } finally { await stop(vite); }
    try { fs.renameSync(aside, dir); } catch { fs.rmSync(aside, { recursive: true, force: true }); } // another run got there first
    const old = fs.readdirSync(cacheDir).map((n) => path.join(cacheDir, n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(8);
    for (const d of old) fs.rmSync(d, { recursive: true, force: true });
    return { runs, errors, url };
  } catch (e) {
    if (!e.phase?.startsWith?.('baseline(')) e.phase = `baseline(${ref}) ${e.phase ?? 'setup'}`;
    throw e;
  }
}

// ---- Post-processing in Python PIL: crop + NEAREST upscale, files, the contact sheet, or the compare sheet with its numbers ----
const PY = `
import json, sys
from PIL import Image, ImageChops, ImageDraw, ImageStat
cfg = json.loads(sys.argv[1])
cells, vw, cmp_ = cfg['cells'], cfg['vw'], cfg.get('compare')
def prep(c):
    im = Image.open(c['file']).convert('RGB')
    r = im.width / vw
    cr = c.get('crop')
    if cr:
        if 'box' in cr:
            x, y, w, h = cr['box']; im = im.crop((round(x*r), round(y*r), round((x+w)*r), round((y+h)*r)))
        else:
            cw, ch = cr['w']*r, cr['h']*r
            cx, cy = im.width/2 + cr.get('dx',0)*r, im.height/2 + cr.get('dy',0)*r
            im = im.crop((round(cx-cw/2), round(cy-ch/2), round(cx+cw/2), round(cy+ch/2)))
    s = c.get('scale', 1)
    if s != 1: im = im.resize((round(im.width*s), round(im.height*s)), Image.NEAREST)
    return im
def grid(panels, cols, out):
    rows = -(-len(panels) // max(cols, 1))
    w = max(im.width for im, _ in panels); h = max(im.height for im, _ in panels) # cells may differ (list shots crop+scale each on their own): the grid takes the largest
    pad, bar = 8, 28
    sheet = Image.new('RGB', (cols*w + (cols+1)*pad, rows*(h+bar) + (rows+1)*pad), (11, 14, 36))
    draw = ImageDraw.Draw(sheet)
    for idx, (im, text) in enumerate(panels):
        r_, col = divmod(idx, cols)
        x = pad + col*(w + pad)
        y = pad + r_*(h + bar + pad)
        draw.text((x + 6, y + 6), text, fill=(246, 240, 220))
        sheet.paste(im, (x, y + bar))
    sheet.save(out)
# everything is read before anything is written: --cmp's BEFORE may sit in the dir the shots are written to
imgs = [prep(c) for c in cells]
if cmp_:
    befores = [prep(c) for c in cmp_['before']]
    noises = [(prep(a), prep(b)) for a, b in cmp_['noise']]
if cfg['files']:
    for im, c in zip(imgs, cells): im.save(c['out'])
if not cmp_:
    grid([(im, c['label']) for im, c in zip(imgs, cells)], cfg['cols'], cfg['sheet'])
else:
    TOL = 3 # a pixel counts as changed when one of its channels moves by more than this (of 255)
    def diff(a, b):
        if a.size != b.size: return None, None
        d = ImageChops.difference(a, b)
        r, g, bl = d.split()
        step = ImageChops.lighter(ImageChops.lighter(r, g), bl) # each pixel's largest channel step
        return {'mean': sum(ImageStat.Stat(d).mean) / 3, 'max': max(hi for _, hi in d.getextrema()), 'pct': 100 * sum(step.histogram()[TOL + 1:]) / (a.width * a.height)}, d
    def moved(s, n): return s is None or s['mean'] > 3 * n['mean'] + 0.03 or s['pct'] > 3 * n['pct'] + 0.05 # further than the noise between two shots of the same code (a few ambient actors, which sit differently in every session)
    rows, panels = [], []
    for c, im, b, nz in zip(cells, imgs, befores, noises):
        s, d = diff(b, im)
        n, _ = diff(*nz)
        m = moved(s, n)
        rows.append({'label': c['label'], 'stat': s, 'noise': n, 'moved': m})
        note = 'SIZE DIFFERS' if s is None else 'mean %.3f  changed %.3f%%  %s' % (s['mean'], s['pct'], 'CHANGED' if m else 'same')
        panels += [(b, cfg['compare']['names'][0] + '  ' + c['label']), (im, cfg['compare']['names'][1]), (d.point(lambda v: min(255, v * 8)) if d is not None else Image.new('RGB', im.size), 'DIFF x8  ' + note)]
    grid(panels, 3, cfg['sheet'])
    print(json.dumps(rows))
`;

// ---- Run ----
fs.mkdirSync(outDir, { recursive: true });
let rows = null;
// A failed run still leaves what it knows behind: phase, the error, the server's identity, the page's own `diag()`, and a
// last screenshot if the page still answered. Written next to the output (survives the temp sweep), then exit non-zero.
async function writeFail(e, url) {
  const f = shotList ? path.join(outDir, 'fail.json') : runFile.replace(/\.json$/, '-fail.json');
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    if (e.png) fs.writeFileSync(f.replace(/\.json$/, '.png'), Buffer.from(e.png, 'base64'));
    fs.writeFileSync(f, JSON.stringify({
      argv: process.argv.slice(2),
      cwd: process.cwd(), // where the command ran; `server` is who actually served the page
      phase: e.phase ?? null,
      error: e.message ?? String(e),
      server: e.server ?? servers.get(e.url ?? url) ?? { url: e.url ?? url ?? null },
      scene: e.scene ?? null,
      stack: e.stack,
      git: { sha: git('rev-parse', 'HEAD'), dirty: !!git('status', '--porcelain') },
    }, null, 2));
    console.error(`Failure details saved to ${f}${e.png ? ' (+screenshot)' : ''}`);
  } catch (w) { console.error(`could not save failure details to ${f}: ${w.message}`); }
}
// One way out for every run-stage failure — server, browser, page or post-processing: the error keeps its phase,
// fail.json is written (a screenshot too when the page still answered), the tracked processes are swept, exit 1.
let runPhase = 'launch', base = null;
try {
  if (!fs.existsSync(chromeBin)) fail(`Chrome binary not found at "${chromeBin}". Set CHROME_BIN to a Chromium/Chrome executable.`, 'launch');
  runPhase = 'server';
  base = await workingTreeUrl();
  runPhase = 'capture';
  const { cells, errors } = await capture(base.url, tmp('aw-frames-'));

  runPhase = 'compare';
  let cmp = null, beforeErrors = [], vsPart = null;
  if (vs) {
    const b = await baseline(vs, vsSha);
    beforeErrors = b.errors;
    vsPart = { ref: vs, sha: vsSha, ...(b.url ? { server: servers.get(b.url) ?? { url: b.url } } : { cache: b.cached }) }; // a cache hit means no baseline server ran this time
    const at = (d) => (c, i) => ({ file: path.join(d, `f${i}.png`), crop: c.crop, scale: c.scale });
    cmp = { names: [`BEFORE ${vs} (${vsSha.slice(0, 8)})`, 'AFTER working tree'], before: cells.map(at(b.runs[0])), noise: cells.map((c, i) => [at(b.runs[0])(c, i), at(b.runs[1])(c, i)]) };
  } else if (cmpDir) {
    const again = await capture(base.url, tmp('aw-frames-'), true);
    const before = cells.map((c) => ({ file: path.join(cmpDir, path.basename(c.out)) }));
    for (const c of before) if (!fs.existsSync(c.file)) fail(`--cmp: ${c.file} is missing (the earlier run needs the same shot names)`, 'compare');
    cmp = { names: [`BEFORE ${cmpDir}`, 'AFTER working tree'], before, noise: cells.map((c, i) => [c, again.cells[i]]) };
  }

  runPhase = 'post';
  // ---- Raw frames kept on request before any post-processing ----
  if (rawDir) {
    fs.mkdirSync(rawDir, { recursive: true });
    cells.forEach((c, i) => fs.copyFileSync(c.file, path.join(rawDir, `${String(i).padStart(2, '0')}-${(c.label ?? 'shot').replace(/[^\w.-]+/g, '_')}.png`)));
    console.log(`Kept ${cells.length} raw frames in: ${rawDir}`);
  }

  fs.mkdirSync(path.dirname(sheetOut), { recursive: true });
  const py = spawnSync('python3', ['-', JSON.stringify({ cells, vw: width, files, compare: cmp, sheet: sheetOut, cols: shotList ? (colsOverride ?? Math.min(cells.length, 4)) : (colsOverride ?? hours.length * azs.length * times.length) })], { input: PY, encoding: 'utf8' });

  if (py.status === 0) {
    console.log(`${files ? `Saved ${cells.length} shots in: ${outDir}\n` : ''}Saved ${cells.length}-panel ${cmp ? 'compare' : 'contact'} sheet: ${sheetOut}`);
    if (cmp) rows = JSON.parse(py.stdout);
  } else if (cmp) fail(`Compare needs Python PIL: ${py.stderr.trim()}`, 'post');
  else {
    fs.cpSync(path.dirname(cells[0].file), outDir, { recursive: true });
    console.log(`Saved ${cells.length} screenshots in: ${outDir} (PIL post-processing skipped${crop ? ' — frames are uncropped' : ''}: ${py.stderr.trim()})`);
  }

  if (rows) {
    const f = (n) => n.toFixed(3);
    const w = Math.max(4, ...rows.map((r) => r.label.length));
    const line = (label, cols, verdict) => console.log(label.padEnd(w) + cols.map((v) => String(v).padStart(12)).join('') + `  ${verdict}`);
    console.log('');
    line('shot', ['mean|Δ|', 'max|Δ|', 'changed', 'noise mean', 'noise chg'], '');
    for (const r of rows) line(r.label, [r.stat ? f(r.stat.mean) : 'size differs', r.stat?.max ?? '-', r.stat ? `${f(r.stat.pct)}%` : '-', f(r.noise.mean), `${f(r.noise.pct)}%`], r.moved ? 'CHANGED' : 'same');
    const moved = rows.filter((r) => r.moved);
    console.log(moved.length ? `\n${moved.length} of ${rows.length} shots changed beyond the noise.` : `\nAll ${rows.length} shots match within the noise.`);
    if (args.expect === 'same' && moved.length) { console.error('--expect=same failed'); process.exitCode = 1; }
  }

  fs.writeFileSync(runFile, JSON.stringify({
    argv: process.argv.slice(2),
    cwd: process.cwd(), // where the command ran; `server` is who actually served the page
    server: servers.get(base.url) ?? { url: base.url }, // the checkout and instance that served the shots
    git: { sha: git('rev-parse', 'HEAD'), dirty: !!git('status', '--porcelain') },
    ...(vs ? { vs: vsPart } : {}),
    ...(shotList ? { shots: shotList } : {}),
    ...(rows ? { compare: rows } : {}),
    ...(beforeErrors.length ? { beforeErrors } : {}),
    ...(errors.length ? { consoleErrors: errors } : {}), // the verdict below fails the run; this keeps why
  }, null, 2));

  if (beforeErrors.length) console.error(`Console/WebGL errors while shooting ${vs} (${beforeErrors.length}, not counted):\n` + beforeErrors.map((e) => `  - ${e}`).join('\n'));
  if (errors.length) {
    console.error(`Console/WebGL errors (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'));
    process.exitCode = 1;
  }
} catch (e) {
  e.phase ??= runPhase;
  await writeFail(e, base?.url);
  console.error(`failed during ${e.phase}: ${e.message}`);
  process.exitCode = 1;
} finally {
  for (const p of [...procs]) await stop(p);
}
