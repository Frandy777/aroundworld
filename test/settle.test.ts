// Paying what the cash can't cover, and leaving the room.
//   shortfall — first any fixed deposit is withdrawn early (public.test), then a pick mortgages lots
//               at half their lot value until the need is met; when even the cheapest lot can't be
//               spared there is nothing to choose and everything is mortgaged; and when that still
//               can't reach it the player goes bankrupt: the creditor gets what could be raised
//               (cash + half lot values) and the estate returns to the bank.
//   forfeit   — a player who leaves the room answers nothing more: an open question settles with its
//               default and they go bankrupt when their next turn comes (staying in the room and
//               giving up is `concede`, covered in concede.test).
//   choices   — only owned lots can be mortgaged, once each; deposits and bets obey their limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, setCash, draw, goto, idle, answer, asked, settle, cash, tileAt, kindAt, TILES, START_CASH } from './harness.ts';

const WEL = tileAt('Wellington'), CAN = tileAt('Canberra'), SYD = tileAt('Sydney'), BANK = kindAt('bank');
const LUCKY = TILES.findIndex((t) => t.kind === 'casino' && t.variant === 'lucky');

test('a shortfall opens a mortgage pick at half the lot value', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, WEL, A, 0); // half of 1600 → 800
  give(g, CAN, A, 0); // 900
  give(g, SYD, B, 1); // rent 650
  setCash(g, A, 500);
  await goto(g, h, A, SYD);
  const pick = asked(h, 'pick');
  assert.equal(pick.to, A);
  assert.equal(pick.p.rule.k, 'raise');
  assert.equal(pick.p.rule.need, 650);
  assert.deepEqual(pick.p.items, [
    { i: WEL, lv: 0, amt: 800 },
    { i: CAN, lv: 0, amt: 900 },
  ]);
  await answer(g, h, [WEL]);
  assert.equal(g.S.own[WEL].m, true);
  assert.equal(g.S.own[CAN].m, false, 'spared');
  assert.equal(cash(g, A), 500 + 800 - 650);
  assert.equal(cash(g, B), START_CASH + 650);
});

test('when even the cheapest lot cannot be spared, everything is mortgaged without asking', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, WEL, A, 0); give(g, CAN, A, 0); // half values 800 + 900
  give(g, SYD, B, 2); // rent 1300
  setCash(g, A, 300); // 300+1700 covers it — but never without the cheapest
  await goto(g, h, A, SYD);
  assert.equal(g.S.own[WEL].m, true);
  assert.equal(g.S.own[CAN].m, true);
  assert(!h.evs.some((e) => e.t === 'ask' && e.p.k === 'pick'), 'nothing to choose, nothing asked');
  assert.equal(cash(g, A), 300 + 1700 - 1300);
  assert.equal(cash(g, B), START_CASH + 1300);
  assert.equal(h.pending.to, B);
});

test('what cannot be raised pays the creditor as the estate goes bankrupt', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  give(g, WEL, A, 0); // can raise 800
  give(g, SYD, B, 3); // rent 2600
  setCash(g, A, 300); // can raise 1100 in all
  await goto(g, h, A, SYD);
  assert.equal(g.S.players[A].out, 1);
  assert.equal(g.S.own[WEL], undefined, 'the property returns to the bank');
  assert.equal(cash(g, A), 0);
  assert.equal(cash(g, B), START_CASH + 1100, 'the creditor receives what could be raised');
  assert(g.S.over, 'a two-player game ends there');
  assert(h.evs.findLast((e) => e.t === 'over'));
});

test('a player who leaves answers by default and goes bankrupt on their next turn', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.order;
  await draw(g, h, [1, 1]); // rig what A is about to roll
  g.forfeit(A); // the open roll question settles with `true`
  await settle();
  assert.equal(g.S.players[A].tile, 2, 'the turn played on to Canberra');
  assert.equal(g.S.own[2], undefined, 'the deed answered itself with no');
  assert.equal(h.pending.to, B, 'the turn ended without A');
  await idle(g, h); // B
  await idle(g, h); // C
  assert.equal(g.S.players[A].out, 2, 'A dropped out when its round-2 turn came');
  assert.deepEqual(g.S.bankrupt, [A]);
  assert.equal(h.pending.to, B);
  g.dispose();
});

test('pick: only a valid selection settles', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  give(g, WEL, A, 0);
  await goto(g, h, A, BANK);
  const pick = asked(h, 'pick');
  g.answer(A, pick.id, [WEL, WEL]); // no duplicates
  g.answer(A, pick.id, [CAN]); // not on the list
  assert.equal(h.pending.id, pick.id);
  await answer(g, h, [WEL]);
  assert.equal(g.S.own[WEL].m, true);
  await answer(g, h, null); // the deposit offer that follows: declined
});

test('dep: whole thousands, within the offer, term 5–15', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  setCash(g, A, 20500);
  await goto(g, h, A, BANK);
  const dep = asked(h, 'dep');
  assert.equal(dep.p.max, 20000);
  for (const bad of [{ amt: 1500, n: 5 }, { amt: 21000, n: 5 }, { amt: 5000, n: 3 }, { amt: 5000, n: 20 }, { amt: 5000.5, n: 5 }])
    g.answer(A, dep.id, bad);
  assert.equal(h.pending.id, dep.id);
  await answer(g, h, null);
  assert.equal(g.S.players[A].dep, null);
});

test('casino: only a fitting wager settles', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.order;
  await draw(g, h, [3, 5]); // one die matches the legal wager
  await goto(g, h, A, LUCKY);
  const a = asked(h, 'casino');
  assert.equal(a.p.view.stage, 'bet');
  g.answer(A, a.id, { act: 'cash' }); // nothing to cash out yet
  g.answer(A, a.id, { act: 'roll', bet: 50, num: 3 }); // under the minimum
  g.answer(A, a.id, { act: 'roll', bet: 150, num: 3 }); // not a multiple of 100
  g.answer(A, a.id, { act: 'roll', bet: 100, num: 7 }); // numbers run 1–6
  assert.equal(h.pending.id, a.id);
  await answer(g, h, { act: 'roll', bet: 100, num: 3 }); // the real wager goes through
  assert.equal(asked(h, 'casino').p.view.stage, 'again');
  await answer(g, h, { act: 'cash' });
});
