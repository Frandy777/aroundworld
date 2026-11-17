// Named HUD scenes for manual acceptance and screenshots. Each opens a fresh dev room and plays it with the same dev
// commands and real answers a player has, until the screen rests on one repeatable state; then the room's question
// clocks freeze (`pause`): answers are still taken, but nothing moves on its own and no card times out. Reachable as
// `window.__aw.scenario(name)` and `?scenario=<name>`; `window.__aw.scenarios` lists the names.

import { kindAt } from '../shared/data';
import type { C2S } from '../shared/protocol';
import type { Cmd } from '../shared/types';
import { dismissAutoCard } from './director';
import { loop } from './stage';
import { G, actionBtn, cards, paused, waitingFor } from './store';

// The few drivers a scene borrows from the dev bridge (the waits live in dev.ts so their errors carry the page's
// state). Everything that touches a room goes through them: a hot update turns them stale so a scene still in
// flight cannot steer the room the new page kept or opened.
export interface SceneDrv {
  until<T>(pred: () => T, ms?: number): Promise<NonNullable<T>>;
  cmd(c: Cmd, o: { wait: number }): Promise<boolean>;
  send(m: C2S): void;
  quickGame(bots?: number): Promise<string | null>;
  ui(): unknown;
}

const myPlayer = () => G.myPlayer;
/** A live player that is not me (at game start, any of the bots). */
const other = () => {
  const p = G.S!.turnOrder.find((x) => x !== myPlayer() && !G.S!.players[x].bankruptRound);
  if (p === undefined) throw new Error('scenario: no other player alive');
  return p;
};
/** My turn's roll question. Bots ahead of me in the order take whole turns first; their cards are waved past, not waited out. */
const myTurn = (d: SceneDrv) =>
  d.until(() => {
    dismissAutoCard();
    return !!actionBtn.get()?.submitAnswer;
  }, 120_000);
/** Freeze the room's question clocks (not the render loop: the scene stays alive, just nothing times out). */
const freeze = (d: SceneDrv) => {
  d.send({ t: 'pause', paused: true });
  return d.until(() => paused.get(), 10_000);
};
/** A card is up; resolves with the screen's own description of it. */
const card = (d: SceneDrv) => d.until(() => cards.get().length > 0, 30_000).then(() => d.ui());
/** A panel command on the (frozen, re-asking) roll question; a rejected one stops the scene there. */
const dev = async (d: SceneDrv, c: Cmd) => {
  if (!(await d.cmd(c, { wait: 30_000 }))) throw new Error(`scenario: dev command rejected: ${JSON.stringify(c)}`);
};

/** Fresh dev room, my turn's roll question open, the room frozen: from here only what the scene answers moves it. */
async function open(d: SceneDrv) {
  const err = await d.quickGame(3);
  if (err) throw new Error(`scenario: no room: ${err}`);
  await myTurn(d);
  await freeze(d);
}

export const SCENARIOS: Record<string, { hint: string; run(d: SceneDrv): Promise<unknown> }> = {
  // A BUY deed card for a city the bank holds (taken back first: a bot may have bought it in its turns).
  buy: {
    hint: 'BUY card up for an unowned Wellington; the deed question is frozen',
    async run(d) {
      await open(d);
      await dev(d, { c: 'own', tile: 1, owned: null });
      await dev(d, { c: 'goto', player: myPlayer(), tile: 1, resolveLanding: true });
      return card(d);
    },
  },
  // A news card to read: the draw is rigged to Lost Wallet +$60 so repeat runs draw the same story (no card of its own follows it).
  news: {
    hint: 'NEWS card (Lost Wallet) up; the room is frozen so it never reads itself out',
    async run(d) {
      await open(d);
      await dev(d, { c: 'draw', draws: [1, 3] });
      await dev(d, { c: 'goto', player: myPlayer(), tile: kindAt('news'), resolveLanding: true });
      return card(d);
    },
  },
  // The MORTGAGE & PAY pick card: a debt I cannot cover in cash, with enough property to choose among.
  mortgage: {
    hint: 'MORTGAGE TO PAY card up (owe $3,000 rent, $1,000 in hand, three cities to mortgage); frozen',
    async run(d) {
      await open(d);
      await dev(d, { c: 'own', tile: 18, owned: { owner: other(), level: 3, mortgaged: false } }); // Shanghai Lv3: rent is the price, $3,000
      for (const tile of [1, 2, 3]) await dev(d, { c: 'own', tile, owned: { owner: myPlayer(), level: 0, mortgaged: false } });
      await dev(d, { c: 'cash', player: myPlayer(), cash: 1000 });
      await dev(d, { c: 'goto', player: myPlayer(), tile: 18, resolveLanding: true });
      return card(d);
    },
  },
  // The casino card at its betting stage (Lucky: pick a number, set a stake).
  casino: {
    hint: 'LUCKY CASINO card at the bet stage; frozen with the question open',
    async run(d) {
      await open(d);
      await dev(d, { c: 'goto', player: myPlayer(), tile: kindAt('casino'), resolveLanding: true });
      return card(d);
    },
  },
  // Out of the game, still in the room: a bot's question is open and frozen, my seat watches. The freeze goes first: a
  // bot's beat is too fast to catch live, but a question asked into the freeze can never time out, so the wait lands for good.
  spectate: {
    hint: 'bankrupt and watching: a bot is being asked; frozen',
    async run(d) {
      const err = await d.quickGame(3);
      if (err) throw new Error(`scenario: no room: ${err}`);
      await myTurn(d);
      await dev(d, { c: 'own', tile: 44, owned: { owner: other(), level: 2, mortgaged: false } }); // London Lv2: something to watch them fight over
      d.send({ t: 'bankrupt' });
      await d.until(() => !!G.S?.players[myPlayer()]?.bankruptRound, 15_000);
      await freeze(d);
      await d.until(() => waitingFor.get() >= 0 || !!G.S?.over, 60_000); // the game goes on without me: a question to a bot opens and stays
      return d.ui();
    },
  },
};

/** Run a named scene. Resolves with the screen's `ui()` when the scene rests; throws (with the page's state in the error) when it never gets there. */
export async function runScenario(name: string, d: SceneDrv): Promise<unknown> {
  const s = SCENARIOS[name];
  if (!s) throw new Error(`unknown scenario "${name}"; known: ${Object.keys(SCENARIOS).join(', ')}`);
  // The scene only advances while the world does (its waits are animations): a caller that froze the render loop
  // for a shot (paused or speed 0) lends the scene a running loop and gets its own freeze back afterwards — it is
  // handed back only while the loop is still the lent one, so a freeze asked for in the meantime stands. What a
  // scene leaves frozen is the room's question clocks, never the render side.
  const was = loop.paused || !loop.scale ? { paused: loop.paused, scale: loop.scale } : null;
  if (was) { loop.paused = false; loop.scale = 1; }
  try {
    return await s.run(d);
  } finally {
    if (was && !loop.paused && loop.scale === 1) { loop.paused = was.paused; loop.scale = was.scale; }
  }
}
