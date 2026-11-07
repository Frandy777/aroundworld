import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS, PLAYER_DEFS } from '../shared/data';
import { DEFAULT_SETTINGS, LEAVE, NAME_MAX, REPLACED, ROUNDS_MAX, ROUNDS_MIN, type C2S, type Fail, type RoomInfo, type S2C } from '../shared/protocol';
import type { Ev, Settings } from '../shared/types';
import { Game, type Host } from './game';
import { stop } from './util';

export interface Env { ROOM: DurableObjectNamespace<Room> }

const SEAT_GRACE_MS = 30_000; // in the lobby, a seat whose player vanished is kept this long (a page reload must not cost it)
const IDLE_MS = 5 * 60_000; // nobody connected for this long: the room is dissolved

interface Seat {
  pid: string; seat: number; name: string; pi: number; // pi: player index in the game, -1 before it starts
  ws: WebSocket | null; left: boolean; drop?: ReturnType<typeof setTimeout>;
}

const cleanName = (raw: string, seat: number) => Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, NAME_MAX).join('').trim() || PLAYER_DEFS[seat].name;

// One room = one object. Everything lives in memory: when the room dissolves the object keeps nothing, and a gone room's code is free again.
export class Room extends DurableObject<Env> implements Host {
  private code = ''; // '' while there is no room
  private seats: Seat[] = [];
  private host = ''; // pid of the host
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private game: Game | null = null;
  private batch: string[] = []; // events of this tick, already serialised: they go out together
  private idle?: ReturnType<typeof setTimeout>;

  /** Claim a code for a new room: false when it is taken. */
  create(code: string) {
    if (this.code) return false;
    this.code = code;
    return true;
  }

  async fetch(req: Request): Promise<Response> {
    const q = new URL(req.url).searchParams;
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    this.join(server, q.get('pid') ?? '', q.get('name') ?? '');
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- Host (what the game needs of its room) ----
  emit(ev: Ev) {
    if (!this.batch.length) queueMicrotask(() => this.flush());
    this.batch.push(JSON.stringify(ev));
  }
  online(pi: number) { return !!this.seats.find((s) => s.pi === pi)?.ws; }
  anyOnline() { return this.seats.some((s) => s.ws); }

  // ---- Wire ----
  private send(s: Seat, msg: S2C | string) {
    try { s.ws?.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch { /* the socket is closing: its close event follows */ }
  }
  private flush() {
    if (!this.batch.length) return;
    const msg = `{"t":"ev","ev":[${this.batch.join(',')}]}`;
    this.batch = [];
    this.seats.forEach((s) => this.send(s, msg));
  }
  private info(s: Seat): RoomInfo {
    return {
      code: this.code, settings: this.settings, started: !!this.game, me: s.seat,
      seats: [...this.seats].sort((a, b) => a.seat - b.seat).map((x) => ({ seat: x.seat, name: x.name, online: !!x.ws, host: x.pid === this.host, pi: x.pi })),
    };
  }
  private broadcastRoom() { this.seats.forEach((s) => this.send(s, { t: 'room', room: this.info(s) })); }
  private fail(ws: WebSocket, why: Fail) {
    ws.send(JSON.stringify({ t: 'fail', why } satisfies S2C));
    ws.close(1000, why);
  }

  // ---- Seats ----
  private join(ws: WebSocket, pid: string, name: string) {
    if (!this.code) return this.fail(ws, 'no-room');
    if (!/^[\w-]{8,64}$/.test(pid)) return ws.close(1008, 'bad id');
    let s = this.seats.find((x) => x.pid === pid);
    if (s?.left || (!s && this.game)) return this.fail(ws, 'started');
    if (!s) {
      if (this.seats.length >= MAX_PLAYERS) return this.fail(ws, 'full');
      const seat = PLAYER_DEFS.findIndex((_, k) => !this.seats.some((x) => x.seat === k));
      s = { pid, seat, name: cleanName(name, seat), pi: -1, ws: null, left: false };
      this.seats.push(s);
      if (!this.host) this.host = pid;
    }
    const seat = s, old = seat.ws;
    seat.ws = ws;
    old?.close(REPLACED, 'replaced');
    stop(seat.drop);
    stop(this.idle);
    ws.addEventListener('message', (e) => this.onMessage(seat, e.data));
    ws.addEventListener('close', (e) => this.onClose(seat, ws, e.code));
    ws.addEventListener('error', () => this.onClose(seat, ws, 1006));
    this.flush(); // what the others have been told is what the snapshot below contains
    this.broadcastRoom();
    if (this.game) this.send(seat, { t: 'game', me: seat.pi, state: this.game.S, ask: this.game.pendingEv });
    this.game?.presence();
  }

  private onClose(s: Seat, ws: WebSocket, code: number) {
    if (s.ws !== ws) return; // a newer connection of the same player replaced this one
    s.ws = null;
    if (code === LEAVE) return this.leave(s);
    if (!this.game) s.drop = setTimeout(() => this.leave(s), SEAT_GRACE_MS);
    this.presence();
  }

  // The player is gone for good: their seat is freed, or in a running game they forfeit.
  private leave(s: Seat) {
    stop(s.drop);
    if (this.game) { s.left = true; this.game.forfeit(s.pi); } else this.seats = this.seats.filter((x) => x !== s);
    if (this.host === s.pid) this.host = this.seats.find((x) => !x.left)?.pid ?? '';
    if (this.seats.every((x) => x.left)) return this.dissolve();
    this.presence();
  }

  private presence() {
    this.broadcastRoom();
    this.game?.presence();
    stop(this.idle);
    if (!this.anyOnline()) this.idle = setTimeout(() => this.dissolve(), IDLE_MS);
  }

  /** The room ends: nothing of it is kept. */
  private dissolve() {
    stop(this.idle);
    this.game?.dispose();
    for (const s of this.seats) { stop(s.drop); s.ws?.close(1000, 'room closed'); }
    this.seats = [];
    this.game = null;
    this.batch = [];
    this.host = '';
    this.settings = { ...DEFAULT_SETTINGS };
    this.code = '';
  }

  // ---- Messages ----
  private onMessage(s: Seat, raw: unknown) {
    let msg: C2S;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const host = s.pid === this.host;
    switch (msg.t) {
      case 'name':
        if (this.game || typeof msg.name !== 'string') return;
        s.name = cleanName(msg.name, s.seat);
        this.broadcastRoom();
        break;
      case 'settings': {
        const { mode, rounds } = msg.s ?? {};
        if (this.game || !host || (mode !== 'limited' && mode !== 'endless') || !Number.isInteger(rounds) || rounds < ROUNDS_MIN || rounds > ROUNDS_MAX) return;
        this.settings = { mode, rounds };
        this.broadcastRoom();
        break;
      }
      case 'start': if (!this.game && host && this.seats.length >= 2) this.start(); break;
      case 'answer': if (this.game && s.pi >= 0) this.game.answer(s.pi, msg.id, msg.v); break;
      case 'again': if (this.game?.S.over) this.reset(); break;
    }
  }

  private start() {
    [...this.seats].sort((a, b) => a.seat - b.seat).forEach((s, i) => (s.pi = i));
    const players = [...this.seats].sort((a, b) => a.pi - b.pi).map((s) => ({ name: s.name, color: PLAYER_DEFS[s.seat].color }));
    this.game = new Game(this, players, this.settings);
    this.broadcastRoom();
    this.game.run().catch((err) => console.error('game crashed', err));
  }

  // After a game: back to the lobby with whoever is still here. The finished game's history goes.
  private reset() {
    this.game?.dispose();
    this.game = null;
    this.batch = [];
    this.seats = this.seats.filter((s) => !s.left && s.ws);
    this.seats.forEach((s) => (s.pi = -1));
    if (!this.seats.some((s) => s.pid === this.host)) this.host = this.seats[0]?.pid ?? '';
    if (!this.seats.length) return this.dissolve();
    this.broadcastRoom();
  }
}
