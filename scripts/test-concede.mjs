import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// game.ts uses constructor parameter properties, which Node's strip-only TS mode rejects: test against an esbuild bundle instead.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({ entryPoints: [path.join(root, 'src/worker/game.ts')], bundle: true, format: 'esm', platform: 'node', write: false });
const { Game, fresh } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function mockHost() {
  const evs = [];
  return {
    evs,
    emit(ev) { evs.push(ev); },
    online: () => true,
    bot: () => false,
    anyOnline: () => true,
    save() {},
    dev: false,
  };
}

const names = (n) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, color: i }));
const pend = (h) => h.evs.findLast((e) => e.t === 'ask');
const cur = (g) => g.S.order[g.S.turn];

// ---- 1. Concede during own roll ask: out at once, turn ends, next player asked ----
{
  const h = mockHost(), g = new Game(h, fresh(names(3), { mode: 'limited', rounds: 30 }));
  const done = g.run();
  await sleep();
  const [p0, p1, p2] = g.S.order;
  let a = pend(h);
  assert.equal(a.to, p0, 'first turn asks the first player');
  g.concede(p0);
  await sleep();
  assert.equal(g.S.players[p0].out, 1, 'current player is out');
  assert.deepEqual(g.S.bankrupt, [p0]);
  a = pend(h);
  assert.equal(a.to, p1, 'turn passed to the next player');
  assert(h.evs.some((e) => e.t === 'close'), 'pending question closed');
  assert(h.evs.some((e) => e.t === 'toast'), 'toast emitted');
  assert.deepEqual(g.saved.conceded, [p0], 'conceded persisted in save');

  // ---- 2. Concede during someone else's turn: out now, their question untouched ----
  a = pend(h);
  assert.equal(a.to, p1);
  g.concede(p2);
  await sleep();
  assert.equal(g.S.players[p2].out, 1);
  a = pend(h);
  assert.equal(a.to, p1, 'player still being asked');
  g.answer(p1, a.id, true); // roll
  // the last one standing plays on alone: answer whatever is asked until the game is over
  for (let i = 0; i < 400 && !g.S.over; i++) {
    await sleep(5);
    const q = pend(h);
    if (q) g.answer(q.to, q.id, answerFor(q.p));
  }
  assert(g.S.over, 'game ends when one player left');
  assert.equal(g.S.players[p1].out, 0, 'last player standing wins');
  const over = h.evs.findLast((e) => e.t === 'over');
  assert(over, 'over event emitted');
  assert.deepEqual(over.rank.map((r) => r.p), [p1, p2, p0], 'last out ranks above first out');
  await done.catch(() => {});
}

function answerFor(p) {
  switch (p.k) {
    case 'roll': return true;
    case 'deed': return false; // never buy
    case 'confirm': case 'news': return false;
    case 'dep': return null;
    case 'pick': {
      if (p.skip) return null;
      if (p.rule.k === 'raise') { // greedy, like the timeout fallback
        let need = p.rule.need - p.rule.cash;
        const sel = [];
        for (const x of [...p.items].sort((a, b) => (b.amt ?? 0) - (a.amt ?? 0))) { if (need <= 0) break; sel.push(x.i); need -= x.amt ?? 0; }
        return sel;
      }
      return p.items.slice(0, 1).map((x) => x.i);
    }
    case 'casino': return p.view.stage === 'bet' || p.view.stage === 'play' ? { act: 'roll', bet: p.view.bet } : { act: 'cash' };
    default: return false;
  }
}

// ---- 3. Concede with properties: everything back to the bank ----
{
  const h = mockHost(), g = new Game(h, fresh(names(2), { mode: 'endless', rounds: 30 }));
  const done = g.run();
  await sleep();
  const me = cur(g);
  g.emit({ t: 'own', i: 1, o: { p: me, lv: 2, m: false } });
  g.emit({ t: 'dep', pi: me, d: { amt: 1000, n: 5, made: 1 } });
  assert.equal(pend(h).to, me);
  g.concede(me);
  await sleep();
  assert.equal(g.S.own[1], undefined, 'property back to the bank');
  assert.equal(g.S.players[me].dep, null, 'deposit gone');
  assert.equal(g.S.players[me].cash, 0, 'cash zeroed');
  const over = h.evs.findLast((e) => e.t === 'over');
  assert(over, '2p game over immediately');
  await done.catch(() => {});
}

// ---- 4. Save/restore mid-turn: a restart re-applies the conceded bankruptcy ----
{
  const h1 = mockHost(), g1 = new Game(h1, fresh(names(3), { mode: 'limited', rounds: 30 }));
  void g1.run();
  await sleep();
  const q = g1.S.order[1]; // whoever is second in turn order concedes during the first player's turn
  assert.notEqual(cur(g1), q);
  g1.concede(q);
  await sleep();
  const saved = g1.saved;
  assert.deepEqual(saved.conceded, [q]);

  // restart: new Game from the checkpoint, replay the tape, then re-apply conceded (what room.ts does)
  const h2 = mockHost(), g2 = new Game(h2, saved.ckpt);
  await g2.resume(saved);
  for (const pi of saved.conceded ?? []) g2.concede(pi);
  await sleep();
  assert.equal(g2.S.players[q].out, 1, 'conceded player out again after restart');
  assert.deepEqual(g2.S.bankrupt, [q]);
  const open = g2.pendingEv; // the in-flight question is restored, not re-emitted: it waits on its old clock
  assert(open && open.t === 'ask' && open.to !== q, 'game continues without them');
  g2.answer(open.to, open.id, true); // let the turn play out a little
  await sleep(50);
  assert(!g2.S.players[q].out || g2.S.bankrupt.length === 1);
  g2.dispose();
}

// ---- 6. Concede mid mortgage-pick: the ask's continuation must not touch the estate ----
{
  // dev host: the roll question takes {c:'goto'} commands, so the victim lands on the rented city on demand
  const h = { ...mockHost(), dev: true }, g = new Game(h, fresh(names(3), { mode: 'endless', rounds: 30 }));
  void g.run();
  await sleep();
  const [A, B] = g.S.order;
  g.emit({ t: 'own', i: 1, o: { p: A, lv: 0, m: false } }); // Wellington: mortgaging raises 800
  g.emit({ t: 'own', i: 2, o: { p: A, lv: 0, m: false } }); // Canberra: 900 more — enough to avoid a forced mortgage
  g.emit({ t: 'own', i: 3, o: { p: B, lv: 1, m: false } }); // Sydney Lv 1: rent 650
  g.emit({ t: 'cash', pi: A, d: 500 - g.S.players[A].cash });
  const a = pend(h);
  assert.equal(a.to, A);
  g.answer(A, a.id, { c: 'goto', pi: A, i: 3, land: true });
  await sleep();
  const pick = pend(h);
  assert(pick && pick.p.k === 'pick' && pick.p.rule.k === 'raise' && pick.to === A, 'mortgage-to-pay question is up');
  const bCash = g.S.players[B].cash;
  g.concede(A); // gives up instead of picking
  await sleep();
  assert.equal(g.S.players[A].out, 1);
  assert.equal(g.S.own[1], undefined, 'A\'s properties went to the bank, unmortgaged');
  assert.equal(g.S.own[2], undefined);
  assert.equal(g.S.own[3].p, B, 'B keeps Sydney');
  assert.equal(g.S.players[B].cash, bCash, 'B received nothing — the estate went to the bank');
  assert(!pend(h) || pend(h).to !== A, 'no question left for A');
  g.dispose(); // 2p left, endless: the game runs on
}

// ---- 7. The creditor concedes mid payer's pick: the payment goes to the bank ----
{
  const h = { ...mockHost(), dev: true }, g = new Game(h, fresh(names(3), { mode: 'endless', rounds: 30 }));
  void g.run();
  await sleep();
  const [A, B] = g.S.order;
  g.emit({ t: 'own', i: 1, o: { p: A, lv: 0, m: false } });
  g.emit({ t: 'own', i: 2, o: { p: A, lv: 0, m: false } });
  g.emit({ t: 'own', i: 3, o: { p: B, lv: 1, m: false } });
  g.emit({ t: 'cash', pi: A, d: 500 - g.S.players[A].cash });
  const a = pend(h);
  g.answer(A, a.id, { c: 'goto', pi: A, i: 3, land: true });
  await sleep();
  const pick = pend(h);
  assert(pick && pick.to === A, 'mortgage-to-pay question is up');
  g.concede(B); // the landlord gives up while the tenant is picking
  await sleep();
  assert.equal(g.S.players[B].out, 1);
  assert.equal(g.S.own[3], undefined, 'B\'s Sydney went to the bank');
  assert.equal(pend(h)?.to, A, 'A\'s question still stands');
  g.answer(A, pick.id, [1]); // A mortgages Wellington
  await sleep();
  assert.equal(g.S.own[1].m, true, 'Wellington mortgaged');
  assert.equal(g.S.own[1].p, A);
  assert.equal(g.S.players[A].cash, 500 + 800 - 650, 'A paid the 650 rent — to the bank, not to B');
  assert.equal(g.S.players[B].cash, 0, 'B collected nothing');
  g.dispose();
}

// ---- 5. Concede twice / after over: no-ops ----
{
  const h = mockHost(), g = new Game(h, fresh(names(2), { mode: 'endless', rounds: 30 }));
  void g.run();
  await sleep();
  const me = cur(g);
  g.concede(me);
  g.concede(me); // already out
  await sleep();
  assert.deepEqual(g.S.bankrupt, [me]);
  const other = g.S.order.find((p) => p !== me);
  g.concede(other); // the game is over already
  await sleep();
  assert.equal(g.S.players[other].out, 0, 'concede ignored once over');
  g.dispose();
}

console.log('concede tests ok');
