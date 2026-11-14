import { apply, ranking } from '../shared/state';
import type { CasinoView, Ev, GameState, NewsCard, Prompt } from '../shared/types';
import { close, forget, hold, reply, wasClosed } from './asks';
import { send } from './net';
import { clearDice, hideDice, hop, jump, placeAt, removeToken, rollDice, setActive, tokens } from './render/actors';
import { POS } from './render/layout';
import { finishTweens, pace, wait } from './render/scene';
import { enterDemo, enterGame, focusTok, playStrike, selectTile, setOwner, showState, tokenSpot } from './stage';
import { G, actionBtn, activeTab, autoFocus, bump, bumpAssets, cashEls, clearCards, countdown, floatText, floats, hudLive, lastRoll, paused, selectedTile, session, tip, toast, toasts, viewedPlayer, waitingFor, type Button, type Open } from './store';
import { openAsk, openCasino, openNews, openNotice, openOrder, openResults } from './ui/open';
import { money } from './ui/bits';

// The director plays the server's events on this client's screen, one at a time. The server runs ahead (it only waits for decisions): `G.S` is the game
// as far as the screen has got, so a log line, a payment or a purchase appears when its animation does. Questions are asked of one player at a time; the
// others see who is being waited for. When the screen is far behind (a burst of events after a stall) it plays faster, in proportion to what is waiting.
const queue: Ev[] = [];
let running = false;
let epoch = 0; // a reset (a snapshot, a new game, leaving) ends whatever was being played
let leave = () => {}; // how to leave the room, for the player who goes to the main menu after a game: given to `start`
const BACKLOG = 25, MAX_SPEED = 4; // waiting events past this many speed everything up, to this much at most: a single turn's burst (~20 events) fits under the line and plays at 1x

/** Hold on to a promise, but forget what comes after it if the director was reset meanwhile. */
const live = <T>(p: Promise<T>): Promise<T> => { const e = epoch; return p.then((v) => (e === epoch ? v : new Promise<T>(() => {}))); };
const pause = (s: number) => live(wait(s));
const quiet = () => document.hidden; // nobody sees it: no cards, toasts or numbers, only the state
/** The view goes to the player whose turn it is (mine too), when the preference asks for it. */
const focusTurn = (pi: number) => { if (autoFocus.get()) focusTok(pi); };

let shown: Open<void> | null = null; // the card being waited on that has nothing to decide
export const dismissShown = () => shown?.close();
/** Wait for a card with nothing to decide. A hidden tab throttles the timer that closes it, and nobody sees it there: it comes down as the tab goes hidden. */
const show = (card: Open<void>) => live((shown = card).done.then(() => { if (shown === card) shown = null; }));

let tick: { ms: number; end: number } | null = null; // the open question's clock as the server last set it: how long it is, and when it runs out by this page's clock (null: none)
let asked = -1; // who the question on screen is for
/** Put the clock on the card of whoever is asked. The clock is the server's, not the screen's: the director may be well behind it, so the gauge goes up with what is left. */
function showClock() {
  countdown.set(asked >= 0 && tick ? { pi: asked, ms: tick.ms, end: tick.end, left: Math.max(0, tick.end - performance.now()) } : null);
}

let kept: NewsCard | null = null; // the story this player read on its Media redraw card and kept: the 'news' event that follows is the same one, already seen
let casino: ReturnType<typeof openCasino> | null = null; // the card of the casino visit in progress, if any
/** Put a view on the casino card (the first one opens it). Settles when the card has closed. */
function showCasino(view: CasinoView, ask: { id: number; mine: boolean } | null) {
  if (casino?.view.get().cid === view.cid) { casino.view.set(view); casino.ask.set(ask); return casino.card.done; }
  const c = (casino = openCasino(view, ask));
  c.card.done.then(() => { if (casino === c) casino = null; });
  return c.card.done;
}

/** Starts listening to the page; returns what stops it, and ends what is being played. `onLeave` is what leaves the room when a game's results are closed with MAIN MENU. */
export function start(onLeave: () => void) {
  leave = onLeave;
  const off = new AbortController();
  document.addEventListener('visibilitychange', () => document.hidden && shown?.close(), { signal: off.signal });
  return () => { off.abort(); reset(); };
}

function reset() {
  epoch++;
  queue.length = 0;
  running = false;
  pace.speed = 1;
  forget();
  shown = null;
  tick = null; asked = -1; showClock();
  paused.set(false);
  kept = null;
  casino = null;
  clearCards();
  toasts.set([]); floats.set([]); tip.set(null);
  finishTweens();
  clearDice();
  actionBtn.set(null); waitingFor.set(-1); lastRoll.set(null);
}

/** Out of the game, back to the demo board (the title's and the lobby's): what is being played ends, and the screen forgets the game. */
export function exitToDemo() {
  reset();
  G.S = null;
  hudLive.set(false);
  selectedTile.set(-1);
  enterDemo();
}

export function push(evs: Ev[]) {
  for (const ev of evs) {
    if (ev.t === 'close') close(ev.id); // a closed question comes down at once, not when the director gets to it
    else if (ev.t === 'clock') { tick = ev.ms ? { ms: ev.of ?? ev.ms, end: performance.now() + ev.ms } : null; showClock(); } // and its clock is counted from the moment it is told: the question it belongs to may be queued behind a long card
    else if (ev.t === 'paused') paused.set(ev.on); // a dev room's freeze: gauges and card timers stand still (a clock ev on resume re-arms them)
    else queue.push(ev);
  }
  void pump();
}

async function pump() {
  if (running) return;
  running = true;
  const e = epoch;
  while (queue.length && e === epoch) {
    pace.speed = Math.min(MAX_SPEED, Math.max(1, queue.length / BACKLOG)); // each event is played at the speed its backlog asks for when it starts
    try { await play(queue.shift()!); } catch (err) { console.error(err); }
  }
  if (e === epoch) { pace.speed = 1; running = false; }
}

/** The screen as a snapshot says the game is now (joining a running game, or coming back to it). */
export function restore(m: { me: number; state: GameState; ask: Ev | null; paused?: boolean }) {
  reset();
  paused.set(!!m.paused);
  Object.assign(G, { S: m.state, me: m.me });
  viewedPlayer.set(m.me); selectedTile.set(-1); activeTab.set('tile'); hudLive.set(true);
  session.set({ ...session.get(), view: 'game' });
  showState(m.state);
  enterGame();
  focusTurn(m.state.order[m.state.turn]);
  if (m.ask) queue.push(m.ask);
  if (m.state.over) queue.push({ t: 'over', rank: ranking(m.state) });
  bumpAssets();
  void pump();
}

// ---- Floating numbers on a player's card: the token can be anywhere, off screen ----
const air: Record<number, number> = {};
function floatCard(pi: number, text: string, tone: string) {
  const r = cashEls[pi]?.getBoundingClientRect();
  if (!r) return;
  floatText(r.right, r.top - 32 * (air[pi] ||= 0), text, `${tone} hud`);
  air[pi]++;
  setTimeout(() => air[pi]--, 1500);
}

/** The beat that ends a turn: its player clicks (or presses Space) to go on; for everybody else it is a pause to read the result. */
async function beat(who: number) {
  if (quiet()) return;
  if (who !== G.me) return pause(1.5);
  const e = epoch;
  await new Promise<void>((res) => {
    const end = () => { if (e === epoch && actionBtn.get() === btn) actionBtn.set(null); res(); };
    const btn: Button = { label: 'END TURN', kbd: true, click: end };
    actionBtn.set(btn);
  });
}

const mine = () => { const r = session.get().room; return r?.seats.find((s) => s.seat === r.me)?.pi ?? -1; }; // my player index, as the room says

async function play(ev: Ev) {
  if (ev.t === 'start') {
    Object.assign(G, { S: ev.state, me: mine() });
    viewedPlayer.set(G.me); selectedTile.set(-1); activeTab.set('tile'); lastRoll.set(null); hudLive.set(false);
    session.set({ ...session.get(), view: 'game' });
    showState(ev.state);
    enterGame();
    bumpAssets();
    return;
  }
  const S = G.S;
  if (!S) return;
  const cur = S.order[S.turn];
  switch (ev.t) {
    case 'order':
      if (!quiet()) await show(openOrder(S.players, ev.passes, ev.order));
      apply(S, ev);
      hudLive.set(true);
      bump();
      return;
    case 'turn': {
      if (S.step === 'resolve' && !S.over && !S.players[cur].out) await beat(cur); // a turn that was played to its end
      apply(S, ev);
      lastRoll.set(null); actionBtn.set(null); waitingFor.set(-1);
      setActive(S.order[S.turn]);
      focusTurn(S.order[S.turn]);
      bump();
      await pause(0.6);
      return;
    }
    case 'step': case 'log': apply(S, ev); bump(); return;
    case 'dice': {
      const tok = tokens[cur];
      if (tok) await live(rollDice(POS[tok.tile], [ev.a, ev.b]));
      lastRoll.set([ev.a, ev.b]);
      await pause(0.7);
      await live(hideDice());
      return;
    }
    case 'move': {
      const tok = tokens[ev.pi];
      if (tok) await live(ev.how === 'hop' ? hop(tok, ev.to) : jump(tok, ev.to));
      apply(S, ev);
      if (ev.how === 'jump' && ev.pi === cur) focusTurn(ev.pi); // the camera follows a hop by itself; a jump leaves it behind
      bump();
      return;
    }
    case 'strike': if (!quiet()) await live(playStrike(ev.from, ev.to)); return;
    case 'cash': {
      apply(S, ev);
      if (!quiet()) {
        const text = (ev.d > 0 ? '+' : '') + money(ev.d), tone = ev.d > 0 ? 'good' : 'bad', at = tokenSpot(ev.pi);
        if (at) floatText(at[0], at[1], text, tone);
        floatCard(ev.pi, text, tone);
      }
      bumpAssets();
      return;
    }
    case 'own': apply(S, ev); setOwner(ev.i, ev.o, S); bumpAssets(); return;
    case 'dep': apply(S, ev); bumpAssets(); return;
    case 'flag': {
      apply(S, ev);
      const tok = tokens[ev.pi];
      if (tok && ev.k === 'jail') { tok.jailed = ev.v; if (!ev.v) placeAt(tok, tok.tile); } // out of the cage: back to the yard
      bump();
      return;
    }
    case 'out': {
      apply(S, ev);
      if (tokens[ev.pi]) void removeToken(tokens[ev.pi]);
      bumpAssets();
      return;
    }
    case 'toast': if (!quiet()) toast(ev.m, ev.tone); return;
    case 'sel': if (ev.pi === G.me) selectTile(ev.i); return;
    case 'skip': if (!quiet()) toast(ev.m, 'bad'); await pause(1.6); return;
    case 'notice': if (!quiet()) await show(openNotice(ev.n)); return;
    case 'news': {
      const dupe = !!kept && kept.title === ev.card.title && kept.text === ev.card.text; // the story `me` kept on the redraw card: already read
      kept = null;
      if (!quiet() && !dupe) await show(openNews(ev.card));
      return;
    }
    case 'casino': if (quiet()) casino?.card.close(); else await live(showCasino(ev.view, null)); return;
    case 'ask': return ask(ev.id, ev.to, ev.p);
    case 'over': {
      apply(S, ev);
      bump();
      await pause(0.6);
      if ((await live(openResults(ev.rank))) === 'again') send({ t: 'again' }); else leave();
      return;
    }
  }
}

/** A question to `to`: this player gets the card (or the button), the others see who is being waited for. Over when it is answered or closed. */
async function ask(id: number, to: number, p: Prompt) {
  const me = to === G.me;
  if (wasClosed(id) || (quiet() && !me)) return;
  const over = new Promise<void>((res) => hold(id, res));
  let card: Open<void> | null = null, btn: Button | null = null;
  if (p.k === 'casino') void showCasino(p.view, { id, mine: me });
  else if (p.k === 'roll') { if (me) actionBtn.set((btn = { label: 'ROLL DICE', kbd: true, click: () => reply(id, true), reply: (v) => reply(id, v) })); }
  else if (me) card = openAsk(id, p, (v) => { if (p.k === 'news' && v === false) kept = p.card; }); // the others only see who is being waited for
  waitingFor.set(me ? -1 : to);
  asked = to; showClock();
  await live(over);
  card?.close();
  if (p.k === 'casino' && casino?.ask.get()?.id === id) casino.ask.set(null);
  if (btn && actionBtn.get() === btn) actionBtn.set(null);
  waitingFor.set(-1);
  asked = -1; showClock();
}
