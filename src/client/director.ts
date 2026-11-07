import { apply, ranking } from '../shared/state';
import type { Ev, GameState, Prompt } from '../shared/types';
import { close, forget, hold, reply, wasClosed } from './asks';
import { send } from './net';
import { clearDice, hideDice, hop, jump, placeAt, removeToken, rollDice, setActive, tokens } from './render/actors';
import { home } from './render/board';
import { finishTweens, wait } from './render/scene';
import { enterGame, focusTok, selectTile, setOwner, showState, tokenSpot } from './stage';
import { G, bump, clearCards, floatText, floats, session, tip, toast, toasts, type Button, type Open } from './store';
import { dropCasinoAsk, forgetCasino, openAsk, openNews, openNewsFor, openNotice, openOrder, openResults, showCasino, closeCasino } from './ui/dialogs';
import { money } from './ui/bits';

// The director plays the server's events on this client's screen, one at a time. The server runs ahead (it only waits for decisions): `G.S` is the game
// as far as the screen has got, so a log line, a payment or a purchase appears when its animation does. Questions are asked of one player at a time; the
// others see who is being waited for.
export const hooks = { leave: () => {} };

const queue: Ev[] = [];
let running = false;
let epoch = 0; // a reset (a snapshot, a new game, leaving) ends whatever was being played

/** Hold on to a promise, but forget what comes after it if the director was reset meanwhile. */
const live = <T>(p: Promise<T>): Promise<T> => { const e = epoch; return p.then((v) => (e === epoch ? v : new Promise<T>(() => {}))); };
const pause = (s: number) => live(wait(s));
const quiet = () => document.hidden; // nobody sees it: no cards, toasts or numbers, only the state

export function reset() {
  epoch++;
  queue.length = 0;
  running = false;
  forget();
  forgetCasino();
  clearCards();
  toasts.set([]); floats.set([]); tip.set(null);
  finishTweens();
  clearDice();
  Object.assign(G, { btn: null, waiting: -1, chip: null });
  bump();
}

export function push(evs: Ev[]) {
  for (const ev of evs) { if (ev.t === 'close') close(ev.id); else queue.push(ev); } // a closed question comes down at once, not when the director gets to it
  void pump();
}

async function pump() {
  if (running) return;
  running = true;
  const e = epoch;
  while (queue.length && e === epoch) {
    try { await play(queue.shift()!); } catch (err) { console.error(err); }
  }
  if (e === epoch) running = false;
}

/** The screen as a snapshot says the game is now (joining a running game, or coming back to it). */
export function restore(m: { me: number; state: GameState; ask: Ev | null }) {
  reset();
  Object.assign(G, { S: m.state, me: m.me, view: m.me, sel: -1, tab: 'tile', live: true });
  session.set({ ...session.get(), view: 'game' });
  showState(m.state);
  enterGame();
  focusTok(m.state.order[m.state.turn]);
  if (m.ask) queue.push(m.ask);
  if (m.state.over) queue.push({ t: 'over', rank: ranking(m.state) });
  bump();
  void pump();
}

// ---- Floating numbers on a player's card: the token can be anywhere, off screen ----
const air: Record<number, number> = {};
function floatCard(pi: number, text: string, tone: string) {
  const r = document.querySelector(`#players [data-i="${pi}"] .cash`)?.getBoundingClientRect();
  if (!r) return;
  floatText(r.right, r.top - 32 * (air[pi] ||= 0), text, `${tone} hud`);
  air[pi]++;
  setTimeout(() => air[pi]--, 1500);
}

/** The beat that ends a turn: its player may end it sooner (click or Space); for everybody else it is a pause to read the result. */
async function beat(who: number) {
  if (quiet()) return;
  if (who !== G.me) return pause(1.5);
  const e = epoch;
  await new Promise<void>((res) => {
    const end = () => { clearTimeout(timer); if (e === epoch && G.btn === btn) { G.btn = null; bump(); } res(); };
    const btn: Button = { label: 'END TURN', kbd: true, click: end };
    const timer = setTimeout(end, 1500);
    G.btn = btn;
    bump();
  });
}

const mine = () => { const r = session.get().room; return r?.seats.find((s) => s.seat === r.me)?.pi ?? -1; }; // my player index, as the room says

async function play(ev: Ev) {
  if (ev.t === 'start') {
    Object.assign(G, { S: ev.state, me: mine(), live: false, sel: -1, tab: 'tile', chip: null });
    G.view = G.me;
    session.set({ ...session.get(), view: 'game' });
    showState(ev.state);
    enterGame();
    bump();
    return;
  }
  const S = G.S;
  if (!S) return;
  const cur = S.order[S.turn];
  switch (ev.t) {
    case 'order':
      if (!quiet()) await live(openOrder(S.players, ev.passes, ev.order));
      apply(S, ev);
      G.live = true;
      bump();
      return;
    case 'turn': {
      if (S.step === 'resolve' && !S.over && !S.players[cur].out) await beat(cur); // a turn that was played to its end
      apply(S, ev);
      Object.assign(G, { chip: null, btn: null, waiting: -1 });
      setActive(S.order[S.turn]);
      focusTok(S.order[S.turn]);
      bump();
      await pause(0.6);
      return;
    }
    case 'step': case 'log': apply(S, ev); bump(); return;
    case 'dice': {
      const tok = tokens[cur];
      if (tok) await live(rollDice(home(tok.tile), [ev.a, ev.b]));
      G.chip = [ev.a, ev.b];
      bump();
      await pause(0.7);
      await live(hideDice());
      return;
    }
    case 'move': {
      const tok = tokens[ev.pi];
      if (tok) await live(ev.how === 'hop' ? hop(tok, ev.to) : jump(tok, ev.to));
      apply(S, ev);
      if (ev.how === 'jump' && ev.pi === cur) focusTok(ev.pi); // the camera follows a hop by itself; a jump leaves it behind
      bump();
      return;
    }
    case 'cash': {
      apply(S, ev);
      if (!quiet()) {
        const text = (ev.d > 0 ? '+' : '') + money(ev.d), tone = ev.d > 0 ? 'good' : 'bad', at = tokenSpot(ev.pi);
        if (at) floatText(at[0], at[1], text, tone);
        floatCard(ev.pi, text, tone);
      }
      bump();
      return;
    }
    case 'own': apply(S, ev); setOwner(ev.i, ev.o, S); bump(); return;
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
      bump();
      return;
    }
    case 'toast': if (!quiet()) toast(ev.m, ev.tone); return;
    case 'sel': if (ev.pi === G.me) selectTile(ev.i); return;
    case 'skip': if (!quiet()) toast(ev.m, 'bad'); await pause(1.6); return;
    case 'notice': if (!quiet()) await live(openNotice(ev.n)); return;
    case 'news': if (!quiet()) await live(openNews(ev.card)); return;
    case 'casino': if (quiet()) closeCasino(); else await live(showCasino(ev.view, null)); return;
    case 'ask': return ask(ev.id, ev.to, ev.p);
    case 'over': {
      apply(S, ev);
      bump();
      await pause(0.6);
      if ((await live(openResults(ev.rank))) === 'again') send({ t: 'again' }); else hooks.leave();
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
  else if (p.k === 'roll') { if (me) G.btn = btn = { label: 'ROLL DICE', kbd: true, click: () => reply(id, true) }; }
  else card = me ? openAsk(id, p) : p.k === 'news' ? openNewsFor(p.card) : null;
  G.waiting = me ? -1 : to;
  bump();
  await live(over);
  card?.close();
  if (p.k === 'casino') dropCasinoAsk(id);
  if (btn && G.btn === btn) G.btn = null;
  G.waiting = -1;
  bump();
}
