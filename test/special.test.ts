// Special tiles: ownable landmarks, upgraded like cities but to Lv 2 (cost = the tile's `up`), mortgageable.
// Landing on another player's special city never charges rent — each works by trigger instead:
//   Hong Kong — players passing or stopping pay the owner 5% / 10% / 15% of their cash by level, rounded to $10.
//   Pyongyang — its owner pays 10% / 15% / 20% less rent on regular cities.
//   Zurich    — whenever anyone gets money from the bank, the owner earns $100 / $200 / $300.
//   New York  — whenever anyone upgrades a city, the owner earns $200 / $300 / $500.
//   Las Vegas — a visitor stopping here rolls the dice and pays the owner the total × $300 / $500 / $700.
//   Rio       — whenever anyone rolls doubles, the owner earns $200 / $500 / $1,000.
//   Jerusalem — the owner stopping here rolls the dice: every other player pays the total × $100 / $200 / $300.
//   Singapore — the owner's rent income from regular cities +10% / +15% / +20% (stacks with the +50% monopoly).
// Shared rules: a mortgaged tile pays nothing; a jailed owner collects nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, setCash, putAt, setFlag, draw, goto, roll, idle, answer, asked, cash, tileAt, TILE_COUNT, START_CASH, stats } from './harness.ts';

const HK = tileAt('Hong Kong'), PYO = tileAt('Pyongyang'), ZUR = tileAt('Zurich'), NY = tileAt('New York'),
  LV = tileAt('Las Vegas'), RIO = tileAt('Rio'), JERU = tileAt('Jerusalem'), SG = tileAt('Singapore');
const WEL = tileAt('Wellington'), CAN = tileAt('Canberra'), SYD = tileAt('Sydney');

test('Hong Kong: passers-by pay a share of their cash by owner level', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, HK, B, 0);
  setCash(g, A, 19849);
  putAt(g, A, HK - 1);
  await roll(g, h, [1, 1]); // passes Hong Kong, lands on Shenzhen
  assert.equal(cash(g, A), 19849 - 990); // 5% of 19849 = 992.45, levied 990 after the $10 rounding
  assert.equal(cash(g, B), START_CASH + 990);
  await answer(g, h, false); // declines the Shenzhen deed

  give(g, HK, B, 2); // Lv 2: 15%
  await idle(g, h);
  setCash(g, A, 20000);
  putAt(g, A, HK - 1);
  await roll(g, h, [1, 1]);
  assert.equal(cash(g, A), 20000 - 3000);
  assert.equal(cash(g, B), START_CASH + 990 + 3000);
  await answer(g, h, false);
});

test('Hong Kong: stopping pays the levy too', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, HK, B, 1); // Lv 1: 10%
  await goto(g, h, A, HK);
  assert.equal(cash(g, A), START_CASH - 2000);
  assert.equal(cash(g, B), START_CASH + 2000);
});

test('Hong Kong: a mortgaged tile, or the owner passing, charges nothing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, HK, B, 0, true); // mortgaged
  putAt(g, A, HK - 1);
  await roll(g, h, [1, 1]); // A passes the mortgaged tile
  assert.equal(cash(g, A), START_CASH);
  assert.equal(cash(g, B), START_CASH);
  await answer(g, h, false); // Shenzhen deed

  await answer(g, h, null); // B's turn opens with a redeem offer for its mortgaged Hong Kong: skipped
  give(g, HK, B, 0); // unmortgaged again
  putAt(g, B, HK - 1);
  await roll(g, h, [1, 1]); // B walks past its own Hong Kong
  assert.equal(cash(g, A), START_CASH);
  assert.equal(cash(g, B), START_CASH);
  await answer(g, h, false); // B declines the Shenzhen deed
});

test('Zurich: earns when anyone gets bank money, nothing while jailed', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, ZUR, B, 2); // Lv 2: $300
  putAt(g, A, TILE_COUNT - 1);
  await roll(g, h, [1, 1]); // passes START: +$3,000
  assert.equal(cash(g, A), START_CASH + 3000);
  assert.equal(cash(g, B), START_CASH + 300);
  await answer(g, h, false); // Wellington deed

  await idle(g, h);
  setFlag(g, B, 'jail');
  putAt(g, A, TILE_COUNT - 1);
  await roll(g, h, [1, 1]);
  assert.equal(cash(g, A), START_CASH + 6000);
  assert.equal(cash(g, B), START_CASH + 300, 'a jailed owner collects nothing');
  await answer(g, h, false);
});

test('New York: owner earns whenever a city is upgraded', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, NY, B, 1); // Lv 1: $300
  give(g, CAN, A, 0); // Canberra, upgrade $450
  await goto(g, h, A, CAN);
  const a = asked(h, 'deed');
  assert.equal(a.p.mode, 'upgrade');
  assert.equal(a.p.price, 450);
  await answer(g, h, true);
  assert.equal(g.S.own[CAN].lv, 1);
  assert.equal(cash(g, A), START_CASH - 450);
  assert.equal(cash(g, B), START_CASH + 300);
});

test('Las Vegas: a visitor pays the owner the dice total × level rate', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, LV, B, 1); // × $500
  await draw(g, h, [3, 4]); // the casino roll: 7
  await goto(g, h, A, LV);
  assert.equal(cash(g, A), START_CASH - 3500);
  assert.equal(cash(g, B), START_CASH + 3500);
});

test('Rio: owner earns on any doubles, nothing while jailed', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, RIO, B, 1); // $500
  await roll(g, h, [2, 2]); // A rolls doubles
  assert.equal(cash(g, B), START_CASH + 500);
  await answer(g, h, false); // Jakarta deed

  await idle(g, h);
  setFlag(g, B, 'jail');
  await roll(g, h, [4, 4]); // doubles again — the owner is jailed now
  assert.equal(cash(g, B), START_CASH + 500, 'a jailed owner collects nothing');
});

test('Jerusalem: every other player pays the dice total × level rate', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.order;
  give(g, JERU, B, 0); // × $100
  await idle(g, h); // A's turn: just visits jail
  await draw(g, h, [4, 5]); // B's Jerusalem roll: 9
  await goto(g, h, B, JERU);
  assert.equal(cash(g, A), START_CASH - 900);
  assert.equal(cash(g, C), START_CASH - 900);
  assert.equal(cash(g, B), START_CASH + 1800);
  await answer(g, h, false); // B declines the Jerusalem upgrade offered after the toll
});

test('Singapore: adds its level rate to city rent income, stacking with monopoly', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, SG, B, 2); // +20%
  give(g, SYD, B, 0); // Sydney Lv 0: base rent 260
  await goto(g, h, A, SYD);
  assert.equal(cash(g, A), START_CASH - 312); // 260 × 1.2
  assert.equal(cash(g, B), START_CASH + 312);

  await idle(g, h);
  give(g, WEL, B, 0); give(g, CAN, B, 0); // B now holds all of Oceania: monopoly +50%
  give(g, SG, B, 0); // back to +10%
  await goto(g, h, A, SYD);
  assert.equal(cash(g, A), START_CASH - 312 - 416); // 260 × (1 + 0.5 + 0.1)
});

test('Pyongyang: its owner pays less rent on regular cities', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, PYO, A, 2); // −20%
  give(g, SYD, B, 0);
  await goto(g, h, A, SYD);
  assert.equal(cash(g, A), START_CASH - 208); // 260 × 0.8
  assert.equal(cash(g, B), START_CASH + 208);
});

test('specials carry no rent: landing on another player\'s does nothing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, ZUR, B, 0);
  await goto(g, h, A, ZUR);
  assert.equal(cash(g, A), START_CASH);
  assert.equal(cash(g, B), START_CASH);
});

test('specials are bought and upgraded like cities, at their own prices', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  await goto(g, h, A, ZUR); // unowned: deed at $4,000
  assert.equal(asked(h, 'deed').p.price, 4000);
  await answer(g, h, true);
  assert.equal(cash(g, A), START_CASH - 4000);
  assert.equal(g.S.own[ZUR].p, A);

  await idle(g, h);
  await goto(g, h, A, ZUR); // own tile: upgrade offered at `up` = $3,000
  assert.equal(asked(h, 'deed').p.price, 3000);
  await answer(g, h, true);
  assert.equal(g.S.own[ZUR].lv, 1);
  assert.equal(g.S.own[ZUR].paid, 3000);
  assert.equal(stats(g.S, A).val, 4000 + 3000, 'lot value = price + paid upgrades');
  assert.equal(cash(g, A), START_CASH - 7000);
});
