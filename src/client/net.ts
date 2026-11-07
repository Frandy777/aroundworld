import { LEAVE, REPLACED, type C2S, type Fail, type RoomInfo, type S2C } from '../shared/protocol';
import type { Ev } from '../shared/types';

// Who this tab is: kept for the life of the tab, so a reload returns to the same seat.
const pid = sessionStorage.getItem('pid') ?? (sessionStorage.setItem('pid', crypto.randomUUID()), sessionStorage.getItem('pid')!);

const FAIL: Record<Fail, string> = { 'no-room': 'Room not found', full: 'Room is full', started: 'The game has already started', busy: 'No room available' };

export interface Handlers {
  room(r: RoomInfo): void;
  game(m: Extract<S2C, { t: 'game' }>): void;
  ev(e: Ev[]): void;
  end(why: string): void; // the connection is over for good
}
let on: Handlers;
export const listen = (h: Handlers) => (on = h);

const TRIES = 6;
let ws: WebSocket | null = null;
let want: { code: string; name: string } | null = null; // the room to be in; null once left
let joined = false, tries = 0, retry: ReturnType<typeof setTimeout> | undefined, beat: ReturnType<typeof setInterval> | undefined;
let first: ((err: string | null) => void) | null = null;

export function send(msg: C2S) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
export const answer = (id: number, v: unknown) => send({ t: 'answer', id, v });

/** Enter a room (an empty code creates one). Resolves null once in, else why not. */
export function open(code: string, name: string): Promise<string | null> {
  leave();
  want = { code, name }; joined = false; tries = 0;
  return new Promise((res) => { first = res; connect(); });
}

export function leave() {
  want = null;
  clearTimeout(retry);
  clearInterval(beat);
  settle('Cancelled');
  const w = ws;
  ws = null;
  w?.close(LEAVE, 'leave');
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
  const sock = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws?${q}`));
  sock.onopen = () => { clearInterval(beat); beat = setInterval(() => send({ t: 'ping' }), 20_000); };
  sock.onmessage = (e) => {
    if (ws !== sock) return;
    const m = JSON.parse(e.data) as S2C;
    if (m.t === 'room') { w.code = m.room.code; joined = true; tries = 0; settle(null); on.room(m.room); }
    else if (m.t === 'game') on.game(m);
    else if (m.t === 'ev') on.ev(m.ev);
    else { want = null; settle(FAIL[m.why]); } // 'fail': the server closes the socket after it
  };
  sock.onclose = (e) => {
    if (ws !== sock) return; // we left, or a newer socket took over
    ws = null;
    clearInterval(beat);
    if (!want) return;
    if (e.code === REPLACED) return end('You joined this room from another tab');
    if (e.code === 1000) return end('The room was closed');
    if (!joined) return end('Cannot reach the server');
    if (tries >= TRIES) return end('Connection lost');
    retry = setTimeout(connect, 500 * 2 ** tries++); // the same seat comes back with the same id
  };
}
