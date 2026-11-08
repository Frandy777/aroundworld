import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS, PLAYER_DEFS } from '../shared/data';
import { DEFAULT_SETTINGS, LEAVE, NAME_MAX, PID_RE, REPLACED, ROUNDS_MAX, ROUNDS_MIN, type C2S, type Fail, type RoomInfo, type S2C } from '../shared/protocol';
import type { Ev, Settings } from '../shared/types';
import { Game, fresh, type Host, type Saved } from './game';

export interface Env { ROOM: DurableObjectNamespace<Room>; LIMITER: RateLimit }

const SEAT_GRACE_MS = 30_000; // in the lobby, a seat whose player vanished is kept this long (a page reload must not cost it)
const IDLE_MS = 5 * 60_000; // nobody connected for this long: the room is dissolved
const RATE_MS = 500, BURST_MS = 10_000; // a seat's `name`, `settings` and `bot` (each one is broadcast to the room): one is let through per RATE_MS, with up to BURST_MS worth of them at once; the rest are dropped
const DEV_ROOMS = import.meta.env.DEV; // dev rooms (bots, the dev panel) exist in development builds only: in production `?dev=1` makes a plain room (bots wake the object every 300ms, and the panel's commands grow the tape without limit)

interface Seat {
  pid: string; seat: number; name: string; pi: number; // pi: player index in the game, -1 before it starts
  left: boolean; drop: number; // drop: when the seat of a player who vanished is let go (epoch ms; 0: it is held)
  bot?: true; // a bot (dev rooms): no connection, always there, and it answers by itself (see `Host.bot`)
}
// What is written to storage of a room (see `save`). The connections are not: the runtime keeps them.
interface Stored { code: string; host: string; dev: boolean; settings: Settings; idle: number; seats: Seat[]; game?: Saved }

const cleanName = (raw: string, seat: number) => Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, NAME_MAX).join('').trim() || PLAYER_DEFS[seat].name;

// One room = one object, written to storage whenever it changes: an object that was evicted or restarted comes back as the room it was (`restore`). The connections hibernate with it (the runtime
// keeps them, tagged with their player's id, and wakes the object for what they say), and everything that waits for a time is a deadline, which the alarm watches (`save` sets it).
// When the room dissolves the object keeps nothing, and a gone room's code is free again.
export class Room extends DurableObject<Env> implements Host {
  private code = ''; // '' while there is no room
  private seats: Seat[] = [];
  private host = ''; // pid of the host
  dev = false; // a dev room (made with ?dev=1, in development only: see DEV_ROOMS): its host may seat bots, and its roll question takes the commands of the dev panel (see `Host`)
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private game: Game | null = null;
  private idle = 0; // when a room nobody is connected to is dissolved (epoch ms; 0: somebody is)
  private batch: string[] = []; // events of this tick, already serialised: they go out together
  private next = new WeakMap<Seat, number>(); // per seat, when its next `name` or `settings` is due at the pace of RATE_MS (see `limited`; kept in memory only)
  private stored = ''; // what storage holds of the room
  private alarmAt = NaN; // what the alarm is set to (NaN: unknown)

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // A ping is answered by the runtime, without waking the room: with an empty batch of events, which a client takes in stride.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"ev","ev":[]}'));
    void ctx.blockConcurrencyWhile(() => this.restore());
  }

  /** An object that was evicted or restarted starts empty: bring its room back, and the game with it. */
  private async restore() {
    const json = this.ctx.storage.kv.get<string>('room');
    if (!json) return;
    try {
      const { game, ...room }: Stored = JSON.parse(json);
      if (room.dev && !DEV_ROOMS) return this.dissolve(); // a dev room that storage holds from before they were shut off in production: it ends here
      this.stored = json;
      Object.assign(this, room);
      if (game) {
        let g = (this.game = new Game(this, game.ckpt));
        try { await g.resume(game); } catch (err) { // the code plays the turn differently than it was played (game.ts was edited under it): the room is not lost for that, the turn starts over from its checkpoint
          console.warn('replay failed, the turn starts over', err);
          g = this.game = new Game(this, game.ckpt);
          this.seats.forEach((s) => this.snapshot(s)); // whoever is still connected saw the turn go on: back to where it began (the events of the new run follow)
          g.run(true).catch((e) => console.error('game crashed', e));
        }
        for (const s of this.seats) if (s.left) g.forfeit(s.pi);
      }
      if (!this.anyOnline()) this.presence(); // the connections are gone (a restart cuts them): nobody can be waited for
    } catch (err) {
      console.error('room lost', err);
      this.dissolve();
    }
  }

  /** Write the room down, and set the alarm for the first deadline there is. Called wherever something may have changed. */
  save() {
    if (!this.code) return; // dissolved: nothing is kept
    const { code, host, dev, settings, idle, seats } = this;
    const json = JSON.stringify({ code, host, dev, settings, idle, seats, game: this.game?.saved } satisfies Stored);
    if (json !== this.stored) this.ctx.storage.kv.put('room', (this.stored = json));
    const at = Math.min(...[idle, this.game?.due ?? 0, ...seats.map((s) => s.drop)].filter(Boolean)); // Infinity: nothing to wait for
    if (at === this.alarmAt) return;
    this.alarmAt = at;
    void (at < Infinity ? this.ctx.storage.setAlarm(at) : this.ctx.storage.deleteAlarm());
  }

  /** Claim a code for a new room: false when it is taken. Nothing is stored yet: the `fetch` that seats its creator follows, and saves once (a creator who never comes leaves nothing in storage, and no alarm). */
  create(code: string, dev: boolean) {
    if (this.code) return false;
    this.code = code;
    this.dev = dev && DEV_ROOMS;
    this.idle = Date.now() + IDLE_MS; // nobody is connected yet: if nobody comes, the room must not stay for ever
    return true;
  }

  async fetch(req: Request): Promise<Response> {
    const q = new URL(req.url).searchParams, pid = q.get('pid') ?? '';
    for (const old of this.conns(pid)) old.close(REPLACED, 'replaced'); // the new connection of a player replaces their old one
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [pid.slice(0, 64)]); // the connection is tagged with its player's id (cut short, so that a bad one is turned away by `join` instead of throwing here)
    this.join(server, pid, q.get('name') ?? '');
    this.save();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- Events from the runtime ----
  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const s = this.seatOf(ws);
    if (s) this.onMessage(s, raw);
    this.save();
  }
  webSocketClose(ws: WebSocket, code: number) { this.onClose(ws, code); }
  webSocketError(ws: WebSocket) { this.onClose(ws, 1006); }

  /** A deadline has come: of a room nobody is in, of the seat of a player who vanished, or of the question that waits for an answer. */
  alarm() {
    this.alarmAt = NaN; // spent
    const now = Date.now();
    if (this.idle && this.idle <= now) this.dissolve();
    else {
      this.seats.filter((s) => s.drop && s.drop <= now).forEach((s) => this.leave(s));
      this.game?.tick(now);
    }
    this.save();
  }

  // ---- Host (what the game needs of its room) ----
  emit(ev: Ev) {
    if (!this.batch.length) queueMicrotask(() => this.flush());
    this.batch.push(JSON.stringify(ev));
  }
  online(pi: number) { return this.seats.some((s) => s.pi === pi && this.up(s)); }
  bot(pi: number) { return this.seats.some((s) => s.pi === pi && s.bot); }
  anyOnline() { return this.seats.some((s) => !s.bot && this.up(s)); } // people only: bots watch nothing, and keep no room alive

  // ---- Wire ----
  private conns(pid?: string) { return this.ctx.getWebSockets(pid).filter((w) => w.readyState === WebSocket.OPEN); } // a closing one may still be listed
  private up(s: Seat) { return !!s.bot || this.conns(s.pid).length > 0; }
  private seatOf(ws: WebSocket) { const [pid] = this.ctx.getTags(ws); return this.seats.find((s) => s.pid === pid); }
  private send(s: Seat, msg: S2C | string) {
    const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const w of this.conns(s.pid)) {
      try { w.send(raw); } catch { /* the socket is closing: its close event follows */ }
    }
  }
  private flush() {
    if (!this.batch.length) return;
    const msg = `{"t":"ev","ev":[${this.batch.join(',')}]}`;
    this.batch = [];
    this.seats.forEach((s) => this.send(s, msg));
  }
  private info(s: Seat): RoomInfo {
    return {
      code: this.code, settings: this.settings, started: !!this.game, me: s.seat, dev: this.dev,
      seats: [...this.seats].sort((a, b) => a.seat - b.seat).map((x) => ({ seat: x.seat, name: x.name, online: this.up(x), host: x.pid === this.host, bot: !!x.bot, pi: x.pi })),
    };
  }
  private broadcastRoom() { this.seats.forEach((s) => this.send(s, { t: 'room', room: this.info(s) })); }
  /** Where the game stands, for a client with nothing to go by: one that joined or came back, or one whose turn has just started over (see `restore`). */
  private snapshot(s: Seat) { if (this.game) this.send(s, { t: 'game', me: s.pi, state: this.game.S, ask: this.game.pendingEv }); }
  private fail(ws: WebSocket, why: Fail) {
    ws.send(JSON.stringify({ t: 'fail', why } satisfies S2C));
    ws.close(1000, why);
  }

  // ---- Seats ----
  private join(ws: WebSocket, pid: string, name: string) {
    if (!this.code) return this.fail(ws, 'no-room');
    if (!PID_RE.test(pid)) return ws.close(1008, 'bad id');
    let s = this.seats.find((x) => x.pid === pid);
    if (s?.left || (!s && this.game)) return this.fail(ws, 'started');
    if (!s) {
      if (this.seats.length >= MAX_PLAYERS) return this.fail(ws, 'full');
      const seat = PLAYER_DEFS.findIndex((_, k) => !this.seats.some((x) => x.seat === k));
      s = { pid, seat, name: cleanName(name, seat), pi: -1, left: false, drop: 0 };
      this.seats.push(s);
      if (!this.host) this.host = pid;
    }
    this.flush(); // what the others have been told is what the snapshot below contains
    this.presence();
    this.snapshot(s);
  }

  private onClose(ws: WebSocket, code: number) {
    const s = this.seatOf(ws);
    if (s && !s.left && !this.up(s)) { // not a seat that has left already, nor a connection that a newer one of the same player replaced
      if (code === LEAVE) this.leave(s); else this.presence();
    }
    this.save();
  }

  // The player is gone for good: their seat is freed, or in a running game they forfeit.
  private leave(s: Seat) {
    s.drop = 0;
    if (this.game) { s.left = true; this.game.forfeit(s.pi); } else this.seats = this.seats.filter((x) => x !== s);
    if (this.host === s.pid) this.host = this.seats.find((x) => !x.left && !x.bot)?.pid ?? '';
    if (this.seats.every((x) => x.left || x.bot)) return this.dissolve(); // only bots are left: nobody to play for
    this.presence();
  }

  /** Somebody connected or vanished: tell the room, and set the clocks of whatever waits for a player (the open question, a lobby seat, the room itself). */
  private presence() {
    this.broadcastRoom();
    this.game?.presence();
    const now = Date.now();
    for (const s of this.seats) {
      if (this.up(s)) s.drop = 0;
      else if (!this.game) s.drop ||= now + SEAT_GRACE_MS;
    }
    this.idle = this.anyOnline() ? 0 : this.idle || now + IDLE_MS;
  }

  /** The room ends: nothing of it is kept. */
  private dissolve() {
    this.game?.dispose();
    this.conns().forEach((w) => w.close(1000, 'room closed'));
    this.seats = [];
    this.game = null;
    this.batch = [];
    this.host = '';
    this.dev = false;
    this.settings = { ...DEFAULT_SETTINGS };
    this.code = '';
    this.idle = 0;
    this.stored = '';
    this.alarmAt = NaN;
    void this.ctx.storage.deleteAll();
  }

  // ---- Messages ----
  /** Is this seat sending `name`, `settings` or `bot` faster than the pace allows? Each message makes the whole room a broadcast. A seat may run BURST_MS ahead of its pace; a message dropped for being over is not charged. */
  private limited(s: Seat) {
    const now = Date.now(), due = Math.max(this.next.get(s) ?? 0, now);
    if (due - now > BURST_MS) return true;
    this.next.set(s, due + RATE_MS);
    return false;
  }

  private onMessage(s: Seat, raw: unknown) {
    let msg: C2S;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if ((msg.t === 'name' || msg.t === 'settings' || msg.t === 'bot') && this.limited(s)) return;
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
      case 'bot': {
        const { seat } = msg, at = this.seats.find((x) => x.seat === seat); // at: who sits there
        if (!this.dev || this.game || !host || !Number.isInteger(seat) || seat < 0 || seat >= MAX_PLAYERS || (at && !at.bot)) return;
        if (at) this.seats = this.seats.filter((x) => x !== at);
        else this.seats.push({ pid: crypto.randomUUID(), seat, name: `Bot ${PLAYER_DEFS[seat].name}`, pi: -1, left: false, drop: 0, bot: true }); // the id is nobody's to guess: no connection can take the seat over
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
    this.game = new Game(this, fresh(players, this.settings));
    this.broadcastRoom();
    this.game.run().catch((err) => console.error('game crashed', err));
  }

  // After a game: back to the lobby with whoever is still here. The finished game's history goes.
  private reset() {
    this.game?.dispose();
    this.game = null;
    this.batch = [];
    this.seats = this.seats.filter((s) => !s.left && this.up(s));
    this.seats.forEach((s) => (s.pi = -1));
    if (!this.seats.some((s) => s.pid === this.host)) this.host = this.seats.find((s) => !s.bot)?.pid ?? '';
    if (!this.host) return this.dissolve(); // nobody but bots
    this.broadcastRoom();
  }
}
