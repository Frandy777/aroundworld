// Public tile effects on landing (only START also pays on the way past).
//   START      — collect $3,000 when you pass or stop here.
//   Jail       — jailed players are sent here and skip their next turn; stopping is just a visit.
//   Go To Jail — sends you to jail.
//   Exchange   — collect (investments owned) × $500.
//   Tax Bureau — the first charges (cities + specials owned) × $30 + (investments owned) × $50;
//                the second takes 3% of cash + 5% of any fixed deposit, rounded to $10.
//   Casino     — lucky: pick a number 1–6, bet ≥ $100; one die on it pays bet×2−$10, both pay bet×5−$100;
//                two jackpots jail you. stakes: bet ≥ $200; gain = round((sum−2)/5 × (bet−100));
//                the same pair twice above 7 jails you.
//   Nightclub  — pay $100 and stay here one turn.
//   Bank       — mortgage properties at their full lot value; fixed deposits in whole thousands for
//                5–15 rounds: interest = principal × (2n+20)/10000 × n, paid at turn start when the term
//                ends; a forced early withdrawal pays the principal only.
//   News       — trigger a random news event.
//   Area 51    — teleport to a random other tile and resolve its effect; nothing on the way is passed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, seize, setCash, putAt, setDep, draw, goto, roll, idle, answer, asked, cash, playUntil, idler, tileAt, kindAt, TILES, TILE_COUNT, START_CASH } from './harness.ts';

const START = kindAt('start'), JAIL = kindAt('jail'), GOJAIL = kindAt('gojail'), BANK = kindAt('bank'),
  CLUB = kindAt('club'), AREA51 = kindAt('area51'), EXCH = kindAt('exchange'), NEWS_T = kindAt('news');
const TAX1 = TILES.findIndex((t) => t.kind === 'tax'), TAX2 = TILES.findLastIndex((t) => t.kind === 'tax');
const LUCKY = TILES.findIndex((t) => t.kind === 'casino' && t.variant === 'lucky');
const STAKES = TILES.findIndex((t) => t.kind === 'casino' && t.variant === 'stakes');
const WEL = tileAt('Wellington'), CAN = tileAt('Canberra'), SYD = tileAt('Sydney'), CR = tileAt('China Railway'), BBC = tileAt('BBC');

test('START pays $3,000 on pass and on stop', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  putAt(g, A, TILE_COUNT - 2); // New Delhi — two steps before START
  await roll(g, h, [1, 2]); // passes START, lands on Wellington
  assert.equal(cash(g, A), START_CASH + 3000);
  await answer(g, h, false); // Wellington deed

  await idle(g, h);
  await goto(g, h, A, START); // stopping collects the same
  assert.equal(cash(g, A), START_CASH + 6000);
});

test('Jail: stopping is just a visit; Go To Jail jails you and costs the next turn', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await goto(g, h, A, JAIL);
  assert.equal(g.S.players[A].jail, false, 'just visiting');
  assert.equal(cash(g, A), START_CASH);

  await idle(g, h);
  await goto(g, h, A, GOJAIL);
  assert.equal(g.S.players[A].jail, true);
  assert.equal(g.S.players[A].tile, JAIL);

  await idle(g, h); // B's turn, then A's turn comes around and is skipped
  assert(h.evs.some((e) => e.t === 'skip' && e.player === A), 'the jailed turn is skipped');
  assert.equal(g.S.players[A].jail, false, 'the flag clears after skipping');
  assert.equal(h.pending.player, B, 'the turn passed back');
});

test('Exchange pays investments × $500 — nothing without any', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, CR, A); give(g, BBC, A);
  await goto(g, h, A, EXCH);
  assert.equal(cash(g, A), START_CASH + 1000);

  await idle(g, h);
  seize(g, CR); seize(g, BBC);
  await goto(g, h, A, EXCH);
  assert.equal(cash(g, A), START_CASH + 1000, 'no investments, no dividend');
});

test('Tax Bureau: the first charges holdings, the second taxes wealth', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, WEL, A, 0); give(g, CAN, A, 0); give(g, CR, A); // 2 cities + 1 investment
  await goto(g, h, A, TAX1);
  assert.equal(cash(g, A), START_CASH - (2 * 30 + 50));

  await idle(g, h);
  setCash(g, A, 20000);
  setDep(g, A, 4000, 15);
  await goto(g, h, A, TAX2);
  assert.equal(cash(g, A), 20000 - 800); // 3% of 20,000 + 5% of 4,000
});

test('Nightclub charges $100 and holds the player for a turn', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await goto(g, h, A, CLUB);
  assert.equal(cash(g, A), START_CASH - 100);
  assert.equal(g.S.players[A].party, true);

  await idle(g, h);
  assert(h.evs.some((e) => e.t === 'skip' && e.player === A), 'the partying turn is skipped');
  assert.equal(g.S.players[A].party, false);
});

test('Bank: mortgages pay the full lot value', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, WEL, A, 1); // lot value 1,600 + 400
  await goto(g, h, A, BANK);
  const a = asked(h, 'pick');
  assert.deepEqual(a.prompt.items, [{ index: WEL, level: 1, amount: 2000 }]);
  await answer(g, h, [WEL]);
  assert.equal(g.S.ownedByTile[WEL].mortgaged, true);
  assert.equal(g.S.ownedByTile[WEL].owner, A, 'still owned — only flagged');
  assert.equal(cash(g, A), START_CASH + 2000);
  await answer(g, h, null); // declines the deposit offer that follows
});

test('Bank: with nothing to mortgage it offers a fixed deposit', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  setCash(g, A, 20500);
  await goto(g, h, A, BANK);
  const a = asked(h, 'dep');
  assert.equal(a.prompt.maxPrincipal, 20000, 'cash rounded down to whole thousands');
  await answer(g, h, { principal: 5000, termRounds: 10 });
  assert.deepEqual(g.S.players[A].deposit, { principal: 5000, termRounds: 10, placedRound: 1 });
  assert.equal(cash(g, A), 15500);
});

test('a deposit pays out principal + interest at turn start once matured', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  setDep(g, A, 3000, 5, 1); // matures at round 6
  await playUntil(g, h, () => g.S.players[A].deposit === null, idler, 60);
  assert.equal(cash(g, A), START_CASH + 3000 + 45);
});

test('a shortfall withdraws the deposit early: principal only, no interest', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  setCash(g, A, 500);
  setDep(g, A, 3000, 10, 1);
  give(g, SYD, B, 3); // Lv 3 rent: the full price, $2,600
  await goto(g, h, A, SYD); // can't pay → the deposit is broken, then rent is paid
  assert.equal(g.S.players[A].deposit, null);
  assert.equal(cash(g, A), 500 + 3000 - 2600);
  assert.equal(cash(g, B), START_CASH + 2600);
});

test('News draws a card and applies its effect', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [1, 1]); // first NEWS card, first amount
  await goto(g, h, A, NEWS_T);
  const ev = h.evs.findLast((e) => e.t === 'news');
  assert.equal(ev.card.amount, 20);
  assert.equal(cash(g, A), START_CASH + 20);
});

test('Area 51 teleports to a random tile and resolves its effect', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [1]); // first tile of the draw order: START
  await goto(g, h, A, AREA51);
  assert.equal(g.S.players[A].tile, START);
  assert.equal(cash(g, A), START_CASH + 3000, 'the destination effect applies — once');
});

test('Casino (lucky): a hit on the picked number pays out', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [3, 5]); // one die on the picked number
  await goto(g, h, A, LUCKY);
  const a = asked(h, 'casino');
  assert.equal(a.prompt.view.stage, 'bet');
  await answer(g, h, { act: 'roll', bet: 100, pickedNumber: 3 }); // pays bet×2−$10 = $190
  assert.equal(asked(h, 'casino').prompt.view.stage, 'again');
  await answer(g, h, { act: 'cash' }); // declines the second wager
  assert.equal(cash(g, A), START_CASH - 100 + 190);
});

test('Casino (lucky): two jackpots send the player to jail', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [4, 4, 4, 4]); // both dice on the picked number, twice
  await goto(g, h, A, LUCKY);
  await answer(g, h, { act: 'roll', bet: 100, pickedNumber: 4 }); // jackpot 1: bet×5−$100 = $400
  await answer(g, h, { act: 'roll', bet: 100, pickedNumber: 4 }); // jackpot 2
  assert.equal(cash(g, A), START_CASH - 200 + 800);
  assert.equal(g.S.players[A].jail, true);
  assert.equal(g.S.players[A].tile, JAIL);
});

test('Casino (stakes): gain follows (sum−2)/5 × (bet−100)', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [4, 5]); // sum 9 → round(7/5 × 100) = $140
  await goto(g, h, A, STAKES);
  await answer(g, h, { act: 'roll', bet: 200 });
  assert.equal(asked(h, 'casino').prompt.view.stage, 'again');
  await answer(g, h, { act: 'cash' });
  assert.equal(cash(g, A), START_CASH - 200 + 140);
});
