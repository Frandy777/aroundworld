// Investments: ownable companies with no building levels and no ordinary rent — each applies its effect.
// They can never be mortgaged, but a mortgaged property elsewhere still counts... except investments
// can't be mortgaged in the first place: only cities and specials can.
//   Transport Co.  — a visitor pays rent of $500 / $1,000 / $2,000 while the owner holds 1 / 2 / 3 transport companies.
//   Construction   — the owner's upgrade of any city from empty land to Lv 1 costs nothing (and adds no lot value).
//   Military Base  — the owner stopping here may pay $500 to bring any built city down by 1 level.
//   Chokepoint     — players passing or stopping pay $200 / $300 / $400 / $500 while the owner holds 1–4 chokepoints.
//   Oil Co.        — the owner earns $400 whenever they pass their own oil tile; stopping there pays nothing.
//   Media          — whenever anyone triggers News the owner earns $200; the owner triggering News may discard it and draw again.
//   Prison Island  — whenever anyone goes to jail the owner earns $700; a jailed owner may pay $700 bail and skip the stay.
// Shared rules: a jailed owner collects nothing; landing on your own investment is uneventful.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, putAt, draw, goto, roll, idle, answer, asked, cash, tileAt, kindAt, TILES, START_CASH, lotValue, canMortgage } from './harness.ts';

const [CR, MAE, UA] = ['China Railway', 'Maersk', 'United Airlines'].map(tileAt); // transport
const [MAL, BER, PAN, HOR] = ['Strait of Malacca', 'Bering Strait', 'Panama Canal', 'Strait of Hormuz'].map(tileAt); // chokepoints
const [CSCEC] = ['CSCEC'].map(tileAt); // construction
const WSB = tileAt('West Sea Base'); // military
const VENO = tileAt('Venezuela Oil'); // oil
const BBC = tileAt('BBC'), DEVIL = tileAt("Devil's Island");
const WEL = tileAt('Wellington'), SYD = tileAt('Sydney');
const JAIL = kindAt('jail'), GOJAIL = kindAt('gojail'), NEWS_T = kindAt('news');

test('Transport: rent scales with companies held', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, CR, B);
  await goto(g, h, A, CR);
  assert.equal(cash(g, A), START_CASH - 500);
  assert.equal(cash(g, B), START_CASH + 500);

  await idle(g, h);
  give(g, MAE, B);
  await goto(g, h, A, CR);
  assert.equal(cash(g, A), START_CASH - 1500); // $1,000 for two companies

  await idle(g, h);
  give(g, UA, B);
  await goto(g, h, A, MAE);
  assert.equal(cash(g, A), START_CASH - 3500); // $2,000 for three
  assert.equal(cash(g, B), START_CASH + 3500);
});

test('Chokepoint: toll on pass and on stop, scaling with count', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, MAL, B);
  putAt(g, A, MAL - 1); // on Singapore
  await roll(g, h, [1, 1]); // passes Malacca, lands on Kuala Lumpur
  assert.equal(cash(g, A), START_CASH - 200);
  assert.equal(cash(g, B), START_CASH + 200);
  await answer(g, h, false); // Kuala Lumpur deed

  await idle(g, h);
  await goto(g, h, A, MAL); // stopping pays the toll too
  assert.equal(cash(g, A), START_CASH - 400);
  assert.equal(cash(g, B), START_CASH + 400);

  await idle(g, h);
  for (const i of [BER, PAN, HOR]) give(g, i, B); // four chokepoints held: $500
  putAt(g, A, MAL - 1);
  await roll(g, h, [1, 1]);
  assert.equal(cash(g, A), START_CASH - 900);
  assert.equal(cash(g, B), START_CASH + 900);
  await answer(g, h, false);
});

test('Oil: owner earns $400 passing their own tile — not stopping, not others passing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, VENO, A);
  putAt(g, A, VENO - 1); // on Bogotá
  await roll(g, h, [1, 1]); // A passes its own oil, lands on Buenos Aires
  assert.equal(cash(g, A), START_CASH + 400);
  await answer(g, h, false); // Buenos Aires deed

  await idle(g, h);
  await goto(g, h, A, VENO); // stopping on own oil: uneventful
  assert.equal(cash(g, A), START_CASH + 400);

  await idle(g, h);
  putAt(g, B, VENO - 1);
  await roll(g, h, [1, 1]); // B walks past A's oil
  assert.equal(cash(g, B), START_CASH);
  assert.equal(cash(g, A), START_CASH + 400);
  await answer(g, h, false); // B declines Buenos Aires
});

test('Construction: the upgrade from empty land to Lv 1 is free', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  give(g, CSCEC, A);
  give(g, WEL, A, 0);
  await goto(g, h, A, WEL);
  assert.equal(asked(h, 'deed').p.price, 0);
  await answer(g, h, true);
  assert.equal(g.S.own[WEL].lv, 1);
  assert.equal(g.S.own[WEL].paid, 0, 'a free upgrade adds no lot value');
  assert.equal(cash(g, A), START_CASH);
  assert.equal(lotValue(TILES[WEL], g.S.own[WEL]), 1600, 'lot value counts price only');
});

test('without Construction the same upgrade costs its price', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  give(g, WEL, A, 0); // Wellington: upgrade $400
  await goto(g, h, A, WEL);
  assert.equal(asked(h, 'deed').p.price, 400);
  await answer(g, h, true);
  assert.equal(g.S.own[WEL].lv, 1);
  assert.equal(g.S.own[WEL].paid, 400);
  assert.equal(cash(g, A), START_CASH - 400);
});

test('Military Base: owner may pay $500 to lower any built city', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, WSB, A);
  give(g, SYD, B, 2); // paid assumed 2 × 650 = 1300
  await goto(g, h, A, WSB);
  const a = asked(h, 'pick');
  assert.deepEqual(a.p.items.map((x) => x.i), [SYD], 'every built city is a target');
  await answer(g, h, [SYD]);
  assert.equal(g.S.own[SYD].lv, 1);
  assert.equal(g.S.own[SYD].paid, 650, 'one upgrade is removed from the lot value');
  assert.equal(cash(g, A), START_CASH - 500);
  assert(h.evs.some((e) => e.t === 'strike' && e.to === SYD));
});

test('Military Base: skipping the strike costs nothing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, WSB, A);
  give(g, SYD, B, 2);
  await goto(g, h, A, WSB);
  await answer(g, h, null); // SKIP
  assert.equal(g.S.own[SYD].lv, 2);
  assert.equal(cash(g, A), START_CASH);
});

test('Media: owner earns $200 whenever anyone triggers News', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, BBC, B);
  await draw(g, h, [1, 1]); // first NEWS card (Lost Wallet), first amount ($20)
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH + 200);
  assert.equal(cash(g, A), START_CASH + 20, 'the drawn story still runs');
});

test('Media: the owner may discard their own News and draw again', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  give(g, BBC, A);
  await draw(g, h, [1, 1, 5, 1]); // Lost Wallet ($20) → redrawn as Insurance Adjustment ($30)
  await goto(g, h, A, NEWS_T);
  asked(h, 'news');
  await answer(g, h, true); // discard and draw again
  assert.equal(cash(g, A), START_CASH + 200 - 30, 'own $200 bonus minus the redrawn premium');
});

test("Devil's Island: owner earns $700 whenever anyone is jailed", async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, DEVIL, B);
  await goto(g, h, A, GOJAIL);
  assert.equal(g.S.players[A].jail, true);
  assert.equal(g.S.players[A].tile, JAIL);
  assert.equal(cash(g, B), START_CASH + 700);
});

test("Devil's Island: a jailed owner may pay $700 bail and skip the stay", async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  give(g, DEVIL, A);
  await goto(g, h, A, GOJAIL);
  asked(h, 'confirm');
  await answer(g, h, true); // PAY $700
  assert.equal(cash(g, A), START_CASH - 700);
  assert.equal(g.S.players[A].tile, JAIL, 'still visits the Jail tile');
  assert.equal(g.S.players[A].jail, false, 'but is not jailed');
});

test("Devil's Island: declining bail jails the owner — and pays them nothing", async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  give(g, DEVIL, A);
  await goto(g, h, A, GOJAIL);
  await answer(g, h, false); // GO TO JAIL
  assert.equal(g.S.players[A].jail, true);
  assert.equal(cash(g, A), START_CASH, 'a jailed owner collects nothing — even their own bonus');
});

test('investments cannot be mortgaged — cities and specials can', () => {
  assert.equal(canMortgage(TILES[CR]), false);
  assert.equal(canMortgage(TILES[WSB]), false);
  assert.equal(canMortgage(TILES[VENO]), false);
  assert.equal(canMortgage(TILES[SYD]), true);
  assert.equal(canMortgage(TILES[tileAt('Zurich')]), true);
});
