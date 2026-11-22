// Turn order and flow.
//   order roll — everyone rolls two dice, the lowest total goes first, ties are settled among the tied.
//   rotation   — turns follow the order; out players are skipped; the round counts when it wraps.
//   again      — Buy One, Get One (news) hands the same player another turn at once.
//   doubles    — rolling doubles lets the player roll again in the same turn after resolving the tile; three in a row send them straight to jail.
//   stay       — a held-up player skips one turn; the flag clears (jail/party skips are in public.test).
//   endings    — a limited game ends after its rounds and ranks by net worth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, putAt, setFlag, cash, draw, goto, roll, idle, asked, answer, kindAt, START_CASH, TILE_COUNT } from './harness.ts';

const NEWS_T = kindAt('news'), JAIL = kindAt('jail'), GOJAIL = kindAt('gojail'), CLUB = kindAt('club');

test('the order roll: lowest total first, ties settled among themselves', async () => {
  const { g, h } = await start(3, { rig: [3, 3, 3, 3, 2, 1, 4, 4, 5, 5] });
  const order = h.evs.find((e) => e.t === 'order');
  assert.deepEqual(order.passes, [
    { group: [0, 1, 2], rolls: [[3, 3], [3, 3], [2, 1]] },
    { group: [0, 1], rolls: [[4, 4], [5, 5]] }, // the tied pair rolls again
  ]);
  assert.deepEqual(order.order, [2, 0, 1], 'the 3 goes first, then the pair as re-rolled');
  assert.equal(h.pending.player, 2);
});

test('the turn follows the order, skips the out and counts rounds', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  assert.equal(h.pending.player, A);
  await idle(g, h);
  assert.equal(h.pending.player, B);
  await idle(g, h);
  assert.equal(h.pending.player, C);
  await idle(g, h);
  assert.equal(h.pending.player, A);
  assert.equal(g.S.round, 2, 'the round counted the wrap');
  g.concede(B);
  await idle(g, h);
  assert.equal(h.pending.player, C, 'an out player is never asked');
  g.dispose();
});

test('Buy One, Get One: the same player goes again at once', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await draw(g, h, [22]); // NEWS deck position 22: 'Buy One, Get One'
  await goto(g, h, A, NEWS_T);
  assert.equal(h.pending.player, A, 'A rolls again before B is asked');
  assert.equal(h.evs.filter((e) => e.t === 'turn').length, 2, 'a second turn emitted for A');
  g.dispose();
});

test('doubles: resolves the tile first, then rolls again within the same turn', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, 1, A, 0, true); // mortgaged tile: a new turn would re-offer redeem
  await roll(g, h, [1, 1]); // lands on Canberra (tile 2)
  assert.equal(asked(h, 'deed').player, A, 'landing effect resolves before the bonus roll');
  await answer(g, h, false);
  assert.equal(asked(h, 'roll').player, A, 'A rolls again without re-offering redeem');
  assert.equal(h.evs.filter((e) => e.t === 'turn').length, 1, 'still within A’s single turn');

  await roll(g, h, [1, 2]); // non-doubles: moves to Singapore (tile 5)
  await answer(g, h, false);
  assert.equal(asked(h, 'roll').player, B, 'turn passes to B after non-doubles');
  assert.equal(h.evs.filter((e) => e.t === 'turn').length, 2);
  g.dispose();
});

test('three consecutive doubles send the player straight to jail without moving', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await roll(g, h, [1, 1]); // 1st double: tile 2
  await answer(g, h, false);
  assert.equal(asked(h, 'roll').player, A);

  await roll(g, h, [2, 2]); // 2nd double: tile 6
  await answer(g, h, false);
  assert.equal(asked(h, 'roll').player, A);
  assert.equal(h.evs.filter((e) => e.t === 'turn').length, 1, 'still the same turn');

  putAt(g, A, TILE_COUNT - 2); // would pass START if the 3rd double moved
  await roll(g, h, [3, 3]); // 3rd double: straight to jail
  assert.equal(g.S.players[A].tile, JAIL, 'jumped straight to jail');
  assert.equal(g.S.players[A].jail, true, 'jailed');
  assert.equal(cash(g, A), START_CASH, 'did not walk past START');
  assert.equal(asked(h, 'roll').player, B, 'turn ended and passed to B');
  assert.equal(h.evs.filter((e) => e.t === 'turn').length, 2, 'A’s entire streak was one turn');
  g.dispose();
});

test('doubles: landing on a tile that jails or holds the player ends the turn', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  putAt(g, A, GOJAIL - 2);
  await roll(g, h, [1, 1]); // lands on Go To Jail
  assert.equal(g.S.players[A].jail, true);
  assert.equal(asked(h, 'roll').player, B, 'being jailed ends the doubles streak');

  putAt(g, B, CLUB - 2);
  await roll(g, h, [1, 1]); // lands on Nightclub
  assert.equal(g.S.players[B].party, true);
  assert.equal(asked(h, 'roll').player, C, 'being held up ends the doubles streak');
  g.dispose();
});

test('stay: a held-up player skips one turn', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  setFlag(g, B, 'stay'); // what Strait Standoff sets on chokepoint owners
  await idle(g, h); // A's turn ends; B's is skipped
  assert(h.evs.some((e) => e.t === 'skip' && e.player === B), 'the skip event fired');
  assert.equal(g.S.players[B].stay, false, 'the flag cleared');
  assert.equal(h.pending.player, C);
  g.dispose();
});

test('a limited game ends after its rounds and ranks by net worth', async () => {
  const { g, h } = await start(2, { settings: { mode: 'limited', rounds: 1 } });
  const [A, B] = g.S.turnOrder;
  give(g, 1, A); // a holding puts A's net above B's
  await idle(g, h);
  await idle(g, h); // both turns played: the round wraps past 1
  assert(g.S.over);
  const over = h.evs.findLast((e) => e.t === 'over');
  assert(over, 'the over event ranks them');
  assert.deepEqual(over.rank.map((r) => r.player), [A, B]);
});
