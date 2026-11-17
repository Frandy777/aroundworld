import { TILES, TILE_COUNT, maxLevel, type Tile } from './data';
import type { Cmd, Ev, GameState, Owned, PickRule, RankRow } from './types';

const LOG_MAX = 80;

// The reducer: the server runs every event through it to keep the real state, each client runs the same events (as it plays them) to mirror it.
export function apply(s: GameState, e: Ev) {
  switch (e.t) {
    case 'order': s.turnOrder = e.order; break;
    case 'turn': s.turnIndex = e.turnIndex; s.round = e.round; s.step = null; break;
    case 'step': s.step = e.step; break;
    case 'move': s.players[e.player].tile = e.to; break;
    case 'cash': s.players[e.player].cash += e.delta; break;
    case 'dep': s.players[e.player].deposit = e.deposit; break;
    case 'own': if (e.owned) s.ownedByTile[e.tile] = e.owned; else delete s.ownedByTile[e.tile]; break;
    case 'flag': s.players[e.player][e.flag] = e.active; break;
    case 'out': { const p = s.players[e.player]; p.bankruptRound = s.round; p.cash = 0; s.bankruptOrder.push(e.player); break; }
    case 'log': s.log.unshift({ id: (s.log[0]?.id ?? 0) + 1, round: s.round, message: e.message }); if (s.log.length > LOG_MAX) s.log.length = LOG_MAX; break; // trimming drops the oldest, so the head always holds the highest id
    case 'over': s.over = true; break;
  }
}

export const lotValue = (t: Tile, o?: Owned | null) => t.price + (o ? (o.upgradePaid ?? o.level * t.upgradeCost) : 0);
export const canMortgage = (t: Tile) => t.type === 'city' || t.type === 'special';

export function stats(S: GameState, i: number) {
  let cities = 0, investments = 0, mortgaged = 0, propertyValue = 0, levels = 0;
  for (const [k, o] of Object.entries(S.ownedByTile)) {
    if (o.owner !== i) continue;
    const t = TILES[+k];
    t.type === 'invest' ? investments++ : cities++;
    levels += o.level;
    o.mortgaged ? mortgaged++ : (propertyValue += lotValue(t, o));
  }
  const deposit = S.players[i].deposit?.principal ?? 0;
  return { cities, investments, mortgaged, propertyValue, levels, deposit, netWorth: S.players[i].cash + deposit + propertyValue };
}

export function ranking(S: GameState): RankRow[] {
  const alive = S.players.map((_, player) => ({ player, netWorth: stats(S, player).netWorth })).filter((r) => !S.players[r.player].bankruptRound).sort((a, b) => b.netWorth - a.netWorth);
  return [...alive, ...[...S.bankruptOrder].reverse().map((player) => ({ player, netWorth: 0 }))];
}

export const maxRounds = (S: GameState) => (S.settings.mode === 'limited' ? S.settings.rounds : Infinity);

export function canPick(rule: PickRule, count: number, sum: number): boolean {
  return rule.k === 'one' ? count === 1 : rule.k === 'any' ? count > 0 : rule.k === 'redeem' ? count > 0 && sum <= rule.cash : rule.cash + sum >= rule.need;
}

export function hasMonopoly(S: GameState, tile: Tile): boolean {
  const o = S.ownedByTile[tile.i];
  if (!o) return false;
  return TILES.filter((x) => x.region === tile.region && x.type === 'city').every((x) => S.ownedByTile[x.i]?.owner === o.owner && !S.ownedByTile[x.i].mortgaged);
}

// A command of the dev panel, if it fits this game (who it names is in, its numbers are whole): a clean copy, so nothing else of what a client sent is kept.
// The panel asks it of its own buttons too: one that gets nothing back is grey.
export function command(S: GameState, v: unknown): Cmd | undefined {
  const r = v as { c?: unknown; player?: unknown; draws?: unknown; tile?: unknown; resolveLanding?: unknown; cash?: unknown; owned?: { owner?: unknown; level?: unknown; mortgaged?: unknown; upgradePaid?: unknown } | null } | null;
  if (!r || typeof r !== 'object') return undefined;
  const int = (x: unknown, lo: number, hi = Infinity): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
  const who = (x: unknown): x is number => int(x, 0, S.players.length - 1) && !S.players[x].bankruptRound;
  switch (r.c) {
    case 'draw': return Array.isArray(r.draws) && r.draws.length <= 20 && r.draws.every((x) => int(x, 1)) ? { c: 'draw', draws: r.draws } : undefined;
    case 'cash': return who(r.player) && int(r.cash, 0) ? { c: 'cash', player: r.player, cash: r.cash } : undefined;
    case 'goto': return who(r.player) && int(r.tile, 0, TILE_COUNT - 1) ? { c: 'goto', player: r.player, tile: r.tile, resolveLanding: !!r.resolveLanding } : undefined;
    case 'own': {
      if (!int(r.tile, 0, TILE_COUNT - 1) || TILES[r.tile].type === 'public') return undefined;
      const o = r.owned;
      if (!o) return { c: 'own', tile: r.tile, owned: null };
      return who(o.owner) && int(o.level, 0) ? { c: 'own', tile: r.tile, owned: { owner: o.owner, level: Math.min(o.level, maxLevel(TILES[r.tile])), mortgaged: !!o.mortgaged, upgradePaid: int(o.upgradePaid, 0) ? o.upgradePaid : undefined } } : undefined;
    }
  }
}
