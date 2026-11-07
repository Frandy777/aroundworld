import { TILES } from './data';
import type { Ev, GameState, RankRow } from './types';

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
    case 'log': s.log.unshift({ r: s.round, m: e.m }); if (s.log.length > LOG_MAX) s.log.length = LOG_MAX; break;
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
