import { LEAVE, REPLACED, type C2S, type Fail, type RoomInfo, type S2C } from '../shared/protocol';
import type { Ev } from '../shared/types';

// Who this tab is: kept for the life of the tab, so a reload returns to the same seat.
const pid = sessionStorage.getItem('pid') ?? (sessionStorage.setItem('pid', crypto.randomUUID()), sessionStorage.getItem('pid')!);

const dev = new URLSearchParams(location.search).get('dev') === '1'; // a room made from a page opened with ?dev=1 is a dev room: its host may seat bots

const FAIL: Record<Fail, string> = { 'no-room': 'Room not found', full: 'Room is full', started: 'The game has already started', busy: 'No room available' };

export interface Handlers {
  room(r: RoomInfo): void;
  game(m: Extract<S2C, { t: 'game' }>): void;
  ev(e: Ev[]): void;
  end(why: string): void; // the connection is over for good
}
let on: Handlers;
export const listen = (h: Handlers) => (on = h);

const TRIES = 6, PING = 20_000, PONG = 10_000; // a ping goes out every PING ms; if nothing at all comes back within PONG ms of it, the link is dead
let ws: WebSocket | null = null;
let want: { code: string; name: string } | null = null; // the room to be in; null once left
let joined = false, tries = 0, retry: ReturnType<typeof setTimeout> | undefined, beat: ReturnType<typeof setInterval> | undefined;
let dead: ReturnType<typeof setTimeout> | undefined; // armed by every ping, disarmed by whatever the server says
let first: ((err: string | null) => void) | null = null;

export function send(msg: C2S) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
export const answer = (id: number, v: unknown) => send({ t: 'answer', id, v });

/** Enter a room (an empty code creates one). Resolves null once in, else why not. */
export function open(code: string, name: string): Promise<string | null> {
  leave();
  want = { code, name }; joined = false; tries = 0;
  return new Promise((res) => { first = res; connect(); });
}

/** Let go of the room. With another `code` than LEAVE (1000, or 3000-4999: a browser allows no others) the seat is kept, and a running game goes on without us, as when a page is closed. */
export function leave(code = LEAVE) {
  want = null;
  clearTimeout(retry);
  clearInterval(beat);
  clearTimeout(dead);
  settle('Cancelled');
  const w = ws;
  ws = null;
  w?.close(code, 'leave');
}

function settle(err: string | null) { first?.(err); first = null; }

function end(why: string) {
  want = null;
  settle(why);
  on.end(why);
}

function connect() {
  const w = want!, q = new URLSearchParams({ pid, name: w.name });
  if (w.code) q.set('code', w.code);
  if (dev) q.set('dev', '1');
  const sock = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws?${q}`));
  sock.onopen = () => {
    clearInterval(beat);
    beat = setInterval(() => {
      send({ t: 'ping' });
      clearTimeout(dead);
      dead = setTimeout(() => lost(sock, 1006), PONG);
    }, PING);
  };
  sock.onmessage = (e) => {
    if (ws !== sock) return;
    clearTimeout(dead); // anything the server says shows the link is alive (a ping is answered with an empty batch of events)
    const m = JSON.parse(e.data) as S2C;
    if (m.t === 'room') { w.code = m.room.code; joined = true; tries = 0; settle(null); on.room(m.room); }
    else if (m.t === 'game') on.game(m);
    else if (m.t === 'ev') on.ev(m.ev);
    else { want = null; settle(FAIL[m.why]); } // 'fail': the server closes the socket after it
  };
  sock.onclose = (e) => lost(sock, e.code);
}

/** The socket is over: it closed, or it went silent. A dead link may not be reported for minutes, and closing it takes tens of seconds to complete (the other end never answers): so it is let go here, not in `onclose`. */
function lost(sock: WebSocket, code: number) {
  if (ws !== sock) return; // we left, or a newer socket took over
  ws = null;
  sock.close(); // does nothing if it is closed already
  clearInterval(beat);
  clearTimeout(dead);
  if (!want) return;
  if (code === REPLACED) return end('You joined this room from another tab');
  if (code === 1000) return end('The room was closed');
  if (!joined) return end('Cannot reach the server');
  if (tries >= TRIES) return end('Connection lost');
  retry = setTimeout(connect, 500 * 2 ** tries++); // the same seat comes back with the same id
}
