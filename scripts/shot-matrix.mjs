#!/usr/bin/env node
// Capture a labeled visual comparison grid from the running dev server via headless Chrome + `window.__aw`.
// Usage:
//   npm run shots
//   node scripts/shot-matrix.mjs --hours=0,6.2,12,18 --looks=pixel,hd2d --tile=1 --zoom=2.2
//   node scripts/shot-matrix.mjs --tile=28 --zoom=1.6 --looks=hd2d --hours=0,12 --strike=6,28,4.9

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)];
  }),
);

if (args.help) {
  console.log('Usage: node scripts/shot-matrix.mjs [--url=http://localhost:5173] [--looks=pixel,hd2d] [--hours=12,18,0] [--tile=N] [--zoom=fit|N] [--elev=52] [--az=0] [--strike=from,to,sec] [--autostart] [--size=960x540] [--dpr=1] [--out=/tmp/aw-shots/matrix.png]');
  process.exit(0);
}

const baseUrl = (args.url ?? 'http://localhost:5173').replace(/\/$/, '');
const looks = (args.looks ?? 'pixel,hd2d').split(',').map((s) => s.trim()).filter(Boolean);
const hours = (args.hours ?? '12,18,0').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
const [width, height] = (args.size ?? '960x540').split('x').map(Number);
const dpr = Number(args.dpr ?? 1);
const outFile = args.out ?? '/tmp/aw-shots/matrix.png';
const outDir = path.dirname(outFile);
const tile = args.tile !== undefined ? Number(args.tile) : undefined;
const zoom = args.zoom === 'fit' ? 'fit' : args.zoom !== undefined ? Number(args.zoom) : (tile !== undefined ? 2.2 : 'fit');
const elev = args.elev !== undefined ? Number(args.elev) : undefined;
const az = args.az !== undefined ? Number(args.az) : undefined;
const strikeSpec = args.strike ? args.strike.split(',').map(Number) : null;
const autostart = args.autostart === '1';

try {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  await fetch(baseUrl, { signal: ctrl.signal });
  clearTimeout(timer);
} catch {
  console.error(`Dev server is not reachable at ${baseUrl}. Pass --url=http://localhost:<port> if it is running elsewhere.`);
  process.exit(1);
}

const chromeBin = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(chromeBin)) {
  console.error(`Chrome binary not found at "${chromeBin}". Set CHROME_BIN to a Chromium/Chrome executable.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-chrome-'));

const chrome = spawn(chromeBin, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--mute-audio',
  `--window-size=${width},${height}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

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
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
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
const pageErrors = [];

try {
  const wsUrl = await waitWsEndpoint(chrome);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new Cdp(ws);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  cdp.events.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails?.text ?? 'Uncaught exception');
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      pageErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false }, sessionId);

  const entryUrl = `${baseUrl}/?dev=1&fresh=1${autostart ? '&autostart=1' : '&ui=0'}`;
  await cdp.send('Page.navigate', { url: entryUrl }, sessionId);

  const evalJs = async (expression) => {
    const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    return res.result?.value;
  };

  await evalJs(`(async () => {
    for (let i = 0; i < 200 && !window.__aw; i++) await new Promise((r) => setTimeout(r, 25));
    if (!window.__aw) throw new Error('window.__aw not available (is the server running in DEV mode?)');
    await window.__aw.ready;
  })()`);

  const cells = [];
  for (const look of looks) {
    const hd = look === 'hd2d' || look === 'hd' || look === '1';
    for (const hour of hours) {
      const viewOpts = { hd, hour, rotate: false, ui: autostart, ...(tile !== undefined ? { tile } : { x: 0, z: 0, lift: 0 }), zoom, ...(elev !== undefined ? { elev } : {}), ...(az !== undefined ? { az } : {}) };
      await evalJs(`window.__aw.setView(${JSON.stringify(viewOpts)})`);
      if (strikeSpec) {
        const [from = 6, to = 28, sec = 1.4] = strikeSpec;
        await evalJs(`window.__aw.strike(${from}, ${to}, ${sec})`);
      }
      const state = await evalJs('window.__aw.state()');
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      if (strikeSpec) await evalJs('window.__aw.setLoop({ paused: false })');
      const tag = `${hd ? 'hd2d' : 'pixel'}-${hhmm(hour).replace(':', '')}`;
      const file = path.join(outDir, `${tag}.png`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      cells.push({ file, label: `${hd ? 'HD-2D' : 'PIXEL'}  ${hhmm(hour)}  z=${state.zoom} (${state.lodName})` });
    }
  }

  if (autostart) await evalJs('window.__aw.leaveRoom()');
  ws.close();

  // Stitch into a single labeled contact sheet via Python PIL if available.
  const cols = hours.length, rows = looks.length;
  const py = spawnSync('python3', ['-', JSON.stringify({ cells, cols, rows, outFile })], {
    input: `
import json, sys
from PIL import Image, ImageDraw
cfg = json.loads(sys.argv[1])
cells, cols, rows, out = cfg['cells'], cfg['cols'], cfg['rows'], cfg['outFile']
imgs = [Image.open(c['file']) for c in cells]
w, h = imgs[0].size
pad, bar = 8, 28
sheet = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * (h + bar) + (rows + 1) * pad), (11, 14, 36))
draw = ImageDraw.Draw(sheet)
for idx, (im, c) in enumerate(zip(imgs, cells)):
    r, col = divmod(idx, cols)
    x = pad + col * (w + pad)
    y = pad + r * (h + bar + pad)
    draw.text((x + 6, y + 6), c['label'], fill=(246, 240, 220))
    sheet.paste(im, (x, y + bar))
sheet.save(out)
`,
    encoding: 'utf8',
  });

  if (py.status === 0) console.log(`Saved ${cells.length}-panel contact sheet: ${outFile}`);
  else console.log(`Saved ${cells.length} screenshots in: ${outDir} (PIL stitch skipped: ${py.stderr.trim()})`);

  if (pageErrors.length) {
    console.error(`Console/WebGL errors (${pageErrors.length}):\n` + pageErrors.map((e) => `  - ${e}`).join('\n'));
    process.exitCode = 1;
  }
} finally {
  if (chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await new Promise((r) => { chrome.once('exit', r); setTimeout(r, 1500).unref(); });
  }
  fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
