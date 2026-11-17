// Declaring bankruptcy while staying in the room: the player is out at once — properties and
// deposits go back to the bank — but keeps watching (leaving the room forfeits instead).
// Bankruptcy persists across a restart mid-turn; a pick whose
// player gave up must not touch the estate, and a payment owed to a player who went out
// meanwhile goes to the bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, host, start, orderRig, give, setCash, setDep, goto, answer, playUntil, settle, cash, cur } from './harness.ts';

test('concede during own roll ask: out at once, turn ends, next player asked', async () => {
  const { g, h } = await start(3, { dev: false, rig: [...orderRig(3), 1, 2] });
  const [p0, p1, p2] = g.S.turnOrder;
  assert.equal(h.pending.player, p0, 'first turn asks the first player');
  g.concede(p0);
  await settle();
  assert.equal(g.S.players[p0].bankruptRound, 1);
  assert.deepEqual(g.S.bankruptOrder, [p0]);
  assert.equal(h.pending.player, p1, 'turn passed to the next player');

  g.concede(p2); // concedes during someone else's turn: out now, their question untouched
  await settle();
  assert.equal(g.S.players[p2].bankruptRound, 1);
  assert.equal(h.pending.player, p1, 'player still being asked');
  await answer(g, h, true); // roll
  // the last one standing plays on alone: answer whatever is asked until the game is over
  await playUntil(g, h, () => g.S.over);
  assert(g.S.over, 'game ends when one player left');
  assert.equal(g.S.players[p1].bankruptRound, 0, 'last player standing wins');
  const over = h.evs.findLast((e) => e.t === 'over');
  assert(over, 'over event emitted');
  assert.deepEqual(over.rank.map((r) => r.player), [p1, p2, p0], 'last out ranks above first out');
  await g.done.catch(() => {});
});

test('concede with holdings: everything goes back to the bank', async () => {
  const { g, h } = await start(2, { dev: false });
  const me = cur(g);
  give(g, 1, me, 2);
  setDep(g, me, 1000, 5);
  assert.equal(h.pending.player, me);
  g.concede(me);
  await settle();
  assert.equal(g.S.ownedByTile[1], undefined, 'property back to the bank');
  assert.equal(g.S.players[me].deposit, null, 'deposit gone');
  assert.equal(g.S.players[me].cash, 0, 'cash zeroed');
  assert(h.evs.findLast((e) => e.t === 'over'), '2p game over immediately');
});

test('restart mid-turn: the conceded bankruptcy is re-applied', async () => {
  const { g: g1 } = await start(3, { dev: false, rig: [...orderRig(3), 1, 2] });
  const q = g1.S.turnOrder[1]; // whoever is second in turn order concedes during the first player's turn
  assert.notEqual(cur(g1), q);
  g1.concede(q);
  await settle();
  const saved = g1.saved;

  // restart: new Game from the checkpoint, replay the tape, then re-apply conceded (what room.ts does)
  const h2 = host(), g2 = new Game(h2, saved.checkpoint);
  await g2.resume(saved);
  for (const pi of saved.concededPlayers ?? []) g2.concede(pi);
  await settle();
  assert.equal(g2.S.players[q].bankruptRound, 1, 'conceded player out again after restart');
  assert.deepEqual(g2.S.bankruptOrder, [q]);
  const open = g2.openAskEvent;
  assert(open && open.t === 'ask' && open.player !== q, 'game continues without them');
  g2.answer(open.player, open.id, true); // the next move cannot bring the bankrupt player back
  await settle();
  assert.equal(g2.S.players[q].bankruptRound, 1);
  assert.equal(cash(g2, q), 0);
  assert.deepEqual(g2.S.bankruptOrder, [q]);
  g1.dispose();
  g2.dispose();
});

test('concede mid mortgage-pick: the ask\'s continuation must not touch the estate', async () => {
  const { g, h } = await start(3);
  const [A, B] = g.S.turnOrder;
  give(g, 1, A, 0); // Wellington: mortgaging raises 800
  give(g, 2, A, 0); // Canberra: 900 more — enough to avoid a forced mortgage
  give(g, 3, B, 1); // Sydney Lv 1: rent 650
  setCash(g, A, 500);
  await goto(g, h, A, 3);
  const pick = h.pending;
  assert(pick && pick.prompt.k === 'pick' && pick.prompt.rule.k === 'raise' && pick.player === A, 'mortgage-to-pay question is up');
  const bCash = cash(g, B); // the cash part of the rent is already paid
  g.concede(A); // gives up instead of picking
  await settle();
  assert.equal(g.S.players[A].bankruptRound, 1);
  assert.equal(g.S.ownedByTile[1], undefined, 'A\'s properties went to the bank, unmortgaged');
  assert.equal(g.S.ownedByTile[2], undefined);
  assert.equal(g.S.ownedByTile[3].owner, B, 'B keeps Sydney');
  assert.equal(cash(g, B), bCash, 'B keeps what was paid — the estate went to the bank');
  assert(!h.pending || h.pending.player !== A, 'no question left for A');
  g.dispose(); // 2p left, endless: the game runs on
});

test('the creditor concedes mid pick: the payment goes to the bank', async () => {
  const { g, h } = await start(3);
  const [A, B] = g.S.turnOrder;
  give(g, 1, A, 0);
  give(g, 2, A, 0);
  give(g, 3, B, 1);
  setCash(g, A, 500);
  await goto(g, h, A, 3);
  const pick = h.pending;
  assert(pick && pick.player === A, 'mortgage-to-pay question is up');
  g.concede(B); // the landlord gives up while the tenant is picking
  await settle();
  assert.equal(g.S.players[B].bankruptRound, 1);
  assert.equal(g.S.ownedByTile[3], undefined, 'B\'s Sydney went to the bank');
  assert.equal(h.pending.player, A, 'A\'s question still stands');
  await answer(g, h, [1]); // A mortgages Wellington
  assert.equal(g.S.ownedByTile[1].mortgaged, true, 'Wellington mortgaged');
  assert.equal(g.S.ownedByTile[1].owner, A);
  assert.equal(cash(g, A), 800 - 150, 'the rest of the 650 rent went to the bank, not to B');
  assert.equal(cash(g, B), 0, 'bankruptcy took what B had collected');
  g.dispose();
});

test('concede twice or after the game is over: no-ops', async () => {
  const { g } = await start(2, { dev: false });
  const me = cur(g);
  g.concede(me);
  g.concede(me); // already out
  await settle();
  assert.deepEqual(g.S.bankruptOrder, [me]);
  const other = g.S.turnOrder.find((p) => p !== me);
  g.concede(other); // the game is over already
  await settle();
  assert.equal(g.S.players[other].bankruptRound, 0, 'concede ignored once over');
  g.dispose();
});
