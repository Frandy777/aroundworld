import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS, PLAYER_DEFS } from '../shared/data';
import { DEFAULT_SETTINGS, NAME_MAX, PLAYER_ID_RE, ROUNDS_MAX, ROUNDS_MIN, WS_CLOSE_LEAVE, WS_CLOSE_REPLACED, type C2S, type Fail, type RoomInfo, type S2C } from '../shared/protocol';
import type { Ev, Settings } from '../shared/types';
import { Game, fresh, type Host, type Saved, type TurnCheckpoint } from './game';

export interface Env { ROOM: DurableObjectNamespace<Room>; LIMITER: RateLimit }

const SEAT_GRACE_MS = 30_000; // in the lobby, a seat whose player vanished is kept this long (a page reload must not cost it)
const IDLE_MS = 5 * 60_000; // nobody connected for this long: the room is dissolved
const LOBBY_MS = 20 * 60_000, OVER_MS = 10 * 60_000, LIFE_MS = 6 * 60 * 60_000; // hard deadlines, even with open tabs: waiting to start, viewing results, and the room's entire life
const RATE_MS = 500, BURST_MS = 10_000; // a seat's `name`, `settings` and `bot` (each one is broadcast to the room): one is let through per RATE_MS, with up to BURST_MS worth of them at once; a connection that sends one over that is closed
const FRAME_MAX = 256; // the longest message a client sends (an `answer` that picks every city) is under 200 bytes: a frame over this is not from our client, and is closed before it is parsed
const DEV_ROOMS = import.meta.env.DEV; // dev rooms (bots, the dev panel) exist in development builds only: in production `?dev=1` makes a plain room (bots wake the object every 300ms, and the panel's commands grow the tape without limit)

interface Seat {
  playerId: string; seat: number; name: string; playerIndex: number; // -1 before the game starts
  left: boolean; dropSeatAt: number; // 0 while the seat is held
  bot?: true; // a bot (dev rooms): no connection, always there, and it answers by itself (see `Host.bot`)
}
// What is written to storage of a room (see `save`), under two keys. 'room': the room, and what the turn in progress has taken so far (it changes at every step). 'ckpt': how that turn began (it changes once a turn, and it
// is nearly all of the bytes: the whole state, with its log). The connections are not written: the runtime keeps them.
interface Stored { code: string; hostPlayerId: string; dev: boolean; settings: Settings; idleDissolveAt: number; lifetimeExpiresAt: number; stageExpiresAt: number; seats: Seat[]; game?: Omit<Saved, 'checkpoint'> }

const cleanName = (raw: string, seat: number) => Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, NAME_MAX).join('').trim() || PLAYER_DEFS[seat].name;

// One room = one object, written to storage whenever it changes: an object that was evicted or restarted comes back as the room it was (`restore`). The connections hibernate with it (the runtime
// keeps them, tagged with their player's id, and wakes the object for what they say), and everything that waits for a time is a deadline, which the alarm watches (`save` sets it).
// When the room dissolves the object keeps nothing, and a gone room's code is free again.
export class Room extends DurableObject<Env> implements Host {
  private code = ''; // '' while there is no room
  private seats: Seat[] = [];
  private hostPlayerId = '';
  dev = false; // a dev room (made with ?dev=1, in development only: see DEV_ROOMS): its host may seat bots, and its roll question takes the commands of the dev panel (see `Host`)
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private game: Game | null = null;
  private idleDissolveAt = 0; // 0: somebody is connected
  private lifetimeExpiresAt = 0; // absolute lifetime: reconnecting or playing again never extends it
  private stageExpiresAt = 0; // 0 during a game
  private queuedEventJson: string[] = [];
  private nextAllowedMessageAt = new WeakMap<Seat, number>(); // kept in memory only (see `isRateLimited`)
  private lastSavedRoomJson = ''; // under the 'room' key
  private lastSavedCheckpoint?: TurnCheckpoint; // under the 'ckpt' key
  private alarmAt = Infinity; // what the alarm is set to (Infinity: none): it is only ever moved sooner, see `save`

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
    this.alarmAt = (await this.ctx.storage.getAlarm()) ?? Infinity; // the alarm that was left set (see `save`): a deadline that it covers does not set it again
    try {
      const { game, ...room }: Stored = JSON.parse(json);
      if (room.dev && !DEV_ROOMS) return this.dissolve(); // a dev room that storage holds from before they were shut off in production: it ends here
      this.lastSavedRoomJson = json;
      Object.assign(this, room);
      const now = Date.now();
      this.lifetimeExpiresAt ||= now + LIFE_MS; // old rooms have no creation time: grant one bounded lifetime on their first wake
      if (!game) this.stageExpiresAt ||= now + LOBBY_MS;
      if (this.expired(now)) return this.dissolve(); // reclaim a stale code even when a create RPC, rather than its alarm, wakes it
      if (game) {
        const checkpoint: TurnCheckpoint = JSON.parse(this.ctx.storage.kv.get<string>('ckpt')!);
        let g = (this.game = new Game(this, (this.lastSavedCheckpoint = checkpoint)));
        try { await g.resume(game); } catch (err) { // the code plays the turn differently than it was played (game.ts was edited under it): the room is not lost for that, the turn starts over from its checkpoint
          console.warn('replay failed, the turn starts over', err);
          g = this.game = new Game(this, checkpoint);
          this.seats.forEach((s) => this.snapshot(s)); // whoever is still connected saw the turn go on: back to where it began (the events of the new run follow)
          g.run(true).catch((e) => console.error('game crashed', e));
        }
        for (const s of this.seats) if (s.left) g.forfeit(s.playerIndex);
        for (const player of game.concededPlayers ?? []) g.concede(player); // declared bankruptcy mid-turn before the restart: out again, for the tape never said so
      }
      if (!this.anyOnline()) this.presence(); // the connections are gone (a restart cuts them): nobody can be waited for
      this.save(); // presence and legacy deadline migration must survive another eviction, including a rejected create RPC
    } catch (err) {
      console.error('room lost', err);
      this.dissolve();
    }
  }

  /**
   * Write the room down, and see that the alarm is set for the first deadline there is. Called wherever something may have changed: a write costs, so what is the same as stored is not written.
   * The alarm is only ever moved sooner. A deadline that comes later than the alarm waits for it: it goes off early, finds nothing due, and `alarm` sets it for the next. So each question
   * that is asked after another one costs no write for its clock. And an alarm that nothing waits for any more is left to go off: that is cheaper than taking it back.
   */
  save() {
    if (!this.code) return; // dissolved: nothing is kept
    if (this.game?.S.over) this.stageExpiresAt ||= Date.now() + OVER_MS;
    const { code, hostPlayerId, dev, settings, idleDissolveAt, lifetimeExpiresAt, stageExpiresAt, seats } = this, saved = this.game?.saved;
    if (saved && saved.checkpoint !== this.lastSavedCheckpoint) this.ctx.storage.kv.put('ckpt', JSON.stringify((this.lastSavedCheckpoint = saved.checkpoint))); // a checkpoint is never changed, only replaced (see `Game.mark`): it is written when it is a new one
    const json = JSON.stringify({ code, hostPlayerId, dev, settings, idleDissolveAt, lifetimeExpiresAt, stageExpiresAt, seats, game: saved && { tape: saved.tape, deadlineAt: saved.deadlineAt, consecutiveTimeouts: saved.consecutiveTimeouts, pausedAt: saved.pausedAt, concededPlayers: saved.concededPlayers } } satisfies Stored);
    if (json !== this.lastSavedRoomJson) this.ctx.storage.kv.put('room', (this.lastSavedRoomJson = json));
    const at = Math.min(lifetimeExpiresAt, ...[idleDissolveAt, stageExpiresAt, this.game?.pausedAt ? 0 : this.game?.deadlineAt ?? 0, ...seats.map((s) => s.dropSeatAt)].filter(Boolean)); // every stored room has a finite alarm, even if a deploy cuts all sockets without a close event; a paused game's frozen deadline is none
    if (at >= this.alarmAt) return;
    void this.ctx.storage.setAlarm((this.alarmAt = at));
  }

  /** Claim a code for a new room: false when it is taken. Nothing is stored yet: the `fetch` that seats its creator follows, and saves once (a creator who never comes leaves nothing in storage, and no alarm). */
  create(code: string, dev: boolean) {
    if (this.code) return false;
    this.code = code;
    this.dev = dev && DEV_ROOMS;
    const now = Date.now();
    this.idleDissolveAt = now + IDLE_MS; // nobody is connected yet: if nobody comes, the room must not stay for ever
    this.lifetimeExpiresAt = now + LIFE_MS;
    this.stageExpiresAt = now + LOBBY_MS;
    return true;
  }

  async fetch(req: Request): Promise<Response> {
    const q = new URL(req.url).searchParams, playerId = q.get('pid') ?? '';
    for (const old of this.conns(playerId)) old.close(WS_CLOSE_REPLACED, 'replaced'); // the new connection of a player replaces their old one
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [playerId.slice(0, 64)]); // the connection is tagged with its player's id (cut short, so that a bad one is turned away by `join` instead of throwing here)
    this.join(server, playerId, q.get('name') ?? '');
    this.save();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- Events from the runtime ----
  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const s = this.seatOf(ws);
    if (s) this.onMessage(ws, s, raw); // what a message changes is written by what changes it (`changed`, or the game when it waits again): one that changes nothing writes nothing
  }
  webSocketClose(ws: WebSocket, code: number) { this.onClose(ws, code); }
  webSocketError(ws: WebSocket) { this.onClose(ws, 1006); }

  private expired(now: number) { return [this.idleDissolveAt, this.lifetimeExpiresAt, this.stageExpiresAt].some((at) => at > 0 && at <= now); }

  /** A deadline has come: the room's lifetime or inactivity limit, a vanished player's seat, or a question waiting for an answer. */
  alarm() {
    this.alarmAt = Infinity; // spent
    const now = Date.now();
    if (this.expired(now)) return this.dissolve();
    this.seats.filter((s) => s.dropSeatAt && s.dropSeatAt <= now).forEach((s) => this.leave(s));
    if (!this.game?.tick(now)) this.save(); // a question that answers itself is written by the game when it waits again, as one that was answered is
  }

  // ---- Host (what the game needs of its room) ----
  emit(ev: Ev) {
    if (!this.queuedEventJson.length) queueMicrotask(() => this.flush());
    this.queuedEventJson.push(JSON.stringify(ev));
  }
  online(player: number) { return this.seats.some((s) => s.playerIndex === player && this.isSeatOnline(s)); }
  bot(player: number) { return this.seats.some((s) => s.playerIndex === player && s.bot); }
  anyOnline() { return this.seats.some((s) => !s.bot && this.isSeatOnline(s)); } // people only: bots watch nothing, and keep no room alive

  // ---- Wire ----
  private conns(playerId?: string) { return this.ctx.getWebSockets(playerId).filter((w) => w.readyState === WebSocket.OPEN); } // a closing one may still be listed
  private isSeatOnline(seat: Seat) { return !!seat.bot || this.conns(seat.playerId).length > 0; }
  private seatOf(ws: WebSocket) { const [playerId] = this.ctx.getTags(ws); return this.seats.find((s) => s.playerId === playerId); }
  private send(seat: Seat, msg: S2C | string) {
    const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const w of this.conns(seat.playerId)) {
      try { w.send(raw); } catch { /* the socket is closing: its close event follows */ }
    }
  }
  private flush() {
    if (!this.queuedEventJson.length) return;
    const msg = `{"t":"ev","ev":[${this.queuedEventJson.join(',')}]}`;
    this.queuedEventJson = [];
    this.seats.forEach((s) => this.send(s, msg));
  }
  private info(seat: Seat): RoomInfo {
    return {
      code: this.code, settings: this.settings, started: !!this.game, mySeat: seat.seat, dev: this.dev,
      seats: [...this.seats].sort((a, b) => a.seat - b.seat).map((x) => ({ seat: x.seat, name: x.name, online: this.isSeatOnline(x), host: x.playerId === this.hostPlayerId, bot: !!x.bot, playerIndex: x.playerIndex })),
    };
  }
  private broadcastRoom() { this.seats.forEach((s) => this.send(s, { t: 'room', room: this.info(s) })); }
  /** A seat or the settings changed: tell the room, and write it down. */
  private changed() { this.broadcastRoom(); this.save(); }
  /** Where the game stands, for a client with nothing to go by: one that joined or came back, or one whose turn has just started over (see `restore`). */
  private snapshot(seat: Seat) { if (this.game) this.send(seat, { t: 'game', myPlayer: seat.playerIndex, state: this.game.S, openAsk: this.game.openAskEvent, paused: !!this.game.pausedAt }); }
  private fail(ws: WebSocket, reason: Fail) {
    ws.send(JSON.stringify({ t: 'fail', reason } satisfies S2C));
    ws.close(1000, reason);
  }

  // ---- Seats ----
  private join(ws: WebSocket, playerId: string, name: string) {
    if (!this.code) return this.fail(ws, 'no-room');
    if (!PLAYER_ID_RE.test(playerId)) return ws.close(1008, 'bad id');
    let s = this.seats.find((x) => x.playerId === playerId);
    if (s?.left || (!s && this.game)) return this.fail(ws, 'started');
    if (!s) {
      if (this.seats.length >= MAX_PLAYERS) return this.fail(ws, 'full');
      const seat = PLAYER_DEFS.findIndex((_, k) => !this.seats.some((x) => x.seat === k));
      s = { playerId, seat, name: cleanName(name, seat), playerIndex: -1, left: false, dropSeatAt: 0 };
      this.seats.push(s);
      if (!this.hostPlayerId) this.hostPlayerId = playerId;
    }
    this.flush(); // what the others have been told is what the snapshot below contains
    this.presence();
    this.snapshot(s);
  }

  private onClose(ws: WebSocket, code: number) {
    const s = this.seatOf(ws);
    if (s && !s.left && !this.isSeatOnline(s)) { // not a seat that has left already, nor a connection that a newer one of the same player replaced
      if (code === WS_CLOSE_LEAVE) this.leave(s); else this.presence();
    }
    this.save();
  }

  // The player is gone for good: their seat is freed, or in a running game they forfeit.
  private leave(seat: Seat) {
    seat.dropSeatAt = 0;
    if (this.game) { seat.left = true; this.game.forfeit(seat.playerIndex); } else this.seats = this.seats.filter((x) => x !== seat);
    if (this.hostPlayerId === seat.playerId) this.hostPlayerId = this.seats.find((x) => !x.left && !x.bot)?.playerId ?? '';
    if (this.seats.every((x) => x.left || x.bot)) return this.dissolve(); // only bots are left: nobody to play for
    this.presence();
  }

  /** Somebody connected or vanished: tell the room, and set the clocks of whatever waits for a player (the open question, a lobby seat, the room itself). */
  private presence() {
    this.broadcastRoom();
    this.game?.presence();
    const now = Date.now();
    for (const s of this.seats) {
      if (this.isSeatOnline(s)) s.dropSeatAt = 0;
      else if (!this.game) s.dropSeatAt ||= now + SEAT_GRACE_MS;
    }
    this.idleDissolveAt = this.anyOnline() ? 0 : this.idleDissolveAt || now + IDLE_MS;
  }

  /** The room ends: nothing of it is kept. */
  private dissolve() {
    this.game?.dispose();
    this.conns().forEach((w) => w.close(1000, 'room closed'));
    this.seats = [];
    this.game = null;
    this.queuedEventJson = [];
    this.hostPlayerId = '';
    this.dev = false;
    this.settings = { ...DEFAULT_SETTINGS };
    this.code = '';
    this.idleDissolveAt = 0;
    this.lifetimeExpiresAt = this.stageExpiresAt = 0;
    this.lastSavedRoomJson = '';
    this.lastSavedCheckpoint = undefined;
    this.alarmAt = Infinity; // `deleteAll` takes the alarm with it
    void this.ctx.storage.deleteAll();
  }

  // ---- Messages ----
  /** Is this seat sending `name`, `settings` or `bot` faster than the pace allows? Each message makes the whole room a broadcast. A seat may run BURST_MS ahead of its pace; a message dropped for being over is not charged. */
  private isRateLimited(seat: Seat) {
    const now = Date.now(), due = Math.max(this.nextAllowedMessageAt.get(seat) ?? 0, now);
    if (due - now > BURST_MS) return true;
    this.nextAllowedMessageAt.set(seat, due + RATE_MS);
    return false;
  }

  private onMessage(ws: WebSocket, seat: Seat, raw: string | ArrayBuffer) {
    if ((typeof raw === 'string' ? raw.length : raw.byteLength) > FRAME_MAX) return ws.close(1009, 'too big');
    let msg: C2S;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if ((msg.t === 'name' || msg.t === 'settings' || msg.t === 'bot') && this.isRateLimited(seat)) return ws.close(1008, 'too fast');
    const isHost = seat.playerId === this.hostPlayerId;
    switch (msg.t) {
      case 'name':
        if (this.game || typeof msg.name !== 'string') return;
        seat.name = cleanName(msg.name, seat.seat);
        this.changed();
        break;
      case 'settings': {
        const { mode, rounds } = msg.settings ?? {};
        if (this.game || !isHost || (mode !== 'limited' && mode !== 'endless') || !Number.isInteger(rounds) || rounds < ROUNDS_MIN || rounds > ROUNDS_MAX) return;
        this.settings = { mode, rounds };
        this.changed();
        break;
      }
      case 'bot': {
        const { seat: seatIndex } = msg, occupant = this.seats.find((x) => x.seat === seatIndex);
        if (!this.dev || this.game || !isHost || !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MAX_PLAYERS || (occupant && !occupant.bot)) return;
        if (occupant) this.seats = this.seats.filter((x) => x !== occupant);
        else this.seats.push({ playerId: crypto.randomUUID(), seat: seatIndex, name: `Bot ${PLAYER_DEFS[seatIndex].name}`, playerIndex: -1, left: false, dropSeatAt: 0, bot: true }); // the id is nobody's to guess: no connection can take the seat over
        this.changed();
        break;
      }
      case 'start': if (!this.game && isHost && this.seats.length >= 2) this.start(); break;
      case 'answer': if (this.game && seat.playerIndex >= 0) this.game.answer(seat.playerIndex, msg.id, msg.value); break;
      case 'bankrupt': if (this.game && seat.playerIndex >= 0) this.game.concede(seat.playerIndex); break;
      case 'pause': if (this.dev && isHost && typeof msg.paused === 'boolean') this.game?.setPaused(msg.paused); break;
      case 'again': if (this.game?.S.over) this.reset(); break;
    }
  }

  private start() {
    this.stageExpiresAt = 0;
    [...this.seats].sort((a, b) => a.seat - b.seat).forEach((s, i) => (s.playerIndex = i));
    const players = [...this.seats].sort((a, b) => a.playerIndex - b.playerIndex).map((s) => ({ name: s.name, color: PLAYER_DEFS[s.seat].color }));
    this.game = new Game(this, fresh(players, this.settings));
    this.broadcastRoom(); // not `changed`: the game asks its first question as `run` begins, and that writes the room
    this.game.run().catch((err) => console.error('game crashed', err));
  }

  // After a game: back to the lobby with whoever is still here. The finished game's history goes.
  private reset() {
    this.game?.dispose();
    this.game = null;
    this.queuedEventJson = [];
    this.seats = this.seats.filter((s) => !s.left && this.isSeatOnline(s));
    this.seats.forEach((s) => (s.playerIndex = -1));
    if (!this.seats.some((s) => s.playerId === this.hostPlayerId)) this.hostPlayerId = this.seats.find((s) => !s.bot)?.playerId ?? '';
    if (!this.hostPlayerId) return this.dissolve(); // nobody but bots
    this.stageExpiresAt = Date.now() + LOBBY_MS;
    this.changed();
  }
}
