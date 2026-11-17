import { REGIONS, TILES, TILE_COUNT, type InvestKind, type RegionKey } from '../shared/data';
import { P, m, money } from '../shared/msg';
import { stats } from '../shared/state';
import type { Msg, NewsCard } from '../shared/types';
import type { Game } from './game';

// `reason` is what the log gives as the reason of any money a story moves.
export interface Story { card: NewsCard; run(reason: Msg): Promise<void> }
type Def = (g: Game, pi: number) => Story;

const REGION_OF: (RegionKey | null)[] = TILES.map((_, i) => { for (let k = 0; k < TILE_COUNT; k++) { const r = TILES[(i - k + TILE_COUNT) % TILE_COUNT].region; if (r) return r; } return null; });
const places = TILES.filter((t) => t.type === 'city' || t.type === 'special').map((t) => t.i);
const investments = TILES.filter((t) => t.type === 'invest').map((t) => t.i);
const forwardDistance = (fromTile: number, toTile: number) => (((toTile - fromTile) % TILE_COUNT) + TILE_COUNT) % TILE_COUNT;

// ---- Money: the player who drew it ----
const win = (title: string, text: string, vals: number[]): Def => (g, pi) => {
  const v = g.pick(vals);
  return { card: { category: 'Money', title, text, amount: v }, run: async (reason) => g.give(pi, v, reason) };
};
const lose = (title: string, text: string, vals: number[]): Def => (g, pi) => {
  const v = g.pick(vals);
  return { card: { category: 'Money', title, text, amount: -v }, run: async (reason) => { await g.pay(pi, v, reason); } };
};
const incentive: Def = (g, pi) => {
  const v = 50 * g.owned(pi, ['invest']);
  return { card: { category: 'Money', title: 'Investment Incentive', text: 'New policy: gain $50 × investments owned.', amount: v || undefined }, run: async (reason) => g.give(pi, v, reason) };
};
const repairs: Def = (g, pi) => {
  const v = 10 * stats(g.S, pi).levels;
  return { card: { category: 'Money', title: 'Home Repairs', text: 'Lose $10 × the sum of your building levels.', amount: v ? -v : undefined }, run: async (reason) => { await g.pay(pi, v, reason); } };
};

// ---- Asset: everyone who owns a kind of investment, gaining or losing the same sum ----
const boom = (kinds: InvestKind[], who: string, up: [string, string], down: [string, string], vals: number[]): Def => (g) => {
  const gain = g.coin(), v = g.pick(vals), [title, text] = gain ? up : down;
  return {
    card: { category: 'Asset', title, text: `${text} ${who} ${gain ? 'gain' : 'lose'} ${money(v)}.` },
    run: async (reason) => {
      for (const o of g.owners(kinds)) {
        if (gain) { if (g.collects(o)) g.give(o, v, reason); } else await g.pay(o, v, reason);
        if (g.over()) return;
      }
    },
  };
};
const strike: Def = (g) => {
  const v = g.pick([100, 200, 300]);
  return {
    card: { category: 'Asset', title: 'Labor Strike', text: `Walkouts hit chokepoints, transport, construction and oil. Their owners lose ${money(v)}.` },
    run: async (reason) => { for (const o of g.owners(['choke', 'transport', 'build', 'oil'])) { await g.pay(o, v, reason); if (g.over()) return; } },
  };
};

// ---- Players: money moving between the one who drew it and the others ----
const wedding: Def = (g, pi) => {
  const v = g.pick([50, 100, 150, 200, 250]);
  return {
    card: { category: 'Players', title: 'Wedding Bells', text: `Collect ${money(v)} from every other player.` },
    run: async (reason) => { for (const o of g.alive()) { if (o !== pi) await g.pay(o, v, reason, pi); if (g.over()) return; } },
  };
};
const banquet: Def = (g, pi) => {
  const v = g.pick([20, 40, 60, 80, 100]);
  return {
    card: { category: 'Players', title: 'Grand Banquet', text: `Pay every other player ${money(v)}.` },
    run: async (reason) => { for (const o of g.alive()) { if (o !== pi && !(await g.pay(pi, v, reason, o))) return; if (g.over()) return; } },
  };
};
const pickpocket: Def = (g, pi) => {
  const take = g.coin(), v = g.pick([20, 50, 100]), hit = [...g.passedPlayers];
  const text = !hit.length ? 'Nobody was in your way this turn.' : take ? `You brushed past other players on the way. Collect ${money(v)} from each.` : `A hustler spotted you. Pay ${money(v)} to each player you passed.`;
  return {
    card: { category: 'Players', title: take ? 'Pickpocket' : 'Hustler', text },
    run: async (reason) => {
      for (const o of hit) {
        if (g.S.players[o].bankruptRound) continue;
        if (take) await g.pay(o, v, reason, pi); else if (!(await g.pay(pi, v, reason, o))) return;
        if (g.over()) return;
      }
    },
  };
};
const finders: Def = (g, pi) => {
  const v = g.pick([50, 100, 150]), o = g.nearest(pi, -1);
  return {
    card: { category: 'Players', title: 'Finders Keepers', text: o < 0 ? 'There is nobody behind you.' : `Pay ${money(v)} to the nearest player behind you.` },
    run: async (reason) => { if (o >= 0) await g.pay(pi, v, reason, o); },
  };
};

// ---- Position: whoever stands somewhere pays ----
const olympics: Def = (g) => {
  const at = g.pick(places), v = 200;
  return {
    card: { category: 'Position', title: 'Olympic Fever', text: `Players standing on ${TILES[at].name} lose ${money(v)}.` },
    run: async (reason) => { for (const o of g.alive()) { if (g.S.players[o].tile === at) await g.pay(o, v, reason); if (g.over()) return; } },
  };
};
const visas: Def = (g) => {
  const r = g.pick(Object.keys(REGIONS) as RegionKey[]), v = 300;
  return {
    card: { category: 'Position', title: 'Visa Crackdown', text: `Players standing in ${REGIONS[r][0]} lose ${money(v)}.` },
    run: async (reason) => { for (const o of g.alive()) { if (REGION_OF[g.S.players[o].tile] === r) await g.pay(o, v, reason); if (g.over()) return; } },
  };
};
const tour: Def = (g) => {
  const at = g.pick(investments), v = 100;
  return {
    card: { category: 'Position', title: 'Study Tour', text: `Players on ${TILES[at].name} pay ${money(v)} to its owner.` },
    run: async (reason) => {
      for (const o of g.alive()) {
        if (g.S.players[o].tile !== at) continue;
        const own = g.S.ownedByTile[at]; // a jailed owner collects nothing: the bank gets it
        await g.pay(o, v, reason, own && own.owner !== o && g.collects(own.owner) ? own.owner : null);
        if (g.over()) return;
      }
    },
  };
};

// ---- Action: the one who drew it ----
const another: Def = (g) => ({ card: { category: 'Action', title: 'Buy One, Get One', text: 'Take another turn right away.' }, run: async () => { g.extraTurn = true; } });
const worldTour: Def = (g, pi) => ({ card: { category: 'Action', title: 'World Tour', text: 'Your next move goes backward (no pass effects).' }, run: async () => { g.moveMods[pi].backward = true; } });
const destination: Def = (g, pi) => {
  const at = g.pick(places);
  return {
    card: { category: 'Action', title: 'Hot Destination', text: `Move to ${TILES[at].name} and stop there.` },
    run: async () => { g.move(pi, at, 'jump'); await g.landOn(pi, at); },
  };
};

// ---- Action: everyone who owns something ----
const homecoming: Def = (g) => ({
  card: { category: 'Action', title: 'Homecoming', text: 'Transport owners move to START and stop, then pay $1,000.' },
  run: async (reason) => {
    for (const o of g.owners(['transport'])) {
      g.move(o, 0, 'jump');
      await g.landOn(o, 0);
      if (!g.S.players[o].bankruptRound) await g.pay(o, 1000, reason);
      if (g.over()) return;
    }
  },
});
const shoddy: Def = (g) => ({
  card: { category: 'Action', title: 'Shoddy Construction', text: 'Construction owners lower one regular city by 1 level.' },
  run: async () => {
    for (const o of g.owners(['build'])) {
      const mine = Object.keys(g.S.ownedByTile).map(Number).filter((i) => g.S.ownedByTile[i].owner === o && TILES[i].type === 'city' && g.S.ownedByTile[i].level > 0);
      if (!mine.length) continue;
      const [i] = (await g.ask(o, {
        k: 'pick', of: 'tile', title: 'SHODDY CONSTRUCTION', sub: [g.playerName(o)], tone: 0xb13e53, hint: 'A building fails inspection. Choose one of your cities to lower by 1 level.',
        items: mine.map((i) => ({ index: i, note: `Lv ${g.S.ownedByTile[i].level}` })), rule: { k: 'one', msg: 'Pick a city' }, label: 'LOWER IT',
      })) as number[];
      g.lower(i);
    }
  },
});
const martial: Def = (g) => ({
  card: { category: 'Action', title: 'Court Martial', text: 'Military base owners go to jail.' },
  run: async () => { for (const o of g.owners(['military'])) { await g.sendToJail(o); if (g.over()) return; } },
});
const standoff: Def = (g) => ({
  card: { category: 'Action', title: 'Strait Standoff', text: 'Chokepoint owners stay put for a turn.' },
  run: async () => { for (const o of g.owners(['choke'])) { g.emit({ t: 'flag', player: o, flag: 'stay', active: true }); g.log(m`${P(o)} is held up at the straits`); } },
});
const fuel: Def = (g) => ({
  card: { category: 'Action', title: 'Fuel Surplus', text: 'Cheap fuel: oil company owners move 3 extra steps next turn.' },
  run: async () => { for (const o of g.owners(['oil'])) { g.moveMods[o].extraSteps = true; g.log(m`${P(o)} will move 3 extra steps next turn`); } },
});
const winds: Def = (g) => ({
  card: { category: 'Action', title: 'Winds of Change', text: 'BBC / Devil’s Island owners move 1-12 tiles forward or back.' },
  run: async () => {
    for (const o of g.owners(['bbc', 'devil'])) {
      const n = g.rnd(12);
      g.move(o, (g.S.players[o].tile + (g.coin() ? n : TILE_COUNT - n)) % TILE_COUNT, 'jump');
    }
  },
});

// ---- Action: two players ----
const swap: Def = (g, pi) => ({
  card: { category: 'Action', title: 'Body Swap', text: 'Swap places with another player (no landing effect).' },
  run: async () => {
    const others = g.alive().filter((o) => o !== pi);
    if (!others.length) return;
    const [o] = (await g.ask(pi, {
      k: 'pick', of: 'player', title: 'BODY SWAP', sub: [g.playerName(pi)], tone: 0x9c5fd0, hint: 'Choose a player to trade places with.',
      items: others.map((i) => ({ index: i, note: TILES[g.S.players[i].tile].name })), rule: { k: 'one', msg: 'Pick a player' }, label: 'SWAP',
    })) as number[];
    const [a, b] = [g.S.players[pi].tile, g.S.players[o].tile];
    g.move(pi, b, 'jump'); g.move(o, a, 'jump');
    g.log(m`${P(pi)} swapped places with ${P(o)}`);
  },
});
const meet: Def = (g, pi) => ({
  card: { category: 'Action', title: 'Wait for Me', text: 'Move up to 3 tiles toward the nearest player, then they move up to 3 toward you. If you meet, the moving stops.' },
  run: async () => {
    const at = (x: number) => g.S.players[x].tile, me = at(pi);
    const near = (x: number) => Math.min(forwardDistance(me, at(x)), forwardDistance(at(x), me));
    const o = g.alive().filter((x) => x !== pi).sort((a, b) => near(a) - near(b))[0];
    if (o === undefined) return;
    const there = at(o), dir = forwardDistance(me, there) <= forwardDistance(there, me) ? 1 : -1, d = near(o);
    const first = Math.min(3, d), second = Math.min(3, d - first); // you walk up to 3, then they do
    if (first) g.move(pi, (me + dir * first + TILE_COUNT) % TILE_COUNT, 'jump');
    if (second) g.move(o, (there - dir * second + TILE_COUNT) % TILE_COUNT, 'jump');
    g.log(m`${P(pi)} and ${P(o)} ${first + second === d ? 'met' : 'moved toward each other'}`);
  },
});
const blindDate: Def = (g, pi) => ({
  card: { category: 'Action', title: 'Blind Date', text: 'Before your next move, other players passing your tile stop there instead.' },
  run: async () => { g.moveMods[pi].blindDate = true; },
});
const runningMan: Def = (g, pi) => ({
  card: { category: 'Action', title: 'Running Man', text: 'Move to 1 tile ahead of the nearest player in front of you.' },
  run: async () => { const o = g.nearest(pi, 1); if (o >= 0) g.move(pi, (g.S.players[o].tile + 1) % TILE_COUNT, 'jump'); },
});

// ---- Weather ----
const weather = (title: string, regions: RegionKey[]): Def => (g) => ({
  card: { category: 'Weather', title, text: `Players in ${regions.map((r) => REGIONS[r][0]).join(' / ')} move half steps next turn.` },
  run: async () => {
    for (const o of g.alive()) {
      const r = REGION_OF[g.S.players[o].tile];
      if (r && regions.includes(r)) { g.moveMods[o].halfSteps = true; g.log(m`${P(o)} will move half steps next turn`); }
    }
  },
});

export const NEWS: Def[] = [
  win('Lost Wallet', 'You found an unclaimed wallet on the street.', [20, 40, 60, 80, 100]),
  win('Scratch Card Win', 'Your scratch card just hit the jackpot!', [10, 20, 30, 40, 50]),
  incentive,
  win("Distant Relative's Will", 'A long-lost relative left you an inheritance.', [60, 80, 100, 120, 140]),
  lose('Insurance Adjustment', 'Insurance premiums went up this year.', [30, 50, 70]),
  lose('Luxury Scam', 'That designer bag was a fake. Ouch.', [100, 200, 300]),
  lose('Hush Money', 'Keeping a scandal quiet is not cheap.', [50, 100, 150]),
  repairs,
  boom(['oil'], 'Oil company owners', ['Oil Discovery', 'A new oil field comes in.'], ['Green Energy', 'The green shift hits oil.'], [100, 150, 200]),
  boom(['transport'], 'Transport company owners', ['Tourist Season', 'Visitors flood in.'], ['Off-Season', 'Travel slumps.'], [50, 70, 90]),
  boom(['choke'], 'Chokepoint owners', ['Cargo Peak', 'Shipping is booming.'], ['Piracy', 'Pirates raid the lanes.'], [60, 90, 120]),
  boom(['build'], 'Construction company owners', ['Building Boom', 'Cranes fill the skyline.'], ['Housing Bubble', 'The housing bubble bursts.'], [100, 150, 200]),
  boom(['military'], 'Military base owners', ['Arms Race', 'Defence budgets soar.'], ['Tensions', 'A costly standoff.'], [150, 250, 350]),
  strike,
  wedding, banquet, pickpocket, finders,
  olympics, visas, tour,
  another, worldTour, destination,
  homecoming, shoddy, martial, standoff, fuel, winds,
  swap, meet, blindDate, runningMan,
  weather('Severe Cold', ['jpk', 'rus', 'eeu', 'nat']),
  weather('Heat Wave', ['oce', 'afr', 'mea', 'cas']),
  weather('Gale', ['sea', 'chn', 'usa', 'cam']),
  weather('Heavy Rain', ['weu', 'sam']),
];
