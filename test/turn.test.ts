// Turn order and flow.
//   order roll — everyone rolls two dice, the lowest total goes first, ties are settled among the tied.
//   rotation   — turns follow the order; out players are skipped; the round counts when it wraps.
//   again      — Buy One, Get One (news) hands the same player another turn at once.
//   stay       — a held-up player skips one turn; the flag clears (jail/party skips are in public.test).
//   endings    — a limited game ends after its rounds and ranks by net worth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, setFlag, draw, goto, idle, kindAt } from './harness.ts';

const NEWS_T = kindAt('news');

test('the order roll: lowest total first, ties settled among themselves', async () => {
  const { g, h } = await start(3, { rig: [3, 3, 3, 3, 2, 1, 4, 4, 5, 5] });
  const order = h.evs.find((e) => e.t === 'order');
  assert.deepEqual(order.passes, [
    { group: [0, 1, 2], rolls: [[3, 3], [3, 3], [2, 1]] },
    { group: [0, 1], rolls: [[4, 4], [5, 5]] }, // the tied pair rolls again
  ]);
  assert.deepEqual(order.order, [2, 0, 1], 'the 3 goes first, then the pair as re-rolled');
  assert.equal(h.pending.to, 2);
});

test('the turn follows the order, skips the out and counts rounds', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.order;
  assert.equal(h.pending.to, A);
  await idle(g, h);
  assert.equal(h.pending.to, B);
  await idle(g, h);
  assert.equal(h.pending.to, C);
  await idle(g, h);
  assert.equal(h.pending.to, A);
  assert.equal(g.S.round, 2, 'the round counted the wrap');
  g.concede(B);
  await idle(g, h);
  assert.equal(h.pending.to, C, 'an out player is never asked');
  g.dispose();
});

test('Buy One, Get One: the same player goes again at once', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.order;
  await draw(g, h, [22]); // NEWS deck position 22: 'Buy One, Get One'
  await goto(g, h, A, NEWS_T);
  assert.equal(h.pending.to, A, 'A rolls again before B is asked');
  assert.equal(h.evs.filter((e) => e.t === 'turn').length, 2, 'a second turn emitted for A');
  g.dispose();
});

test('stay: a held-up player skips one turn', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.order;
  setFlag(g, B, 'stay'); // what Strait Standoff sets on chokepoint owners
  await idle(g, h); // A's turn ends; B's is skipped
  assert(h.evs.some((e) => e.t === 'skip' && e.pi === B), 'the skip event fired');
  assert.equal(g.S.players[B].stay, false, 'the flag cleared');
  assert.equal(h.pending.to, C);
  g.dispose();
});

test('a limited game ends after its rounds and ranks by net worth', async () => {
  const { g, h } = await start(2, { settings: { mode: 'limited', rounds: 1 } });
  const [A, B] = g.S.order;
  give(g, 1, A); // a holding puts A's net above B's
  await idle(g, h);
  await idle(g, h); // both turns played: the round wraps past 1
  assert(g.S.over);
  const over = h.evs.findLast((e) => e.t === 'over');
  assert(over, 'the over event ranks them');
  assert.deepEqual(over.rank.map((r) => r.p), [A, B]);
});
