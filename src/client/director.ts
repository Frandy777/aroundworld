import { apply, ranking } from '../shared/state';
import type { CasinoView, Ev, GameState, NewsCard, Prompt } from '../shared/types';
import { close, forget, hold, reply, wasClosed } from './asks';
import { playBankruptOut, playCash, playJailClang, playLotBuy, playLotMortgage, playLotUpgrade, playTurnMine, resetHopChain, stopActiveSounds } from './audio';
import { send } from './net';
import { clearDice, hideDice, hop, jump, placeAt, removeToken, rollDice, setActive, tokens } from './render/actors';
import { POS } from './render/layout';
import { finishTweens, pace, shakeCamera, wait } from './render/scene';
import { enterDemo, enterGame, focusTok, playStrike, selectTile, setOwner, showState, tokenSpot } from './stage';
import { G, actionBtn, activeTab, autoFocus, bump, bumpAssets, cashEls, clearCards, countdown, floatText, floats, hoveredTileTip, hudLive, lastRoll, paused, selectedTile, session, toast, toasts, triggerCardHit, viewedPlayer, waitingFor, type Button, type Open } from './store';
import { openAsk, openCasino, openNews, openNotice, openOrder, openResults } from './ui/open';
import { money } from './ui/bits';

// The director plays the server's events on this client's screen, one at a time. The server runs ahead (it only waits for decisions): `G.S` is the game
// as far as the screen has got, so a log line, a payment or a purchase appears when its animation does. Questions are asked of one player at a time; the
// others see who is being waited for. When the screen is far behind (a burst of events after a stall) it plays faster, in proportion to what is waiting.
const queue: Ev[] = [];
let running = false;
let playbackEpoch = 0; // a reset (a snapshot, a new game, leaving) ends whatever was being played
let onLeaveRoom = () => {};
const SPEEDUP_BACKLOG = 25, MAX_SPEED = 4; // waiting events past this many speed everything up, to this much at most: a single turn's burst (~20 events) fits under the line and plays at 1x

/** Hold on to a promise, but forget what comes after it if the director was reset meanwhile. */
const live = <T>(p: Promise<T>): Promise<T> => { const e = playbackEpoch; return p.then((v) => (e === playbackEpoch ? v : new Promise<T>(() => {}))); };
const pause = (s: number) => live(wait(s));
const isTabHidden = () => document.hidden; // a hidden tab sees nothing: no cards, toasts or numbers, only the state
/** The view goes to the player whose turn it is (mine too), when the preference asks for it. */
const focusTurn = (pi: number) => { if (autoFocus.get()) focusTok(pi); };

let activeAutoCard: Open<void> | null = null;
export const dismissAutoCard = () => activeAutoCard?.close();
/** Is something still being played: events waiting, or one under way (an animation, a card, a question)? */
export const busy = () => running || queue.length > 0;
/** Wait for a card with nothing to decide. A hidden tab throttles the timer that closes it, and nobody sees it there: it comes down as the tab goes hidden. */
const show = (card: Open<void>) => live((activeAutoCard = card).done.then(() => { if (activeAutoCard === card) activeAutoCard = null; }));

let promptClock: { totalMs: number; expiresAt: number } | null = null;
let askedPlayer = -1;
/** Put the clock on the card of whoever is asked. The clock is the server's, not the screen's: the director may be well behind it, so the gauge goes up with what is left. */
function showClock() {
  countdown.set(askedPlayer >= 0 && promptClock ? { player: askedPlayer, totalMs: promptClock.totalMs, expiresAt: promptClock.expiresAt, remainingMs: Math.max(0, promptClock.expiresAt - performance.now()) } : null);
}

let keptRedrawNews: NewsCard | null = null; // the 'news' event that follows this player's Media redraw is the same story: already seen
let openCasinoModal: ReturnType<typeof openCasino> | null = null;
/** Put a view on the casino card (the first one opens it). Settles when the card has closed. */
function showCasino(view: CasinoView, ask: { id: number; mine: boolean } | null) {
  if (openCasinoModal?.view.get().visitId === view.visitId) { openCasinoModal.view.set(view); openCasinoModal.ask.set(ask); return openCasinoModal.card.done; }
  const c = (openCasinoModal = openCasino(view, ask));
  c.card.done.then(() => { if (openCasinoModal === c) openCasinoModal = null; });
  return c.card.done;
}

/** Starts listening to the page; returns what stops it, and ends what is being played. `onLeave` is what leaves the room when a game's results are closed with MAIN MENU. */
export function start(onLeave: () => void) {
  onLeaveRoom = onLeave;
  const off = new AbortController();
  document.addEventListener('visibilitychange', () => document.hidden && activeAutoCard?.close(), { signal: off.signal });
  return () => { off.abort(); reset(); };
}

function reset() {
  playbackEpoch++;
  queue.length = 0;
  running = false;
  pace.speed = 1;
  forget();
  activeAutoCard = null;
  promptClock = null; askedPlayer = -1; showClock();
  paused.set(false);
  keptRedrawNews = null;
  openCasinoModal = null;
  clearCards();
  toasts.set([]); floats.set([]); hoveredTileTip.set(null);
  finishTweens();
  stopActiveSounds();
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
    else if (ev.t === 'clock') { promptClock = ev.remainingMs ? { totalMs: ev.totalMs ?? ev.remainingMs, expiresAt: performance.now() + ev.remainingMs } : null; showClock(); } // and its clock is counted from the moment it is told: the question it belongs to may be queued behind a long card
    else if (ev.t === 'paused') paused.set(ev.paused); // a dev room's freeze: gauges and card timers stand still (a clock ev on resume re-arms them)
    else queue.push(ev);
  }
  void pump();
}

async function pump() {
  if (running) return;
  running = true;
  const e = playbackEpoch;
  while (queue.length && e === playbackEpoch) {
    pace.speed = Math.min(MAX_SPEED, Math.max(1, queue.length / SPEEDUP_BACKLOG)); // each event is played at the speed its backlog asks for when it starts
    try { await play(queue.shift()!); } catch (err) { console.error(err); }
  }
  if (e === playbackEpoch) { pace.speed = 1; running = false; }
}

/** The screen as a snapshot says the game is now (joining a running game, or coming back to it). */
export function restore(m: { myPlayer: number; state: GameState; openAsk: Ev | null; paused?: boolean }) {
  reset();
  paused.set(!!m.paused);
  Object.assign(G, { S: m.state, myPlayer: m.myPlayer });
  viewedPlayer.set(m.myPlayer); selectedTile.set(-1); activeTab.set('tile'); hudLive.set(true);
  session.set({ ...session.get(), view: 'game' });
  showState(m.state);
  enterGame();
  focusTurn(m.state.turnOrder[m.state.turnIndex]);
  if (m.openAsk) queue.push(m.openAsk);
  if (m.state.over) queue.push({ t: 'over', rank: ranking(m.state) });
  bumpAssets();
  void pump();
}

// ---- Floating numbers on a player's card: the token can be anywhere, off screen ----
const activeCardFloats: Record<number, number> = {};
function floatCard(pi: number, text: string, tone: string) {
  const r = cashEls[pi]?.getBoundingClientRect();
  if (!r) return;
  floatText(r.right, r.top - 32 * (activeCardFloats[pi] ||= 0), text, `${tone} hud`);
  activeCardFloats[pi]++;
  setTimeout(() => activeCardFloats[pi]--, 1500);
}

/** The beat that ends a turn: its player clicks (or presses Space) to go on; for everybody else it is a pause to read the result. */
async function waitTurnEnd(player: number) {
  if (isTabHidden()) return;
  if (player !== G.myPlayer) return pause(1.5);
  const e = playbackEpoch;
  await new Promise<void>((res) => {
    const end = () => { if (e === playbackEpoch && actionBtn.get() === btn) actionBtn.set(null); res(); };
    const btn: Button = { label: 'END TURN', spaceShortcut: true, click: end };
    actionBtn.set(btn);
  });
}

const myPlayerFromRoom = () => { const r = session.get().room; return r?.seats.find((s) => s.seat === r.mySeat)?.playerIndex ?? -1; };

async function play(ev: Ev) {
  if (ev.t === 'start') {
    Object.assign(G, { S: ev.state, myPlayer: myPlayerFromRoom() });
    viewedPlayer.set(G.myPlayer); selectedTile.set(-1); activeTab.set('tile'); lastRoll.set(null); hudLive.set(false);
    session.set({ ...session.get(), view: 'game' });
    showState(ev.state);
    enterGame();
    bumpAssets();
    return;
  }
  const S = G.S;
  if (!S) return;
  const cur = S.turnOrder[S.turnIndex];
  switch (ev.t) {
    case 'order':
      if (!isTabHidden()) await show(openOrder(S.players, ev.passes, ev.order));
      apply(S, ev);
      hudLive.set(true);
      bump();
      return;
    case 'turn': {
      if (S.step === 'resolve' && !S.over && !S.players[cur].bankruptRound) await waitTurnEnd(cur); // a turn that was played to its end
      apply(S, ev);
      resetHopChain();
      lastRoll.set(null); actionBtn.set(null); waitingFor.set(-1);
      setActive(S.turnOrder[S.turnIndex]);
      focusTurn(S.turnOrder[S.turnIndex]);
      bump();
      await pause(0.6);
      return;
    }
    case 'step': case 'log': apply(S, ev); bump(); return;
    case 'dice': {
      const tok = tokens[cur];
      if (tok) await live(rollDice(POS[tok.tile], [ev.dieA, ev.dieB]));
      lastRoll.set([ev.dieA, ev.dieB]);
      await pause(0.7);
      await live(hideDice());
      return;
    }
    case 'move': {
      const tok = tokens[ev.player];
      if (tok) await live(ev.how === 'hop' ? hop(tok, ev.to) : jump(tok, ev.to));
      apply(S, ev);
      if (ev.how === 'jump' && ev.player === cur) focusTurn(ev.player); // the camera follows a hop by itself; a jump leaves it behind
      bump();
      return;
    }
    case 'strike': if (!isTabHidden()) await live(playStrike(ev.from, ev.to)); return;
    case 'cash': {
      apply(S, ev);
      if (!isTabHidden()) {
        playCash(ev.delta, tokens[ev.player]?.g.position);
        if (ev.delta <= -500) triggerCardHit(ev.player);
        const text = (ev.delta > 0 ? '+' : '') + money(ev.delta), tone = ev.delta > 0 ? 'good' : 'bad', at = tokenSpot(ev.player);
        if (at) floatText(at[0], at[1], text, tone);
        floatCard(ev.player, text, tone);
      }
      bumpAssets();
      return;
    }
    case 'own': {
      const prev = S.ownedByTile[ev.tile];
      apply(S, ev);
      setOwner(ev.tile, ev.owned, S);
      if (!isTabHidden() && ev.owned) {
        if (!prev) playLotBuy(ev.tile);
        else if (ev.owned.level > prev.level) playLotUpgrade(ev.owned.level, ev.tile);
        else if (ev.owned.mortgaged !== prev.mortgaged) playLotMortgage(ev.owned.mortgaged, ev.tile);
      }
      bumpAssets();
      return;
    }
    case 'dep': apply(S, ev); bumpAssets(); return;
    case 'flag': {
      apply(S, ev);
      const tok = tokens[ev.player];
      if (tok && ev.flag === 'jail') { tok.jailed = ev.active; if (!ev.active) placeAt(tok, tok.tile); } // out of the cage: back to the yard
      if (!isTabHidden() && ev.flag === 'jail' && ev.active) {
        playJailClang(tok?.g.position);
        shakeCamera(0.4, 0.18);
        triggerCardHit(ev.player);
      }
      bump();
      return;
    }
    case 'out': {
      apply(S, ev);
      if (!isTabHidden()) {
        playBankruptOut(tokens[ev.player]?.g.position);
        shakeCamera(0.55, 0.28);
        triggerCardHit(ev.player);
      }
      if (tokens[ev.player]) void removeToken(tokens[ev.player]);
      bumpAssets();
      return;
    }
    case 'toast': if (!isTabHidden()) toast(ev.message, ev.tone); return;
    case 'sel': if (ev.player === G.myPlayer) selectTile(ev.tile); return;
    case 'skip': if (!isTabHidden()) toast(ev.message, 'bad'); await pause(1.6); return;
    case 'notice': if (!isTabHidden()) await show(openNotice(ev.notice)); return;
    case 'news': {
      const dupe = !!keptRedrawNews && keptRedrawNews.title === ev.card.title && keptRedrawNews.text === ev.card.text; // the story `me` kept on the redraw card: already read
      keptRedrawNews = null;
      if (!isTabHidden() && !dupe) await show(openNews(ev.card));
      return;
    }
    case 'casino': if (isTabHidden()) openCasinoModal?.card.close(); else await live(showCasino(ev.view, null)); return;
    case 'ask': return ask(ev.id, ev.player, ev.prompt);
    case 'over': {
      apply(S, ev);
      bump();
      await pause(0.6);
      if ((await live(openResults(ev.rank))) === 'again') send({ t: 'again' }); else onLeaveRoom();
      return;
    }
  }
}

/** A question to `player`: this player gets the card (or the button), the others see who is being waited for. Over when it is answered or closed. */
async function ask(id: number, player: number, prompt: Prompt) {
  const mine = player === G.myPlayer;
  if (wasClosed(id) || (isTabHidden() && !mine)) return;
  const over = new Promise<void>((res) => hold(id, res));
  let card: Open<void> | null = null, btn: Button | null = null;
  if (prompt.k === 'casino') void showCasino(prompt.view, { id, mine });
  else if (prompt.k === 'roll') { if (mine) actionBtn.set((btn = { label: 'ROLL DICE', spaceShortcut: true, click: () => reply(id, true), submitAnswer: (v) => reply(id, v) })); }
  else if (mine) card = openAsk(id, prompt, (v) => { if (prompt.k === 'news' && v === false) keptRedrawNews = prompt.card; }); // the others only see who is being waited for
  waitingFor.set(mine ? -1 : player);
  askedPlayer = player; showClock();
  if (mine) playTurnMine();
  await live(over);
  card?.close();
  if (prompt.k === 'casino' && openCasinoModal?.ask.get()?.id === id) openCasinoModal.ask.set(null);
  if (btn && actionBtn.get() === btn) actionBtn.set(null);
  waitingFor.set(-1);
  askedPlayer = -1; showClock();
}
