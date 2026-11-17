// Regular cities: bought, upgraded, rented.
//   unowned — a BUY offer at the tile's price; nothing is asked when cash can't reach it. Buying records paid 0.
//   upgrade — an UPGRADE card at `up` per level, to Lv 3; a maxed lot stays silent.
//   rent    — price/10, /4, /2, /1 by level; a whole region in one hand adds 50% (monopoly);
//             a mortgaged tile or a jailed owner collects nothing.
//   redeem  — a turn may open by buying mortgaged lots back at their full lot value — offered only
//             while the cheapest is affordable, and the pick must fit the cash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, setCash, setFlag, goto, idle, answer, asked, cash, tileAt, TILES, START_CASH, maxLevel, hasMonopoly } from './harness.ts';

const WEL = tileAt('Wellington'), CAN = tileAt('Canberra'), SYD = tileAt('Sydney'); // Oceania

test('an unowned city offers a BUY card at its price', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await goto(g, h, A, WEL);
  const a = asked(h, 'deed');
  assert.equal(a.prompt.mode, 'buy');
  assert.equal(a.prompt.tile, WEL);
  assert.equal(a.prompt.price, 1600);
  await answer(g, h, true);
  assert.deepEqual(g.S.ownedByTile[WEL], { owner: A, level: 0, mortgaged: false, upgradePaid: 0 });
  assert.equal(cash(g, A), START_CASH - 1600);

  await goto(g, h, B, CAN); // B's turn: declining buys nothing
  await answer(g, h, false);
  assert.equal(g.S.ownedByTile[CAN], undefined);
  assert.equal(cash(g, B), START_CASH);
});

test('no card when the price is out of reach', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  setCash(g, A, 100);
  await goto(g, h, A, WEL);
  assert.equal(g.S.ownedByTile[WEL], undefined);
  assert(!h.evs.some((e) => e.t === 'ask' && e.prompt.k === 'deed'), 'nothing was asked');
  assert.equal(h.pending.player, B);
});

test('an owned city offers UPGRADE at `up`; a maxed lot stays silent', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, WEL, A, 0);
  await goto(g, h, A, WEL);
  const a = asked(h, 'deed');
  assert.equal(a.prompt.mode, 'upgrade');
  assert.equal(a.prompt.price, 400);
  await answer(g, h, true);
  assert.equal(g.S.ownedByTile[WEL].level, 1);
  assert.equal(g.S.ownedByTile[WEL].upgradePaid, 400);
  assert.equal(cash(g, A), START_CASH - 400);

  await idle(g, h);
  give(g, WEL, A, maxLevel(TILES[WEL])); // topped out
  const deeds = h.evs.filter((e) => e.t === 'ask' && e.prompt.k === 'deed').length;
  await goto(g, h, A, WEL);
  assert.equal(h.evs.filter((e) => e.t === 'ask' && e.prompt.k === 'deed').length, deeds, 'no card at max level');
  assert.equal(h.pending.player, B);
});

test('city rent by level: price/10, /4, /2, price', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  const rents = [160, 400, 800, 1600]; // Wellington: price 1600
  for (let lv = 0; lv < 4; lv++) {
    give(g, WEL, B, lv);
    const [a0, b0] = [cash(g, A), cash(g, B)];
    await goto(g, h, A, WEL);
    assert.equal(cash(g, A), a0 - rents[lv], `Lv ${lv}`);
    assert.equal(cash(g, B), b0 + rents[lv]);
    await idle(g, h);
  }
});

test('a whole region in one hand adds 50% to the rent', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, SYD, B, 0);
  await goto(g, h, A, SYD);
  assert.equal(cash(g, A), START_CASH - 260, 'no monopoly yet');

  await idle(g, h);
  give(g, WEL, B, 0); give(g, CAN, B, 0); // all of Oceania now
  assert(hasMonopoly(g.S, TILES[SYD]));
  await goto(g, h, A, SYD);
  assert.equal(cash(g, A), START_CASH - 260 - 390);
  assert.equal(cash(g, B), START_CASH + 260 + 390);
});

test('a mortgaged city, or a jailed owner, collects nothing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, WEL, B, 1, true); // mortgaged
  await goto(g, h, A, WEL);
  assert.equal(cash(g, A), START_CASH);
  assert.equal(cash(g, B), START_CASH);

  await answer(g, h, null); // B declines its redeem offer first
  await idle(g, h);
  give(g, WEL, B, 1); // working again — but the owner is in jail
  setFlag(g, B, 'jail');
  await goto(g, h, A, WEL);
  assert.equal(cash(g, A), START_CASH);
  assert.equal(cash(g, B), START_CASH);
});

test('redeem: a turn may open by buying mortgaged lots back', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, WEL, A, 1, true); // lot value 2000
  give(g, CAN, A, 0, true); // 1800
  setCash(g, A, 2500);
  await idle(g, h); // A idles its first turn; the redeem pick opens the next
  await idle(g, h);
  const a = asked(h, 'pick');
  assert.equal(a.player, A);
  assert.equal(a.prompt.rule.k, 'redeem');
  assert.deepEqual(a.prompt.items, [{ index: WEL, amount: 2000 }, { index: CAN, amount: 1800 }]);
  g.answer(A, a.id, [WEL, CAN]); // 3800 over the cash: refused
  assert.equal(h.pending.id, a.id);
  await answer(g, h, [WEL]);
  assert.equal(g.S.ownedByTile[WEL].mortgaged, false);
  assert.equal(g.S.ownedByTile[CAN].mortgaged, true, 'still mortgaged');
  assert.equal(cash(g, A), 500);
  assert.equal(asked(h, 'roll').player, A, 'the roll question follows');
});

test('redeem is not offered when even the cheapest lot is out of reach', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, CAN, A, 0, true); // lot value 1800
  setCash(g, A, 1000);
  await idle(g, h);
  await idle(g, h); // back to A's turn
  assert.equal(h.pending.prompt.k, 'roll', 'no redeem pick — straight to the roll');
});
