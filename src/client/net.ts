import { WS_CLOSE_LEAVE, WS_CLOSE_REPLACED, type C2S, type Fail, type RoomInfo, type S2C } from '../shared/protocol';
import type { Ev } from '../shared/types';

// Who this tab is: kept for the life of the tab, so a reload returns to the same seat.
const tabPlayerId = sessionStorage.getItem('pid') ?? (sessionStorage.setItem('pid', crypto.randomUUID()), sessionStorage.getItem('pid')!);

export const devUrl = new URLSearchParams(location.search).get('dev') === '1'; // a room made from a page opened with ?dev=1 is a dev room: its host may seat bots

const FAIL: Record<Fail, string> = { 'no-room': 'Room not found', full: 'Room is full', started: 'The game has already started', busy: 'No room available' };

export interface Handlers {
  room(r: RoomInfo): void;
  game(m: Extract<S2C, { t: 'game' }>): void;
  ev(e: Ev[]): void;
  end(why: string): void; // the connection is over for good
}
let on: Handlers;
export const listen = (h: Handlers) => (on = h);

const MAX_RECONNECT_ATTEMPTS = 6, PING_INTERVAL_MS = 20_000, PONG_TIMEOUT_MS = 10_000;
let ws: WebSocket | null = null;
let targetRoom: { code: string; name: string; dev: boolean } | null = null;
let joined = false, reconnectAttempts = 0, reconnectTimer: ReturnType<typeof setTimeout> | undefined, pingInterval: ReturnType<typeof setInterval> | undefined;
let pongTimeout: ReturnType<typeof setTimeout> | undefined;
let resolveInitialOpen: ((err: string | null) => void) | null = null;

export function send(msg: C2S) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
export const answer = (id: number, value: unknown) => send({ t: 'answer', id, value });
/** The socket's own readyState; -1 while there is none (never connected, or let go). */
export const socketReadyState = () => (ws ? ws.readyState : -1);

/** Enter a room (an empty code creates one). Resolves null once in, else why not. */
export function open(code: string, name: string, dev = devUrl): Promise<string | null> {
  leave();
  targetRoom = { code, name, dev }; joined = false; reconnectAttempts = 0;
  return new Promise((res) => { resolveInitialOpen = res; connect(); });
}

/** Let go of the room. With another `code` than WS_CLOSE_LEAVE (1000, or 3000-4999: a browser allows no others) the seat is kept, and a running game goes on without us, as when a page is closed. */
export function leave(code = WS_CLOSE_LEAVE) {
  targetRoom = null;
  clearTimeout(reconnectTimer);
  clearInterval(pingInterval);
  clearTimeout(pongTimeout);
  settle('Cancelled');
  const w = ws;
  ws = null;
  w?.close(code, 'leave');
}

function settle(err: string | null) { resolveInitialOpen?.(err); resolveInitialOpen = null; }

function end(why: string) {
  targetRoom = null;
  settle(why);
  on.end(why);
}

function connect() {
  const w = targetRoom!, q = new URLSearchParams({ pid: tabPlayerId, name: w.name });
  if (w.code) q.set('code', w.code);
  if (w.dev) q.set('dev', '1');
  const sock = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws?${q}`));
  sock.onopen = () => {
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      send({ t: 'ping' });
      clearTimeout(pongTimeout);
      pongTimeout = setTimeout(() => lost(sock, 1006), PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  };
  sock.onmessage = (e) => {
    if (ws !== sock) return;
    clearTimeout(pongTimeout); // anything the server says shows the link is alive (a ping is answered with an empty batch of events)
    const m = JSON.parse(e.data) as S2C;
    if (m.t === 'room') { w.code = m.room.code; joined = true; reconnectAttempts = 0; settle(null); on.room(m.room); }
    else if (m.t === 'game') on.game(m);
    else if (m.t === 'ev') on.ev(m.ev);
    else { targetRoom = null; settle(FAIL[m.reason]); } // 'fail': the server closes the socket after it
  };
  sock.onclose = (e) => lost(sock, e.code);
}

/** The socket is over: it closed, or it went silent. A dead link may not be reported for minutes, and closing it takes tens of seconds to complete (the other end never answers): so it is let go here, not in `onclose`. */
function lost(sock: WebSocket, code: number) {
  if (ws !== sock) return; // we left, or a newer socket took over
  ws = null;
  sock.close(); // does nothing if it is closed already
  clearInterval(pingInterval);
  clearTimeout(pongTimeout);
  if (!targetRoom) return;
  if (code === WS_CLOSE_REPLACED) return end('You joined this room from another tab');
  if (code === 1000) return end('The room was closed');
  if (!joined) return end('Cannot reach the server');
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return end('Connection lost');
  reconnectTimer = setTimeout(connect, 500 * 2 ** reconnectAttempts++); // the same seat comes back with the same id
}
