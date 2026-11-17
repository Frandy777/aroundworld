// Asset valuation, ranking and legal property selections.
//   canPick     — one | any | redeem (within cash) | raise (cash + picks cover the need).
//   stats       — net = cash + deposit + unmortgaged holdings.
//   ranking     — the living by net worth, then the bankrupt, last out first.
//   lotValue    — price + what upgrades actually cost (a free one adds none).
//   hasMonopoly — every city of the region in one hand, none mortgaged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, players, apply, stats, ranking, lotValue, canPick, hasMonopoly, TILES, tileAt } from './harness.ts';

const WEL = tileAt('Wellington'), CAN = tileAt('Canberra'), SYD = tileAt('Sydney'), CR = tileAt('China Railway');

const S = () => fresh(players(2), { mode: 'endless', rounds: 30 }).S;

test('canPick: the four rules', () => {
  assert.equal(canPick({ k: 'one' }, 1, 0), true);
  assert.equal(canPick({ k: 'one' }, 2, 0), false);
  assert.equal(canPick({ k: 'any' }, 0, 0), false);
  assert.equal(canPick({ k: 'any' }, 3, 0), true);
  assert.equal(canPick({ k: 'redeem', cash: 100 }, 1, 100), true, 'the selection must fit the cash');
  assert.equal(canPick({ k: 'redeem', cash: 100 }, 1, 101), false);
  assert.equal(canPick({ k: 'redeem', cash: 100 }, 0, 0), false, 'redeeming nothing is not a choice');
  assert.equal(canPick({ k: 'raise', cash: 500, need: 800 }, 1, 300), true);
  assert.equal(canPick({ k: 'raise', cash: 500, need: 800 }, 1, 299), false);
});

test('stats: net counts cash, deposit and unmortgaged lot value only', () => {
  const s = S();
  s.players[0].cash = 5000;
  apply(s, { t: 'own', tile: WEL, owned: { owner: 0, level: 1, mortgaged: false, upgradePaid: 400 } });
  apply(s, { t: 'own', tile: CAN, owned: { owner: 0, level: 0, mortgaged: true } }); // mortgaged: off the books
  apply(s, { t: 'own', tile: CR, owned: { owner: 0, level: 0, mortgaged: false } });
  apply(s, { t: 'dep', player: 0, deposit: { principal: 2000, termRounds: 10, placedRound: 1 } });
  const st = stats(s, 0);
  assert.equal(st.cities, 2);
  assert.equal(st.investments, 1);
  assert.equal(st.mortgaged, 1);
  assert.equal(st.levels, 1);
  assert.equal(st.propertyValue, 1600 + 400 + 2000, 'Wellington + CR; Canberra counts nothing');
  assert.equal(st.deposit, 2000);
  assert.equal(st.netWorth, 5000 + 2000 + 4000);
});

test('ranking: the living by net, then the bankrupt last-out-first', () => {
  const s = S();
  apply(s, { t: 'own', tile: WEL, owned: { owner: 1, level: 0, mortgaged: false } }); // player 1 richer
  apply(s, { t: 'out', player: 0 });
  assert.deepEqual(ranking(s).map((r) => r.player), [1, 0]);
});

test('lotValue: the free first upgrade adds nothing', () => {
  assert.equal(lotValue(TILES[WEL], { owner: 0, level: 1, mortgaged: false, upgradePaid: 400 }), 2000);
  assert.equal(lotValue(TILES[WEL], { owner: 0, level: 1, mortgaged: false, upgradePaid: 0 }), 1600);
  assert.equal(lotValue(TILES[WEL], { owner: 0, level: 1, mortgaged: false }), 2000, 'no receipt: assume the upgrade was paid');
});

test('hasMonopoly: whole region, one hand, nothing mortgaged', () => {
  const s = S();
  assert.equal(hasMonopoly(s, TILES[SYD]), false, 'unowned');
  for (const i of [WEL, CAN, SYD]) apply(s, { t: 'own', tile: i, owned: { owner: 0, level: 0, mortgaged: false } });
  assert.equal(hasMonopoly(s, TILES[SYD]), true);
  apply(s, { t: 'own', tile: CAN, owned: { owner: 0, level: 0, mortgaged: true } });
  assert.equal(hasMonopoly(s, TILES[SYD]), false, 'a mortgaged part breaks it');
  apply(s, { t: 'own', tile: CAN, owned: { owner: 1, level: 0, mortgaged: false } });
  assert.equal(hasMonopoly(s, TILES[SYD]), false, 'a split hand breaks it');
});
