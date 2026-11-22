// Paying what the cash can't cover, and leaving the room.
//   shortfall — first any fixed deposit is withdrawn early (public.test), then the player's cash is
//               handed over and the rest is raised by a pick mortgaging lots at half their lot value;
//               when even the cheapest lot can't be spared there is nothing to choose and everything
//               is mortgaged; and when that still can't reach it the player goes bankrupt: the creditor
//               gets what could be raised (cash + half lot values) and the estate returns to the bank.
//   forfeit   — a player who leaves the room answers nothing more: an open question settles with its
//               default and they go bankrupt when their next turn comes (staying in the room and
//               giving up is `concede`, covered in concede.test).
//   choices   — only owned lots can be mortgaged, once each; deposits and bets obey their limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, setCash, draw, goto, idle, answer, asked, settle, cash, tileAt, kindAt, TILES, START_CASH } from './harness.ts';

const WEL = tileAt('Wellington'), CAN = tileAt('Canberra'), SYD = tileAt('Sydney'), BANK = kindAt('bank');
const LUCKY = TILES.findIndex((t) => t.kind === 'casino' && t.variant === 'lucky');

test('a shortfall hands over the cash first, then opens a mortgage pick at half the lot value', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, WEL, A, 0); // half of 1600 → 800
  give(g, CAN, A, 0); // 900
  give(g, SYD, B, 1); // rent 650
  setCash(g, A, 500);
  await goto(g, h, A, SYD);
  const pick = asked(h, 'pick');
  assert.equal(pick.player, A);
  assert.equal(pick.prompt.rule.k, 'raise');
  assert.equal(cash(g, A), 0, 'the cash is already paid');
  assert.equal(cash(g, B), START_CASH + 500, 'the creditor received it');
  assert.equal(pick.prompt.rule.cash, 0);
  assert.equal(pick.prompt.rule.need, 150, 'what is still owed');
  assert.deepEqual(pick.prompt.items, [
    { index: WEL, level: 0, amount: 800 },
    { index: CAN, level: 0, amount: 900 },
  ]);
  await answer(g, h, [WEL]);
  assert.equal(g.S.ownedByTile[WEL].mortgaged, true);
  assert.equal(g.S.ownedByTile[CAN].mortgaged, false, 'spared');
  assert.equal(cash(g, A), 800 - 150);
  assert.equal(cash(g, B), START_CASH + 650);
});

test('when even the cheapest lot cannot be spared, everything is mortgaged without asking', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, WEL, A, 0); give(g, CAN, A, 0); // half values 800 + 900
  give(g, SYD, B, 2); // rent 1300
  setCash(g, A, 300); // pays the 300 in cash; the other 1,000 needs both lots — never without the cheapest
  await goto(g, h, A, SYD);
  assert.equal(g.S.ownedByTile[WEL].mortgaged, true);
  assert.equal(g.S.ownedByTile[CAN].mortgaged, true);
  assert(!h.evs.some((e) => e.t === 'ask' && e.prompt.k === 'pick'), 'nothing to choose, nothing asked');
  assert.equal(cash(g, A), 1700 - 1000);
  assert.equal(cash(g, B), START_CASH + 1300);
  assert.equal(h.pending.player, B);
});

test('what cannot be raised pays the creditor as the estate goes bankrupt', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, WEL, A, 0); // can raise 800
  give(g, SYD, B, 3); // rent 2600
  setCash(g, A, 300); // can raise 1100 in all
  await goto(g, h, A, SYD);
  assert.equal(g.S.players[A].bankruptRound, 1);
  assert.equal(g.S.ownedByTile[WEL], undefined, 'the property returns to the bank');
  assert.equal(cash(g, A), 0);
  assert.equal(cash(g, B), START_CASH + 1100, 'the creditor receives what could be raised');
  assert(g.S.over, 'a two-player game ends there');
  assert(h.evs.findLast((e) => e.t === 'over'));
});

test('a player who leaves answers by default and goes bankrupt on their next turn', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  await draw(g, h, [1, 2]); // rig what A is about to roll
  g.forfeit(A); // the open roll question settles with `true`
  await settle();
  assert.equal(g.S.players[A].tile, 3, 'the turn played on to Sydney');
  assert.equal(g.S.ownedByTile[3], undefined, 'the deed answered itself with no');
  assert.equal(h.pending.player, B, 'the turn ended without A');
  await idle(g, h); // B
  await idle(g, h); // C
  assert.equal(g.S.players[A].bankruptRound, 2, 'A dropped out when its round-2 turn came');
  assert.deepEqual(g.S.bankruptOrder, [A]);
  assert.equal(h.pending.player, B);
  g.dispose();
});

test('pick: only a valid selection settles', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, WEL, A, 0);
  await goto(g, h, A, BANK);
  const pick = asked(h, 'pick');
  g.answer(A, pick.id, [WEL, WEL]); // no duplicates
  g.answer(A, pick.id, [CAN]); // not on the list
  assert.equal(h.pending.id, pick.id);
  await answer(g, h, [WEL]);
  assert.equal(g.S.ownedByTile[WEL].mortgaged, true);
  await answer(g, h, null); // the deposit offer that follows: declined
});

test('dep: whole thousands, within the offer, term 5–15', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  setCash(g, A, 20500);
  await goto(g, h, A, BANK);
  const dep = asked(h, 'dep');
  assert.equal(dep.prompt.maxPrincipal, 20000);
  for (const bad of [{ principal: 1500, termRounds: 5 }, { principal: 21000, termRounds: 5 }, { principal: 5000, termRounds: 3 }, { principal: 5000, termRounds: 20 }, { principal: 5000.5, termRounds: 5 }])
    g.answer(A, dep.id, bad);
  assert.equal(h.pending.id, dep.id);
  await answer(g, h, null);
  assert.equal(g.S.players[A].deposit, null);
});

test('casino: only a fitting wager settles', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [3, 5]); // one die matches the legal wager
  await goto(g, h, A, LUCKY);
  const a = asked(h, 'casino');
  assert.equal(a.prompt.view.stage, 'bet');
  g.answer(A, a.id, { act: 'cash' }); // nothing to cash out yet
  g.answer(A, a.id, { act: 'roll', bet: 50, pickedNumber: 3 }); // under the minimum
  g.answer(A, a.id, { act: 'roll', bet: 150, pickedNumber: 3 }); // not a multiple of 100
  g.answer(A, a.id, { act: 'roll', bet: 100, pickedNumber: 7 }); // numbers run 1–6
  assert.equal(h.pending.id, a.id);
  await answer(g, h, { act: 'roll', bet: 100, pickedNumber: 3 }); // the real wager goes through
  assert.equal(asked(h, 'casino').prompt.view.stage, 'again');
  await answer(g, h, { act: 'cash' });
});
