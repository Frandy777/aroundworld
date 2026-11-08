import { TILES, TILE_COUNT, maxLevel, type Tile } from './data';
import type { Cmd, Ev, GameState, PickRule, RankRow } from './types';

const LOG_MAX = 80;

// The reducer: the server runs every event through it to keep the real state, each client runs the same events (as it plays them) to mirror it.
export function apply(s: GameState, e: Ev) {
  switch (e.t) {
    case 'order': s.order = e.order; break;
    case 'turn': s.turn = e.turn; s.round = e.round; s.step = null; break;
    case 'step': s.step = e.s; break;
    case 'move': s.players[e.pi].tile = e.to; break;
    case 'cash': s.players[e.pi].cash += e.d; break;
    case 'own': if (e.o) s.own[e.i] = e.o; else delete s.own[e.i]; break;
    case 'flag': s.players[e.pi][e.k] = e.v; break;
    case 'out': { const p = s.players[e.pi]; p.out = s.round; p.cash = 0; s.bankrupt.push(e.pi); break; }
    case 'log': s.log.unshift({ id: (s.log[0]?.id ?? 0) + 1, r: s.round, m: e.m }); if (s.log.length > LOG_MAX) s.log.length = LOG_MAX; break; // trimming drops the oldest, so the head always holds the highest id
    case 'over': s.over = true; break;
  }
}

export function stats(S: GameState, i: number) {
  let city = 0, inv = 0, mort = 0, val = 0, lv = 0;
  for (const [k, o] of Object.entries(S.own)) {
    if (o.p !== i) continue;
    const t = TILES[+k];
    t.type === 'invest' ? inv++ : city++;
    lv += o.lv;
    o.m ? mort++ : (val += t.mort);
  }
  return { city, inv, mort, val, lv, net: S.players[i].cash + val };
}

// Who is still in, richest first, then the bankrupt, last out first.
export function ranking(S: GameState): RankRow[] {
  const alive = S.players.map((_, p) => ({ p, net: stats(S, p).net })).filter((r) => !S.players[r.p].out).sort((a, b) => b.net - a.net);
  return [...alive, ...[...S.bankrupt].reverse().map((p) => ({ p, net: 0 }))];
}

export const maxRounds = (S: GameState) => (S.settings.mode === 'limited' ? S.settings.rounds : Infinity);

export function canPick(rule: PickRule, count: number, sum: number): boolean {
  return rule.k === 'one' ? count === 1 : rule.k === 'any' ? count > 0 : rule.k === 'redeem' ? count > 0 && sum <= rule.cash : rule.cash + sum >= rule.need;
}

// As `Game.rent` counts it: every city tile of the region in one player's hands and none mortgaged. False for an unowned tile.
export function hasMonopoly(S: GameState, tile: Tile): boolean {
  const o = S.own[tile.i];
  if (!o) return false;
  return TILES.filter((x) => x.region === tile.region && x.type === 'city').every((x) => S.own[x.i]?.p === o.p && !S.own[x.i].m);
}

// A command of the dev panel, if it fits this game (who it names is in, its numbers are whole): a clean copy, so nothing else of what a client sent is kept.
// The panel asks it of its own buttons too: one that gets nothing back is grey.
export function command(S: GameState, v: unknown): Cmd | undefined {
  const r = v as { c?: unknown; pi?: unknown; v?: unknown; i?: unknown; land?: unknown; o?: { p?: unknown; lv?: unknown; m?: unknown } | null } | null;
  if (!r || typeof r !== 'object') return undefined;
  const int = (x: unknown, lo: number, hi = Infinity): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
  const who = (x: unknown): x is number => int(x, 0, S.players.length - 1) && !S.players[x].out;
  switch (r.c) {
    case 'draw': return Array.isArray(r.v) && r.v.length <= 20 && r.v.every((x) => int(x, 1)) ? { c: 'draw', v: r.v } : undefined;
    case 'cash': return who(r.pi) && int(r.v, 0) ? { c: 'cash', pi: r.pi, v: r.v } : undefined;
    case 'goto': return who(r.pi) && int(r.i, 0, TILE_COUNT - 1) ? { c: 'goto', pi: r.pi, i: r.i, land: !!r.land } : undefined;
    case 'own': {
      if (!int(r.i, 0, TILE_COUNT - 1) || TILES[r.i].type === 'public') return undefined;
      const o = r.o;
      if (!o) return { c: 'own', i: r.i, o: null };
      return who(o.p) && int(o.lv, 0) ? { c: 'own', i: r.i, o: { p: o.p, lv: Math.min(o.lv, maxLevel(TILES[r.i])), m: !!o.m } } : undefined;
    }
  }
}
