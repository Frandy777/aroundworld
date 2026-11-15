// Shared setup for the rules tests in this directory — a helper, not a test (see AGENTS.md > Testing).
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// src/worker/game.ts uses constructor parameter properties, which Node's strip-only TypeScript mode rejects:
// the engine and the shared modules are bundled once with esbuild and imported as a data URL.
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = await build({
  stdin: {
    contents: [
      `export { Game, fresh } from '../src/worker/game.ts';`,
      `export { NEWS } from '../src/worker/news.ts';`,
      `export * from '../src/shared/data.ts';`,
      `export * from '../src/shared/state.ts';`,
    ].join('\n'),
    resolveDir: dir,
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
});
const W = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);

export const { Game, fresh, NEWS, TILES, TILE_COUNT, PLAYER_DEFS, MAX_PLAYERS, START_CASH,
  DEP_STEP, DEP_MIN, DEP_MAX, depRate, depInterest, REGIONS, INVEST, SPECIAL, PUBLIC, COUNTRY,
  cityRent, maxLevel, LEVEL_NAMES, tileAt, kindAt,
  apply, lotValue, canMortgage, stats, ranking, canPick, hasMonopoly } = W;

export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
export const settle = () => sleep(0); // let the engine's promise chain reach its next ask or pause

// A Host that records every event and tracks which question is currently open.
export function host({ dev = true } = {}) {
  const evs = [];
  const h = {
    evs, dev, pending: null,
    emit(ev) {
      evs.push(ev);
      if (ev.t === 'ask') h.pending = ev;
      else if (ev.t === 'close' && h.pending?.id === ev.id) h.pending = null;
    },
    online: () => true,
    bot: () => false,
    anyOnline: () => true,
    save() {},
  };
  return h;
}

export const players = (n) => PLAYER_DEFS.slice(0, n).map((p) => ({ name: p.name, color: p.color }));
// Rigged order rolls: player i draws (i+1, i+1), so the turn order comes out as seat order.
export const orderRig = (n) => Array.from({ length: n }, (_, i) => [i + 1, i + 1]).flat();

// Start a game (a dev room by default: its roll question also takes panel commands); returns once the first question is up.
export async function start(n = 2, { dev = true, settings = { mode: 'endless', rounds: 30 }, rig } = {}) {
  const h = host({ dev });
  const g = new Game(h, { ...fresh(players(n), settings), rig: rig ?? orderRig(n) });
  g.done = g.run();
  void g.done.catch(() => {});
  await settle();
  return { g, h };
}

// ---- State setup: the same events the dev commands emit, just without a question ----
export const give = (g, i, p, lv = 0, m = false, paid) =>
  g.emit({ t: 'own', i, o: { p, lv, m, ...(paid === undefined ? {} : { paid }) } });
export const seize = (g, i) => g.emit({ t: 'own', i, o: null });
export const setCash = (g, pi, v) => g.emit({ t: 'cash', pi, d: v - g.S.players[pi].cash });
export const putAt = (g, pi, i) => g.emit({ t: 'move', pi, to: i, how: 'jump' });
export const setDep = (g, pi, amt, n, made = 1) => g.emit({ t: 'dep', pi, d: { amt, n, made } });
export const setFlag = (g, pi, k, v = true) => g.emit({ t: 'flag', pi, k, v });
export const cash = (g, pi) => g.S.players[pi].cash;
export const cur = (g) => g.S.order[g.S.turn];

// ---- Prompts ----
export function asked(h, k) {
  const a = h.pending;
  assert(a, 'no question is open');
  if (k !== undefined) assert.equal(a.p.k, k, `expected a ${k} question, got ${a.p.k}`);
  return a;
}

// Answer whatever is open, whoever it is for.
export async function answer(g, h, v) {
  const a = asked(h);
  g.answer(a.to, a.id, v);
  await settle();
}

// ---- Turn driving: the roll question of a dev room takes panel commands ----
// (a command runs and the roll question is asked again, so `draw`/`goto` chain freely)
export async function cmd(g, h, c) {
  const a = asked(h, 'roll');
  g.answer(a.to, a.id, c);
  await settle();
}
export const draw = (g, h, v) => cmd(g, h, { c: 'draw', v }); // rig the next random draws (dice, card picks, coins)
export const goto = (g, h, pi, i) => cmd(g, h, { c: 'goto', pi, i, land: true }); // jump to a tile and resolve it — the whole turn

// Rig the dice, then roll for real: the player walks (pass effects apply) and lands.
export async function roll(g, h, dice) {
  await draw(g, h, dice);
  const a = asked(h, 'roll');
  g.answer(a.to, a.id, true);
  await settle();
}

// Burn the asked player's turn with no side effects: a visit to the Jail tile.
export const idle = (g, h) => goto(g, h, h.pending.to, kindAt('jail'));

// ---- Auto-answering ----
// The default answers of a player who declines everything (mirrors the timeout fallback).
export function benign(p) {
  switch (p.k) {
    case 'roll': return true;
    case 'deed': case 'confirm': case 'news': return false;
    case 'dep': return null;
    case 'pick': {
      if (p.skip) return null;
      if (p.rule.k === 'raise') {
        let need = p.rule.need - p.rule.cash;
        const sel = [];
        for (const x of [...p.items].sort((a, b) => (b.amt ?? 0) - (a.amt ?? 0))) { if (need <= 0) break; sel.push(x.i); need -= x.amt ?? 0; }
        return sel;
      }
      return p.items.slice(0, 1).map((x) => x.i);
    }
    case 'casino': return p.view.stage === 'bet' ? { act: 'roll', bet: p.view.bet, num: 6 } : { act: 'cash' };
    default: return false;
  }
}
// Every roll question answers itself with a jump to the Jail tile: deterministic turns with no side effects.
export const idler = (p, to) => (p.k === 'roll' ? { c: 'goto', pi: to, i: kindAt('jail'), land: true } : benign(p));

// Auto-answer until pred() holds (or the cap hits, which fails the test).
export async function playUntil(g, h, pred, answerer = benign, limit = 400) {
  for (let k = 0; k < limit && !pred(); k++) {
    const a = h.pending;
    if (a) g.answer(a.to, a.id, answerer(a.p, a.to));
    await settle();
  }
  assert(pred(), 'playUntil: condition not reached');
}
