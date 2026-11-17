// The news deck (src/worker/news.ts): a card is drawn with its dice, sign and targets settled at draw
// time, then it runs. One case per shape of effect — the deck itself is data.
//   Money    — Insurance Adjustment pays out of pocket; Investment Incentive counts investments;
//              Home Repairs counts building levels.
//   Asset    — a boom card pays or charges every owner of a kind (a jailed owner is still charged but
//              never paid); Labor Strike charges choke/transport/construction/oil owners.
//   Players  — Wedding Bells collects from all; Grand Banquet pays each until broke; Pickpocket /
//              Hustler settle with whoever was passed this turn; Finders Keepers pays the nearest behind.
//   Position — Olympic Fever charges whoever stands there; Visa Crackdown charges a region (a tile
//              outside any city counts the region of the last city before it); Study Tour pays the
//              investment's owner — or the bank.
//   Action   — World Tour walks backward passing nothing; Fuel Surplus adds 3 steps; weather halves
//              movement; Blind Date stops passers-by; Hot Destination jumps and lands; Homecoming sends
//              transport owners to START and charges them; Shoddy Construction lowers an own city;
//              Court Martial jails base owners; Strait Standoff holds choke owners; Winds of Change
//              shifts media/prison owners.
//   Two-side — Body Swap trades places; Wait for Me walks both toward each other; Running Man jumps
//              ahead of the next player.
// (`another`, the extra turn, drives turn.test's again case; Lost Wallet and the Media redraw are in
//  public.test / invest.test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, give, seize, setCash, putAt, setFlag, draw, goto, roll, idle, answer, asked, settle, cash, tileAt, kindAt, TILES, START_CASH } from './harness.ts';

const NEWS_T = kindAt('news'), JAIL = kindAt('jail');
// The deck's positions, 1-based for the draw rig.
const CARD = { incentive: 3, insurance: 5, repairs: 8, oilBoom: 9, strike: 14, wedding: 15, banquet: 16, pickpocket: 17, finders: 18, olympics: 19, visas: 20, tour: 21, worldTour: 23, destination: 24, homecoming: 25, shoddy: 26, martial: 27, standoff: 28, fuel: 29, winds: 30, swap: 31, meet: 32, blindDate: 33, runningMan: 34, heavyRain: 38 };
const places = TILES.filter((t) => t.type === 'city' || t.type === 'special').map((t) => t.i);
const placeN = (i) => places.indexOf(i) + 1;
const invests = TILES.filter((t) => t.type === 'invest').map((t) => t.i);
const investN = (i) => invests.indexOf(i) + 1;
const lastNews = (h) => h.evs.findLast((e) => e.t === 'news');

const MAL = tileAt('Strait of Malacca'), CR = tileAt('China Railway'), MAE = tileAt('Maersk'),
  CSCEC = tileAt('CSCEC'), VENO = tileAt('Venezuela Oil'), BBC = tileAt('BBC'), WSB = tileAt('West Sea Base');
const CAN = tileAt('Canberra'), SYD = tileAt('Sydney');

test('Money: Insurance Adjustment is paid from pocket', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  await draw(g, h, [CARD.insurance, 2]); // of [30,50,70] takes $50
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, A), START_CASH - 50);
});

test('Money: Investment Incentive pays $50 per investment', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, CR, A); give(g, MAE, A);
  await draw(g, h, [CARD.incentive]);
  await goto(g, h, A, NEWS_T);
  assert.equal(lastNews(h).card.amount, 100);
  assert.equal(cash(g, A), START_CASH + 100);
});

test('Money: Home Repairs charges $10 per building level', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, SYD, A, 2); give(g, CAN, A, 1); // 3 levels
  await draw(g, h, [CARD.repairs]);
  await goto(g, h, A, NEWS_T);
  assert.equal(lastNews(h).card.amount, -30);
  assert.equal(cash(g, A), START_CASH - 30);
});

test('Asset: a boom card pays or charges every owner — a jailed owner is charged but never paid', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, VENO, B);
  await draw(g, h, [CARD.oilBoom, 1, 3]); // coin up, $200
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH + 200);

  await idle(g, h);
  setFlag(g, B, 'jail');
  await draw(g, h, [CARD.oilBoom, 1, 1]); // up $100 — the jailed owner is not paid
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH + 200);

  await idle(g, h);
  await draw(g, h, [CARD.oilBoom, 2, 1]); // down $100 — the jailed owner still pays
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH + 100);
});

test('Asset: Labor Strike charges choke, transport, construction and oil owners', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  for (const i of [MAL, CR, CSCEC, VENO]) give(g, i, B);
  await draw(g, h, [CARD.strike, 2]); // $200
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH - 200, 'one charge per owner, not per tile');
});

test('Players: Wedding Bells collects from every other player', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  await draw(g, h, [CARD.wedding, 3]); // $150
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH - 150);
  assert.equal(cash(g, C), START_CASH - 150);
  assert.equal(cash(g, A), START_CASH + 300);
});

test('Players: Grand Banquet pays each other player until broke', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  setCash(g, A, 60);
  await draw(g, h, [CARD.banquet, 5]); // $100 each
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH + 60, 'B received what A could raise');
  assert.equal(cash(g, C), START_CASH, 'C was never reached');
  assert.equal(g.S.players[A].bankruptRound, 1);
});

test('Players: Pickpocket takes from whoever was passed this turn; Hustler pays them', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  putAt(g, A, 14); // Shenzhen; a roll of 3 passes B on 16 and lands on the Agency
  putAt(g, B, 16);
  await draw(g, h, [1, 2, CARD.pickpocket, 1, 1]); // dice, card, take, $20
  const a = asked(h, 'roll');
  g.answer(a.player, a.id, true);
  await settle();
  assert.equal(cash(g, B), START_CASH - 20);
  assert.equal(cash(g, A), START_CASH + 20);

  await idle(g, h);
  putAt(g, A, 14); putAt(g, B, 16); // same walk again
  await draw(g, h, [1, 2, CARD.pickpocket, 2, 2]); // Hustler, $50
  const a2 = asked(h, 'roll');
  g.answer(a2.player, a2.id, true);
  await settle();
  assert.equal(cash(g, A), START_CASH + 20 - 50);
  assert.equal(cash(g, B), START_CASH - 20 + 50);
});

test('Players: Finders Keepers pays the nearest player behind', async () => {
  const { g, h } = await start(3);
  const [A, B, C] = g.S.turnOrder;
  putAt(g, B, 14); putAt(g, C, 60); // 3 and 49 tiles behind the Agency
  await draw(g, h, [CARD.finders, 2]); // $100
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, A), START_CASH - 100);
  assert.equal(cash(g, B), START_CASH + 100, 'B was nearest behind');
  assert.equal(cash(g, C), START_CASH);
});

test('Position: Olympic Fever charges whoever stands on the named tile', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  putAt(g, B, SYD);
  await draw(g, h, [CARD.olympics, placeN(SYD)]);
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH - 200);
  assert.equal(cash(g, A), START_CASH, 'the drawer stands elsewhere');
});

test('Position: Visa Crackdown charges everyone standing in a region', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  putAt(g, B, 41); // the first Tax Bureau: no city of its own — counts as Western Europe (Paris)
  await draw(g, h, [CARD.visas, 7]); // 'weu' is the 7th region key
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH - 300);
});

test('Position: Study Tour pays the investment\'s owner — the bank if none', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, CR, A);
  putAt(g, B, CR);
  await draw(g, h, [CARD.tour, investN(CR)]);
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH - 100);
  assert.equal(cash(g, A), START_CASH + 100);

  await idle(g, h);
  seize(g, CR); // back to the bank
  putAt(g, B, CR); // B was moved to Jail by its idle turn — stand it on the tile again
  await draw(g, h, [CARD.tour, investN(CR)]);
  await goto(g, h, A, NEWS_T);
  assert.equal(cash(g, B), START_CASH - 200);
  assert.equal(cash(g, A), START_CASH + 100, 'no owner: the bank keeps it');
});

test('Action: World Tour turns the next move around — nothing is passed', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, MAL, B); // the toll would apply if passing worked
  await draw(g, h, [CARD.worldTour]);
  await goto(g, h, A, NEWS_T);
  assert(g.moveMods[A].backward);
  await idle(g, h); // B
  putAt(g, A, 8); // the lucky casino; Malacca is two tiles behind
  await roll(g, h, [1, 3]); // four steps backward: 7, 6, 5, 4
  assert.equal(g.S.players[A].tile, 4, 'walked backward onto Jakarta');
  assert.equal(cash(g, A), START_CASH, 'no toll passing Malacca backward');
  assert(!g.moveMods[A].backward, 'the tour is spent');
  await answer(g, h, false); // Jakarta deed
});

test('Action: Fuel Surplus gives oil owners 3 extra steps', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, VENO, B);
  await draw(g, h, [CARD.fuel]);
  await goto(g, h, A, NEWS_T); // A draws it — B is the oil owner
  assert(g.moveMods[B].extraSteps);
  assert.equal(h.pending.player, B, 'B moves next');
  putAt(g, B, 60); // the stakes casino
  await roll(g, h, [2, 3]); // 5 + 3
  assert.equal(g.S.players[B].tile, 68, 'San José');
  assert(!g.moveMods[B].extraSteps, 'fuel spent');
  await answer(g, h, false); // San José deed
});

test('Weather: players in the named regions move half steps', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await idle(g, h); // A idles; B will draw the card
  putAt(g, A, 40); // Paris — Western Europe
  await draw(g, h, [CARD.heavyRain]); // weu + sam
  await goto(g, h, B, NEWS_T);
  assert(g.moveMods[A].halfSteps, 'A stood in Western Europe');
  assert(!g.moveMods[B].halfSteps, 'the drawer stood in China');
  putAt(g, A, 20); // Beijing
  await roll(g, h, [2, 2]); // 4 halved to 2
  assert.equal(g.S.players[A].tile, 22, 'Osaka');
  await answer(g, h, false); // Osaka deed
});

test('Action: Blind Date stops whoever passes the marked player', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  await idle(g, h); // A idles; B draws
  await draw(g, h, [CARD.blindDate]);
  await goto(g, h, B, NEWS_T);
  assert(g.moveMods[B].blindDate);
  putAt(g, B, JAIL); // waits on the Jail tile — stopping there is a visit
  putAt(g, A, 24); // the West Sea Base
  await roll(g, h, [2, 3]); // five steps: held at 26 instead of landing on 29
  assert.equal(g.S.players[A].tile, JAIL, 'stopped at the date');
  assert.equal(g.S.players[A].jail, false, 'just visiting');
});

test('Action: Hot Destination jumps there and lands', async () => {
  const { g, h } = await start(2);
  const [A] = g.S.turnOrder;
  give(g, SYD, A, 3); // maxed: the landing stays silent
  await draw(g, h, [CARD.destination, placeN(SYD)]);
  await goto(g, h, A, NEWS_T);
  assert.equal(g.S.players[A].tile, SYD);
  assert(h.evs.some((e) => e.t === 'move' && e.player === A && e.to === SYD && e.how === 'jump'));
});

test('Action: Homecoming sends transport owners to START and charges $1,000', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, CR, B);
  putAt(g, B, 44); // London
  await draw(g, h, [CARD.homecoming]);
  await goto(g, h, A, NEWS_T);
  assert.equal(g.S.players[B].tile, 0, 'moved to START');
  assert.equal(cash(g, B), START_CASH + 3000 - 1000, 'collects START, pays the fare');
});

test('Action: Shoddy Construction — a builder lowers one of their built cities', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, CSCEC, B);
  give(g, SYD, B, 2); // assumed paid 2×650
  await draw(g, h, [CARD.shoddy]);
  await goto(g, h, A, NEWS_T);
  const a = asked(h, 'pick');
  assert.equal(a.player, B, 'the question goes to the owner, not the drawer');
  assert.deepEqual(a.prompt.items.map((x) => x.index), [SYD]);
  await answer(g, h, [SYD]);
  assert.equal(g.S.ownedByTile[SYD].level, 1);
  assert.equal(g.S.ownedByTile[SYD].upgradePaid, 650);
});

test('Action: Court Martial jails military base owners — the stay costs their next turn', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, WSB, B);
  await draw(g, h, [CARD.martial]);
  await goto(g, h, A, NEWS_T);
  assert.equal(g.S.players[B].tile, JAIL);
  assert(h.evs.some((e) => e.t === 'flag' && e.player === B && e.flag === 'jail' && e.active === true), 'B was jailed');
  assert(h.evs.some((e) => e.t === 'skip' && e.player === B), 'and its next turn was skipped already');
  assert.equal(h.pending.player, A);
});

test('Action: Strait Standoff holds chokepoint owners for a turn', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, MAL, B);
  await draw(g, h, [CARD.standoff]);
  await goto(g, h, A, NEWS_T);
  assert(h.evs.some((e) => e.t === 'flag' && e.player === B && e.flag === 'stay' && e.active === true), 'B was held up');
  assert(h.evs.some((e) => e.t === 'skip' && e.player === B), 'and skipped its next turn');
  assert.equal(g.S.players[B].stay, false, 'the flag cleared with the skip');
  assert.equal(g.S.players[B].tile, 0, 'without moving');
});

test('Action: Winds of Change shifts media and prison owners, with no landing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  give(g, BBC, B); // B owns the Media — it shifts, it earns the bonus, the drawer just watches
  putAt(g, B, 40); // Paris
  await draw(g, h, [CARD.winds, 5, 1]); // 5 forward
  await goto(g, h, A, NEWS_T);
  assert.equal(g.S.players[B].tile, 45);
  assert.equal(cash(g, B), START_CASH + 200, 'the Media bonus');
  assert.equal(g.S.players[A].tile, NEWS_T, 'the drawer unmoved');
  assert.equal(h.pending.player, B, 'tile 45 is an exchange — the move resolved nothing');
});

test('Players: Body Swap trades places with no landing', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  putAt(g, B, 30); // Moscow
  await draw(g, h, [CARD.swap]);
  await goto(g, h, A, NEWS_T);
  const a = asked(h, 'pick');
  assert.equal(a.prompt.of, 'player');
  await answer(g, h, [B]);
  assert.equal(g.S.players[A].tile, 30);
  assert.equal(g.S.players[B].tile, NEWS_T);
});

test('Players: Wait for Me walks both toward each other', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  putAt(g, B, 22); // five ahead of the Agency
  await draw(g, h, [CARD.meet]);
  await goto(g, h, A, NEWS_T);
  assert.equal(g.S.players[A].tile, 20, 'three steps forward');
  assert.equal(g.S.players[B].tile, 20, 'two back — they met');
});

test('Players: Running Man jumps one tile ahead of the next player', async () => {
  const { g, h } = await start(2);
  const [A, B] = g.S.turnOrder;
  putAt(g, B, 22);
  await draw(g, h, [CARD.runningMan]);
  await goto(g, h, A, NEWS_T);
  assert.equal(g.S.players[A].tile, 23, 'one tile ahead of B, no landing');
});
