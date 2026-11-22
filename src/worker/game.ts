import { DEPOSIT_MAX_ROUNDS, DEPOSIT_MIN_ROUNDS, DEPOSIT_STEP, START_CASH, TILES, TILE_COUNT, cityRent, depositInterest, kindAt, maxLevel, tileAt, type Tile } from '../shared/data';
import { B, P, T, m, money } from '../shared/msg';
import { apply, canMortgage, canPick, command, hasMonopoly, lotValue, maxRounds, ranking } from '../shared/state';
import type { Answer, Block, CasinoRoll, Cmd, Ev, GameState, Msg, Notice, OrderPass, Owned, PickItem, Prompt, Settings, Tone } from '../shared/types';
import { NEWS } from './news';

const JAIL = kindAt('jail');
const TAXES = TILES.flatMap((t, i) => (t.kind === 'tax' ? [i] : []));
const JERU = tileAt('Jerusalem');
const VEGAS = tileAt('Las Vegas');
const PROMPT_TIMEOUT_MS = 60_000;
const OFFLINE_PROMPT_TIMEOUT_MS = 8_000; // long enough to reload the page
const BOT_REPLY_DELAY_MS = 300;
const MAX_CONSECUTIVE_TIMEOUTS = 20; // nobody is playing (an open tab alone keeps the room up), so the game ends

export interface Host {
  emit(ev: Ev): void; // tell every client
  online(player: number): boolean;
  bot(player: number): boolean; // a bot is not waited for: it takes the default answer after BOT_REPLY_DELAY_MS
  anyOnline(): boolean;
  save(): void; // the game waits: write down where it stands
  readonly dev: boolean; // a dev room: its roll question also takes the commands of the dev panel
}
interface Pending { id: number; player: number; prompt: Prompt; askEvent: Ev; resolve(answer: Answer): void; deadlineAt: number; durationMs: number }
// What the next move of a player is bent by (news events). They never show: the news card said it.
export interface MoveMods { extraSteps: boolean; halfSteps: boolean; backward: boolean; blindDate: boolean }
const emptyMoveMods = (): MoveMods => ({ extraSteps: false, halfSteps: false, backward: false, blindDate: false });

// What a restart keeps of a game: how a turn began (a checkpoint), and what that turn has taken from outside since (the tape: its dice, and the answers it was given).
interface TapeEntry { kind: string; value: unknown } // kind: 'rnd' or the kind of prompt answered
export interface TurnCheckpoint { S: GameState; moveMods: MoveMods[]; nextAskId: number; forfeitedPlayers: number[]; turnIndex: number; round: number; riggedDraws: number[] }
export interface Saved { checkpoint: TurnCheckpoint; tape: TapeEntry[]; deadlineAt: number; consecutiveTimeouts: number; pausedAt: number; concededPlayers?: number[] } // concededPlayers: a mid-turn bankruptcy is not on the tape: it was no input the game asked for

/** The game before its first turn. */
export const fresh = (players: { name: string; color: number }[], settings: Settings): TurnCheckpoint => ({
  S: {
    settings, ownedByTile: {}, turnOrder: players.map((_, i) => i), turnIndex: 0, round: 1, step: null, bankruptOrder: [], over: false, log: [],
    players: players.map((p) => ({ ...p, cash: START_CASH, deposit: null, tile: 0, jail: false, party: false, stay: false, bankruptRound: 0 })),
  },
  moveMods: players.map(emptyMoveMods), nextAskId: 1, forfeitedPlayers: [], turnIndex: 0, round: 1, riggedDraws: [],
});

const note = (...a: Msg): Block => ({ k: 'note', message: a });
const tiles = (sel: number[]): Msg => sel.flatMap((i, k) => (k ? [', ', T(i)] : [T(i)]));

// What a player who does not answer in time gets.
function fallback(p: Prompt): Answer {
  switch (p.k) {
    case 'roll': return true;
    case 'pick': {
      if (p.skip) return null;
      if (p.rule.k !== 'raise') return p.items.slice(0, 1).map((x) => x.index);
      let need = p.rule.need - p.rule.cash; // the fewest properties that raise enough
      const sel: number[] = [];
      for (const x of [...p.items].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))) { if (need <= 0) break; sel.push(x.index); need -= x.amount ?? 0; }
      return sel;
    }
    case 'dep': return null; // the offer lapses: no deposit is placed
    case 'casino': return p.view.stage === 'bet' ? { act: 'roll', bet: p.view.bet, pickedNumber: 6 } : { act: 'cash' };
    default: return false; // deed, confirm, news
  }
}

// An answer from a client is only taken if it fits the question.
function check(p: Prompt, v: unknown): Answer | undefined {
  switch (p.k) {
    case 'roll': return v === true ? true : undefined;
    case 'deed': case 'confirm': case 'news': return typeof v === 'boolean' ? v : undefined;
    case 'pick': {
      if (v === null) return p.skip ? null : undefined;
      if (!Array.isArray(v) || new Set(v).size !== v.length) return undefined;
      const by = new Map(p.items.map((x) => [x.index, x.amount ?? 0]));
      if (!v.every((i) => by.has(i))) return undefined;
      const sum = v.reduce((s: number, i: number) => s + (by.get(i) ?? 0), 0), r = p.rule;
      return canPick(r, v.length, sum) ? (v as number[]) : undefined;
    }
    case 'dep': {
      if (v === null) return null;
      const d = v as { principal?: unknown; termRounds?: unknown } | null;
      if (!d || typeof d !== 'object') return undefined;
      const ok = Number.isInteger(d.principal) && (d.principal as number) % DEPOSIT_STEP === 0 && (d.principal as number) >= DEPOSIT_STEP && (d.principal as number) <= p.maxPrincipal && Number.isInteger(d.termRounds) && (d.termRounds as number) >= DEPOSIT_MIN_ROUNDS && (d.termRounds as number) <= DEPOSIT_MAX_ROUNDS;
      return ok ? { principal: d.principal as number, termRounds: d.termRounds as number } : undefined;
    }
    case 'casino': {
      const a = v as { act?: unknown; bet?: unknown; pickedNumber?: unknown } | null;
      if (!a || typeof a !== 'object') return undefined;
      if (a.act === 'cash') return p.view.stage === 'again' ? { act: 'cash' } : undefined;
      if (a.act !== 'roll') return undefined;
      const bet = a.bet, lucky = p.view.variant === 'lucky', pickedNumber = a.pickedNumber;
      if (typeof bet !== 'number' || !Number.isInteger(bet) || bet % 100 !== 0 || bet < (lucky ? 100 : 200) || bet > p.view.maxBet) return undefined;
      return lucky ? (typeof pickedNumber === 'number' && Number.isInteger(pickedNumber) && pickedNumber >= 1 && pickedNumber <= 6 ? { act: 'roll', bet, pickedNumber } : undefined) : { act: 'roll', bet };
    }
  }
}

export class Game {
  readonly S: GameState;
  moveMods: MoveMods[];
  extraTurn = false;
  passedPlayers = new Set<number>();
  private riggedDraws: number[] = [];
  private nextAskId: number;
  private pending: Pending | null = null;
  private forfeitedPlayers: Set<number>;
  private concededPlayers = new Set<number>();
  private turnTape: TapeEntry[] = [];
  private replayTape: TapeEntry[] | null = null; // null once the game is live
  private restoredDeadlineAt = 0;
  private consecutiveTimeouts = 0;
  pausedAt = 0; // a dev room's pause: the epoch ms the game froze at. While set, no question's clock runs (answers are still taken) and a pending `deadlineAt` keeps its frozen deadline
  private onReplayCaughtUp?: () => void;

  /** A game standing at a checkpoint: a new one (`fresh`), or the one a restart found. */
  constructor(private host: Host, private checkpoint: TurnCheckpoint) {
    this.S = structuredClone(checkpoint.S);
    this.moveMods = structuredClone(checkpoint.moveMods);
    this.nextAskId = checkpoint.nextAskId;
    this.forfeitedPlayers = new Set(checkpoint.forfeitedPlayers);
    this.riggedDraws = [...(checkpoint.riggedDraws ?? [])]; // a game saved before the dev panel has none
  }

  /** The ask a reconnecting client still has to see. */
  get openAskEvent() { return this.pending?.askEvent ?? null; }
  get deadlineAt() { return this.pending?.deadlineAt ?? 0; }
  /** What a restart needs to bring the game back. */
  get saved(): Saved { return { checkpoint: this.checkpoint, tape: this.turnTape, deadlineAt: this.deadlineAt, consecutiveTimeouts: this.consecutiveTimeouts, pausedAt: this.pausedAt, concededPlayers: [...this.concededPlayers] }; }

  // ---- Chance and the tape ----
  // The game is a chain of awaits, which a restart cannot carry over. A turn can be played again though: from its checkpoint, fed from the tape instead of the dice and the
  // players, it ends up where it stood. That holds while everything a turn takes from outside comes through `rnd` and `ask`, and while the clients hear nothing of the replay.
  private next(kind: string): TapeEntry | undefined {
    const e = this.replayTape?.shift();
    if (e) {
      if (e.kind !== kind) throw new Error(`the tape has ${e.kind} where the game wants ${kind}`);
      this.turnTape.push(e);
      return e;
    }
    if (this.replayTape) { this.replayTape = null; this.onReplayCaughtUp?.(); } // the tape is spent: live from here
  }
  /** 1..max */
  rnd(max: number): number {
    const e = this.next('rnd'), rigged = this.riggedDraws.shift(); // a draw of the replay takes its turn in the queue too, so the queue stands where it stood
    if (e) return e.value as number;
    const v = Math.min(max, rigged ?? 1 + Math.floor(Math.random() * max));
    this.turnTape.push({ kind: 'rnd', value: v });
    return v;
  }
  d6() { return this.rnd(6); }
  pick<T>(a: readonly T[]): T { return a[this.rnd(a.length) - 1]; }
  coin() { return this.rnd(2) === 1; }

  // ---- Events ----
  emit(ev: Ev) { apply(this.S, ev); if (!this.replayTape) this.host.emit(ev); } // an event of the replay is no news to the clients
  log(msg: Msg) { this.emit({ t: 'log', message: msg }); }
  toast(msg: Msg | string, tone: Tone = '') { this.emit({ t: 'toast', message: typeof msg === 'string' ? [msg] : msg, tone }); }
  notice(notice: Notice) { this.emit({ t: 'notice', notice }); }
  /** The one place a player's cash changes: the log says by how much, and what for. */
  cash(player: number, delta: number, reason: Msg | string) {
    if (!delta) return;
    this.emit({ t: 'cash', player, delta });
    this.log(m`${P(player)} ${(delta > 0 ? '+' : '') + money(delta)} · ${reason}`);
  }
  /** Money from one player to another: the same two cash events, but a single log line that names both. `paid` is what the payer's event reports. */
  private xfer(from: number, to: number, amount: number, reason: Msg | string, paid = amount) {
    if (paid) this.emit({ t: 'cash', player: from, delta: -paid });
    this.emit({ t: 'cash', player: to, delta: amount });
    this.log(m`${P(from)} paid ${P(to)} ${money(amount)} · ${reason}`);
  }
  own(tile: number, owned: Owned | null) { this.emit({ t: 'own', tile, owned }); }
  move(player: number, to: number, how: 'hop' | 'jump') { this.emit({ t: 'move', player, to, how }); }
  playerName(player: number) { return this.S.players[player].name; }

  // ---- Prompts ----
  ask(player: number, prompt: Prompt): Promise<Answer> {
    return new Promise((resolve) => {
      const id = this.nextAskId++, askEvent: Ev = { t: 'ask', id, player, prompt }, pend: Pending = { id, player, prompt, askEvent, resolve, deadlineAt: 0, durationMs: 0 }, replaying = !!this.replayTape;
      const past = this.next(prompt.k);
      if (past) return resolve(past.value as Answer);
      this.pending = pend;
      if (replaying) { pend.deadlineAt = this.restoredDeadlineAt; return; } // it was asked before the restart: the clients know, and its clock runs on
      this.emit(askEvent);
      if (this.forfeitedPlayers.has(player) || this.S.players[player].bankruptRound) return this.settle(pend, fallback(prompt)); // a gone or bankrupt player is never waited on: the default answer stands
      this.arm(pend);
      this.host.save();
    });
  }
  private settle(pend: Pending, answer: Answer) {
    if (this.pending !== pend) return;
    this.pending = null;
    this.turnTape.push({ kind: pend.prompt.k, value: answer });
    this.emit({ t: 'close', id: pend.id });
    pend.resolve(answer);
  }
  private arm(pend: Pending) {
    if (this.pausedAt) { this.emit({ t: 'clock', remainingMs: 0 }); return; } // frozen: whatever `deadlineAt` the question has (0 if it was asked in the freeze) is kept, to be moved forward on resume
    const bot = this.host.bot(pend.player), durationMs = this.host.anyOnline() ? (bot ? BOT_REPLY_DELAY_MS : this.host.online(pend.player) ? PROMPT_TIMEOUT_MS : OFFLINE_PROMPT_TIMEOUT_MS) : 0; // nobody is watching: the game waits
    pend.durationMs = durationMs;
    pend.deadlineAt = durationMs && Date.now() + durationMs;
    this.emit({ t: 'clock', remainingMs: bot ? 0 : durationMs }); // everybody sees the time left (a bot's beat is not worth a gauge)
  }
  answer(player: number, id: number, value: unknown) {
    const pend = this.pending;
    if (!pend || pend.id !== id || pend.player !== player) return;
    // A dev room's roll question also takes the panel's commands. One that makes no sense is an answer of nothing (false): the question is asked again, and the panel never ends up without it.
    const a = this.host.dev && pend.prompt.k === 'roll' && value !== true ? command(this.S, value) ?? false : check(pend.prompt, value);
    if (a === undefined) return;
    this.consecutiveTimeouts = 0;
    this.settle(pend, a);
  }
  /** Somebody connected or left: the clock on the open question runs differently now. */
  presence() { if (this.pending) this.arm(this.pending); }
  /** A dev room's pause: no question's clock runs and none is counted a lapse, but answers are still taken. On resume the pending deadline moves forward by the freeze; a question asked in the freeze gets its clock now. */
  setPaused(paused: boolean) {
    if (paused === !!this.pausedAt) return;
    if (paused) this.pausedAt = Date.now();
    else {
      const shift = Date.now() - this.pausedAt, pend = this.pending;
      this.pausedAt = 0;
      if (pend?.deadlineAt) { pend.deadlineAt += shift; this.emit({ t: 'clock', remainingMs: pend.deadlineAt - Date.now(), totalMs: pend.durationMs || undefined }); } // its clock picks up where it stood
      else if (pend) this.arm(pend); // asked in the freeze: it gets the clock its presence allows
    }
    this.emit({ t: 'paused', paused });
    this.host.save();
  }
  /** The clock of the open question may have run out: then the default answer is taken (true). */
  tick(now: number) {
    const pend = this.pending;
    if (this.pausedAt || !pend?.deadlineAt || pend.deadlineAt > now) return false;
    if (!this.host.bot(pend.player)) this.consecutiveTimeouts++;
    this.settle(pend, fallback(pend.prompt));
    return true;
  }
  forfeit(player: number) {
    this.forfeitedPlayers.add(player);
    if (this.pending?.player === player) this.settle(this.pending, fallback(this.pending.prompt));
  }
  /** A player still in the room declares bankruptcy (`forfeit` covers leaving). `concededPlayers` goes with the
   * save so a restart mid-turn puts them out again: the tape holds only what a turn took from outside, and this was no input the game asked for. */
  concede(player: number) {
    const p = this.S.players[player];
    if (p.bankruptRound || this.S.over) return;
    if (this.replayTape) { // the state is still being rebuilt from the tape and nothing outside it may change it: go out the moment it is caught up
      const up = this.onReplayCaughtUp;
      this.onReplayCaughtUp = () => { up?.(); this.concede(player); };
      return;
    }
    this.concededPlayers.add(player);
    this.toast(`${p.name} declared bankruptcy`, 'bad');
    this.goBankrupt(player);
    if (this.pending?.player === player) this.settle(this.pending, fallback(this.pending.prompt));
    this.host.save();
  }
  dispose() { this.pending = null; }

  // ---- Who is who ----
  alive() { return this.S.turnOrder.filter((i) => !this.S.players[i].bankruptRound); }
  over() { return this.alive().length <= 1; }
  collects(player: number) { return !this.S.players[player].jail; }
  /** Working (not mortgaged) tiles of a kind that a player owns. */
  count(player: number, kind: string) { return Object.keys(this.S.ownedByTile).filter((k) => this.S.ownedByTile[+k].owner === player && !this.S.ownedByTile[+k].mortgaged && TILES[+k].kind === kind).length; }
  owned(player: number, types: string[]) { return Object.keys(this.S.ownedByTile).filter((k) => this.S.ownedByTile[+k].owner === player && types.includes(TILES[+k].type)).length; }
  /** Players with a working tile of any of these kinds, in turn order. */
  owners(kinds: string[]) { return this.alive().filter((player) => kinds.some((k) => this.count(player, k))); }
  private activeLotByName(name: string) { const o = this.S.ownedByTile[tileAt(name)]; return o && !o.mortgaged ? o : null; }
  activeLotOwnedBy(player: number, name: string) { const o = this.activeLotByName(name); return o?.owner === player ? o : null; }
  /** The player nearest to `player` ahead (dir 1) or behind (dir -1) on the loop; a shared tile counts as a full lap. -1 for nobody. */
  nearest(player: number, dir: 1 | -1) {
    const at = this.S.players[player].tile, gap = (o: number) => ((((this.S.players[o].tile - at) * dir) % TILE_COUNT) + TILE_COUNT) % TILE_COUNT || TILE_COUNT;
    return this.alive().filter((o) => o !== player).sort((a, b) => gap(a) - gap(b))[0] ?? -1;
  }
  /** The tiles a player may mortgage (regular and special cities, none already mortgaged), each with what it pays at `rate`. */
  private mortgageable(player: number, rate: number): PickItem[] {
    return Object.keys(this.S.ownedByTile).map(Number)
      .filter((i) => this.S.ownedByTile[i].owner === player && !this.S.ownedByTile[i].mortgaged && canMortgage(TILES[i]))
      .map((i) => ({ index: i, level: this.S.ownedByTile[i].level, amount: Math.floor(lotValue(TILES[i], this.S.ownedByTile[i]) * rate) }));
  }

  // ---- Money ----
  /** Money from the bank: Zurich takes its cut. */
  give(player: number, amount: number, reason: Msg | string, bank = true) {
    if (amount <= 0 || this.S.players[player].bankruptRound) return;
    this.cash(player, amount, reason);
    if (bank) this.bonus('Zurich', [100, 200, 300], m`${P(player)} got money from the bank`, false);
  }
  /** A special tile pays its owner by level, for what `reason` says somebody did. */
  private bonus(name: string, vals: number[], reason: Msg, bank = true) {
    const o = this.activeLotByName(name), i = tileAt(name);
    if (!o || !this.collects(o.owner)) return;
    this.toast(m`${T(i)}: ${this.playerName(o.owner)} earns ${money(vals[o.level])}`, 'good');
    this.give(o.owner, vals[o.level], m`${T(i, true)}: ${reason}`, bank);
  }
  /** Take `amount` from a player for the bank or for `to`. False when they went bankrupt instead. */
  async pay(player: number, amount: number, reason: Msg | string, to: number | null = null): Promise<boolean> {
    const S = this.S, p = S.players[player];
    if (amount <= 0) return true;
    if (p.bankruptRound) return false; // declared bankruptcy while a question stood: the estate already went to the bank
    if (p.cash < amount && p.deposit) {
      const d = p.deposit;
      this.emit({ t: 'dep', player, deposit: null });
      this.give(player, d.principal, m`withdrew a ${String(d.termRounds)}-round deposit early: no interest`);
      this.toast(`${p.name} withdrew a deposit early (no interest)`, 'bad');
    }
    if (p.cash < amount) {
      const had = p.cash, rest = amount - had, items = this.mortgageable(player, 0.5), raised = items.reduce((s, x) => s + (x.amount ?? 0), 0);
      if (had) { if (to === null || S.players[to].bankruptRound) this.cash(player, -had, m`${reason} (part)`); else this.xfer(player, to, had, m`${reason} (part)`); }
      if (raised < rest) {
        this.notice({ title: 'BANKRUPT!', sub: [p.name], tone: 0xb13e53, label: 'OH NO...', danger: true, body: [
          { k: 'face', player },
          note(`${p.name} owes ${money(amount)} but can only raise ${money(had + raised)} (cash + deposit + mortgage value). ${to !== null ? S.players[to].name + ' receives what can be raised.' : 'The bank takes everything.'}`)] });
        if (to !== null && raised) this.xfer(player, to, raised, m`${reason} (bankrupt)`, 0);
        this.goBankrupt(player);
        return false;
      }
      const forced = raised - Math.min(...items.map((x) => x.amount ?? 0)) < rest;
      if (forced) this.toast(`${p.name} must mortgage every property to pay ${money(rest)}`, 'bad');
      const sel = forced ? items.map((x) => x.index) : (await this.ask(player, { k: 'pick', of: 'tile', title: 'MORTGAGE TO PAY', sub: [`${p.name} owes ${money(rest)}`], tone: 0x3b7bd9,
        hint: 'You can\'t afford this. Mortgage properties to cover it: each pays half its lot value.', items, rule: { k: 'raise', cash: 0, need: rest }, label: 'MORTGAGE & PAY' })) as number[];
      if (p.bankruptRound) return false;
      this.mortgage(player, sel, 0.5);
      amount = rest;
    }
    if (to === null || S.players[to].bankruptRound) this.cash(player, -amount, reason);
    else this.xfer(player, to, amount, reason);
    return true;
  }
  private mortgage(player: number, sel: number[], rate: number) {
    let sum = 0;
    for (const i of sel) { sum += Math.floor(lotValue(TILES[i], this.S.ownedByTile[i]) * rate); this.own(i, { ...this.S.ownedByTile[i], mortgaged: true }); }
    this.cash(player, sum, m`mortgaged ${tiles(sel)}`);
  }
  private canDeposit(player: number) { const p = this.S.players[player]; return !p.deposit && p.cash >= DEPOSIT_STEP; }
  private async deposit(player: number, step?: string) {
    const S = this.S;
    if (!this.canDeposit(player)) return;
    const maxPrincipal = Math.floor(S.players[player].cash / DEPOSIT_STEP) * DEPOSIT_STEP;
    const d = (await this.ask(player, { k: 'dep', maxPrincipal, step })) as { principal: number; termRounds: number } | null;
    if (!d) return;
    this.emit({ t: 'dep', player, deposit: { principal: d.principal, termRounds: d.termRounds, placedRound: S.round } });
    this.cash(player, -d.principal, m`placed a ${String(d.termRounds)}-round fixed deposit`);
    this.toast(m`${P(player)} deposited ${money(d.principal)} for ${String(d.termRounds)} rounds`, 'good');
  }
  private goBankrupt(player: number) {
    for (const k of Object.keys(this.S.ownedByTile).map(Number)) if (this.S.ownedByTile[k].owner === player) this.own(k, null);
    if (this.S.players[player].deposit) this.emit({ t: 'dep', player, deposit: null });
    this.emit({ t: 'out', player });
    this.log(m`${P(player)} went bankrupt`);
  }
  lower(i: number) {
    const o = this.S.ownedByTile[i];
    if (!o || !o.level) return; // the lot left hands (its owner went bankrupt) since the choice was made
    this.own(i, { ...o, level: o.level - 1, upgradePaid: Math.max(0, (o.upgradePaid ?? o.level * TILES[i].upgradeCost) - TILES[i].upgradeCost) });
    this.log(m`${T(i, true)} was lowered to Lv ${String(o.level - 1)}`);
  }

  // ---- The game ----
  /** A turn begins: this is where a restart comes back to. */
  private mark(turnIndex: number, round: number) {
    this.checkpoint = structuredClone({ S: this.S, moveMods: this.moveMods, nextAskId: this.nextAskId, forfeitedPlayers: [...this.forfeitedPlayers], turnIndex, round, riggedDraws: this.riggedDraws });
    this.turnTape = [];
  }

  /** After a restart: play the turn in progress again from its checkpoint, fed from the tape. Resolves once it stands where it stood; rejects when the code no longer plays it the same way. */
  resume({ tape, deadlineAt, consecutiveTimeouts, pausedAt, concededPlayers }: Omit<Saved, 'checkpoint'>) {
    if (this.S.over) return Promise.resolve();
    return new Promise<void>((caughtUp, fail) => {
      this.replayTape = tape; this.restoredDeadlineAt = deadlineAt ?? 0; this.consecutiveTimeouts = consecutiveTimeouts ?? 0; this.pausedAt = pausedAt ?? 0; this.concededPlayers = new Set(concededPlayers ?? []); this.onReplayCaughtUp = caughtUp; // a game saved before the count (or before pausing, or before conceding) has none
      this.run(true).then(caughtUp, (err) => { if (this.replayTape) fail(err); else console.error('game crashed', err); });
    });
  }

  async run(resumed = false) {
    const S = this.S;
    if (!resumed) {
      this.emit({ t: 'start', state: structuredClone(S) });
      this.rollOrder();
      this.log(['Game started. Good luck!']);
    }
    let { turnIndex, round } = this.checkpoint;
    for (;;) {
      const player = S.turnOrder[turnIndex];
      do {
        this.extraTurn = false;
        if (resumed) resumed = false; else this.mark(turnIndex, round); // a resumed run begins in a turn that is marked already
        this.emit({ t: 'turn', turnIndex, round });
        await this.play(player);
        if (this.replayTape) throw new Error('the turn ended before its tape did'); // the code plays it differently than it was played
      } while (this.extraTurn && !this.over() && !S.players[player].bankruptRound);
      if (this.over() || this.consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) break;
      do { if (++turnIndex >= S.turnOrder.length) { turnIndex = 0; round++; } } while (S.players[S.turnOrder[turnIndex]].bankruptRound);
      if (round > maxRounds(S)) break;
    }
    this.emit({ t: 'over', rank: ranking(S) });
    this.mark(turnIndex, round); // the finished game is what a restart finds
    this.host.save();
  }

  private rollOrder() {
    const passes: OrderPass[] = [], order: number[] = [];
    const settle = (group: number[]) => {
      const rolls = group.map((): [number, number] => [this.d6(), this.d6()]), by = new Map<number, number[]>();
      passes.push({ group, rolls });
      group.forEach((p, k) => { const t = rolls[k][0] + rolls[k][1]; by.set(t, [...(by.get(t) ?? []), p]); });
      for (const t of [...by.keys()].sort((a, b) => a - b)) { const g = by.get(t) ?? []; if (g.length === 1) order.push(g[0]); else settle(g); }
    };
    settle(this.alive());
    this.emit({ t: 'order', passes, order });
  }

  private async play(player: number) {
    const S = this.S, p = S.players[player];
    this.log(m`${P(player)}'s turn`);
    if (this.forfeitedPlayers.has(player)) { this.toast(`${p.name} left the game`, 'bad'); this.goBankrupt(player); return; }
    if (p.deposit && S.round >= p.deposit.placedRound + p.deposit.termRounds) { // a fixed deposit that ran its term pays out even on a skipped turn
      const d = p.deposit, interest = depositInterest(d.principal, d.termRounds);
      this.emit({ t: 'dep', player, deposit: null });
      this.give(player, d.principal + interest, m`${String(d.termRounds)}-round deposit matured (${money(d.principal)} + ${money(interest)} interest)`);
      this.toast(m`${P(player)}'s deposit matured: +${money(d.principal + interest)}`, 'good');
    }
    if (p.jail || p.party || p.stay) {
      this.emit({ t: 'skip', player, message: [`${p.name} ${p.jail ? 'is in jail' : p.party ? 'is partying' : 'is held up'}: turn skipped`] });
      for (const flag of ['jail', 'party', 'stay'] as const) if (p[flag]) this.emit({ t: 'flag', player, flag, active: false });
      return;
    }
    // 1. Redeem
    this.emit({ t: 'step', step: 'redeem' });
    const mortgagedTiles = Object.keys(S.ownedByTile).map(Number).filter((i) => S.ownedByTile[i].owner === player && S.ownedByTile[i].mortgaged);
    if (mortgagedTiles.length && p.cash >= Math.min(...mortgagedTiles.map((i) => lotValue(TILES[i], S.ownedByTile[i])))) {
      const sel = (await this.ask(player, { k: 'pick', of: 'tile', title: 'REDEEM PROPERTIES?', sub: [`${p.name} · optional`], tone: 0x2d7d6f,
        hint: 'Pay the full lot value to bring a property back to life. Skipping is fine.', items: mortgagedTiles.map((i) => ({ index: i, amount: lotValue(TILES[i], S.ownedByTile[i]) })), rule: { k: 'redeem', cash: p.cash }, label: 'REDEEM', skip: 'SKIP' })) as number[] | null;
      if (sel?.length) { for (const i of sel) this.own(i, { ...S.ownedByTile[i], mortgaged: false }); this.cash(player, -sel.reduce((s, i) => s + lotValue(TILES[i], S.ownedByTile[i]), 0), m`redeemed ${tiles(sel)}`); }
    }
    // 2. Roll (in a dev room the question may be answered with a command of the panel instead: it runs, and the question is asked again)
    for (let doubles = 0; ;) {
      this.emit({ t: 'step', step: 'roll' });
      for (let go = await this.ask(player, { k: 'roll' }); go !== true; go = await this.ask(player, { k: 'roll' })) if (go && (await this.debug(go as Cmd))) return;
      if (p.bankruptRound) return; // declared bankruptcy while the question stood
      const dieA = this.d6(), dieB = this.d6(), isDoubles = dieA === dieB;
      this.emit({ t: 'dice', dieA, dieB });
      if (isDoubles) {
        this.bonus('Rio', [200, 500, 1000], m`${P(player)} rolled doubles`);
        if (++doubles === 3) {
          this.toast(`${p.name} rolled doubles 3 times!`, 'bad');
          this.log(m`${P(player)} rolled doubles 3 times`);
          this.emit({ t: 'step', step: 'resolve' });
          await this.sendToJail(player);
          return;
        }
      }
      // 3. Move and 4. resolve the tile
      this.emit({ t: 'step', step: 'move' });
      await this.walk(player, dieA + dieB);
      if (p.bankruptRound || this.over()) return;
      this.emit({ t: 'step', step: 'resolve' });
      await this.landOn(player, p.tile);
      if (!isDoubles || p.bankruptRound || this.over() || p.jail || p.party || p.stay) return;
      this.toast(`${p.name} rolled doubles: roll again!`, 'good');
    }
  }

  /** A command of the dev panel, which came as the answer to the roll question. It is an input like the dice and the answers: it is on the tape and plays again after a restart, and the clients hear it in order, so neither needs anything of its own. True when it played the turn out, in the roll's place. */
  private async debug(c: Cmd): Promise<boolean> {
    switch (c.c) {
      case 'draw': this.riggedDraws = [...c.draws]; this.toast(`DEV: next draws ${c.draws.join(', ') || 'by chance'}`); break; // a copy: the tape keeps the command as it came
      case 'cash': this.cash(c.player, c.cash - this.S.players[c.player].cash, 'DEV: set cash'); break;
      case 'own': this.own(c.tile, c.owned); break;
      case 'goto':
        if (c.resolveLanding) this.emit({ t: 'step', step: 'resolve' });
        this.move(c.player, c.tile, 'jump');
        if (c.resolveLanding) await this.landOn(c.player, c.tile);
        return c.resolveLanding;
    }
    return false;
  }

  private async walk(player: number, total: number) {
    const S = this.S, p = S.players[player], moveMods = this.moveMods[player], backward = moveMods.backward;
    const steps = Math.ceil((total + (moveMods.extraSteps ? 3 : 0)) / (moveMods.halfSteps ? 2 : 1));
    this.moveMods[player] = emptyMoveMods(); // used up
    this.passedPlayers.clear();
    for (let k = 1; k <= steps; k++) {
      const to = (p.tile + (backward ? TILE_COUNT - 1 : 1)) % TILE_COUNT;
      this.move(player, to, 'hop');
      if (backward || k === steps) continue;
      const here = this.alive().filter((o) => o !== player && S.players[o].tile === to);
      const date = here.find((o) => this.moveMods[o].blindDate);
      if (date !== undefined) { this.toast(`${p.name} stops to meet ${this.playerName(date)}`); break; }
      here.forEach((o) => this.passedPlayers.add(o));
      await this.passEffect(player, to);
      if (p.bankruptRound || this.over()) return;
    }
  }

  private async passEffect(player: number, i: number) {
    const S = this.S, t = TILES[i], o = S.ownedByTile[i], p = S.players[player];
    if (t.kind === 'start') { this.give(player, 3000, 'passed START'); return this.toast(`${p.name} passed START: +$3,000`, 'good'); }
    if (!o || o.mortgaged) return;
    if (o.owner === player) { if (t.kind === 'oil') { this.give(player, 400, m`passed ${T(i, true)}`); this.toast(m`${T(i)}: +$400`, 'good'); } return; }
    if (!this.collects(o.owner)) return;
    await this.toll(player, i);
  }

  private async toll(player: number, i: number) {
    const S = this.S, t = TILES[i], o = S.ownedByTile[i], p = S.players[player];
    if (t.kind === 'choke') {
      const fee = [200, 300, 400, 500][this.count(o.owner, 'choke') - 1];
      this.toast(m`Toll at ${T(i)}: -${money(fee)}`, 'bad');
      await this.pay(player, fee, m`toll at ${T(i, true)}`, o.owner);
    } else if (t.name === 'Hong Kong') {
      const fee = Math.round((p.cash * [0.05, 0.1, 0.15][o.level]) / 10) * 10;
      this.toast(m`${T(i)} levy: -${money(fee)}`, 'bad');
      await this.pay(player, fee, m`${T(i, true)} levy`, o.owner);
    }
  }

  // ---- Landing ----
  async landOn(player: number, i: number) {
    const S = this.S, p = S.players[player], t = TILES[i], o = S.ownedByTile[i];
    this.log(m`${P(player)} stops at ${T(i, true)}`);
    if (t.type === 'public') return this.publicTile(player, t);
    if (!o) {
      if (!(await this.offer(player, i, 'buy', t.price)) || !(await this.pay(player, t.price, m`bought ${T(i, true)}`))) return;
      this.own(i, { owner: player, level: 0, mortgaged: false, upgradePaid: 0 });
      this.toast(m`${p.name} bought ${T(i)}`, 'good');
      return;
    }
    if (o.owner === player) {
      if (o.mortgaged) return this.toast(m`${T(i)} is mortgaged`);
      if (t.kind === 'military') return this.strike(player, i);
      if (i === JERU) { await this.jerusalem(player, o); if (this.over()) return; }
      const price = o.level === 0 && this.count(player, 'build') ? 0 : t.upgradeCost;
      const level = o.level + 1, what = m`upgraded ${T(i, true)} to Lv ${String(level)}`;
      if (o.level >= maxLevel(t) || !(await this.offer(player, i, 'upgrade', price)) || !(await this.pay(player, price, what))) return;
      if (!price) this.log(m`${P(player)} ${what}`); // a free one has no payment to say it — and adds nothing to the lot value
      this.own(i, { ...o, level, upgradePaid: (o.upgradePaid ?? o.level * t.upgradeCost) + price });
      this.toast(m`${T(i)} upgraded to Lv ${String(level)}`, 'good');
      this.bonus('New York', [200, 300, 500], m`${P(player)} upgraded ${T(i, true)}`);
      return;
    }
    const owner = S.players[o.owner];
    if (o.mortgaged) return this.toast(m`${T(i)} is mortgaged: no fee`);
    if (!this.collects(o.owner)) return this.toast(`${owner.name} is in jail: no fee`);
    if (i === VEGAS) return this.vegas(player, o);
    const fee = this.rent(player, t, o);
    if (!fee) {
      if (t.kind === 'choke' || t.name === 'Hong Kong') return this.toll(player, i);
      return this.toast(m`${owner.name} owns ${T(i)} (passive effect, no toll)`);
    }
    await this.pay(player, fee, m`rent at ${T(i, true)}`, o.owner);
  }

  private async strike(player: number, i: number) {
    const S = this.S, p = S.players[player], items = Object.keys(S.ownedByTile).map(Number).filter((k) => S.ownedByTile[k].level > 0).map((k) => ({ index: k, owned: S.ownedByTile[k] }));
    if (p.cash < 500 || !items.length) return;
    const sel = (await this.ask(player, { k: 'pick', of: 'tile', title: 'MILITARY BASE', sub: [`${p.name} · optional`], tone: TILES[i].color,
      hint: 'Pay $500 to bring any city down by 1 level.', items, rule: { k: 'one', msg: 'Pick a city' }, label: 'LOWER FOR $500', skip: 'SKIP' })) as number[] | null;
    if (!sel || !(await this.pay(player, 500, m`strike on ${T(sel[0], true)}`))) return;
    this.toast(m`${p.name} paid $500: ${T(sel[0])} is lowered`, 'bad');
    this.emit({ t: 'strike', from: i, to: sel[0] });
    this.lower(sel[0]);
  }

  private async jerusalem(player: number, o: Owned) {
    const dieA = this.d6(), dieB = this.d6(), fee = (dieA + dieB) * [100, 200, 300][o.level];
    this.emit({ t: 'dice', dieA, dieB });
    this.toast(m`${T(JERU)}: rolled ${String(dieA + dieB)}, every other player pays ${money(fee)}`, 'good');
    this.log(m`${P(player)} rolled ${String(dieA + dieB)} at ${T(JERU, true)}`);
    for (const q of this.alive()) {
      if (q !== player) await this.pay(q, fee, m`${T(JERU, true)}: rolled ${String(dieA + dieB)}`, player);
      if (this.S.players[player].bankruptRound || this.over()) return;
    }
  }

  private async vegas(player: number, o: Owned) {
    const dieA = this.d6(), dieB = this.d6(), fee = (dieA + dieB) * [300, 500, 700][o.level];
    this.emit({ t: 'dice', dieA, dieB });
    this.toast(m`${T(VEGAS)}: rolled ${String(dieA + dieB)}, pays ${money(fee)}`, 'bad');
    this.log(m`${P(player)} rolled ${String(dieA + dieB)} at ${T(VEGAS, true)}`);
    await this.pay(player, fee, m`${T(VEGAS, true)}: rolled ${String(dieA + dieB)}`, o.owner);
  }

  // BUY / UPGRADE card; `sel` shows the tile in the side panel.
  private async offer(player: number, i: number, mode: 'buy' | 'upgrade', price: number) {
    const p = this.S.players[player];
    if (p.cash >= price) return (await this.ask(player, { k: 'deed', tile: i, mode, price })) === true;
    this.toast(m`${p.name} can't afford to ${mode} ${T(i)}: ${money(price)}`, 'bad');
    this.emit({ t: 'sel', player, tile: i });
    return false;
  }

  private rent(player: number, t: Tile, o: Owned): number {
    const S = this.S;
    if (t.type === 'city') {
      const base = cityRent(t)[o.level];
      const mono = hasMonopoly(S, t);
      const sg = this.activeLotOwnedBy(o.owner, 'Singapore'), py = this.activeLotOwnedBy(player, 'Pyongyang');
      const up = (mono ? 0.5 : 0) + (sg ? [0.1, 0.15, 0.2][sg.level] : 0), down = py ? [0.1, 0.15, 0.2][py.level] : 0;
      return Math.round(base * (1 + up) * (1 - down));
    }
    if (t.kind === 'transport') return [500, 1000, 2000][this.count(o.owner, 'transport') - 1];
    return 0;
  }

  async sendToJail(player: number) {
    const p = this.S.players[player];
    if (p.jail || p.bankruptRound) return;
    if (this.activeLotOwnedBy(player, "Devil's Island") && p.cash >= 700 && (await this.ask(player, { k: 'confirm', title: "DEVIL'S ISLAND", sub: [p.name], tone: TILES[tileAt("Devil's Island")].color,
      body: [note("You own Devil's Island. Pay $700 bail and only visit the Jail tile, with no stay?")], yes: 'PAY $700', no: 'GO TO JAIL' })) === true) {
      await this.pay(player, 700, m`bail at ${T(tileAt("Devil's Island"), true)}`);
      this.toast(`${p.name} paid bail`);
      this.move(player, JAIL, 'jump');
      return;
    }
    this.emit({ t: 'flag', player, flag: 'jail', active: true });
    this.toast(`${p.name} goes to JAIL!`, 'bad');
    this.log(m`${P(player)} was sent to jail`);
    this.move(player, JAIL, 'jump');
    this.bonus("Devil's Island", [700], m`${P(player)} went to jail`);
  }

  // ---- Public tiles ----
  private async publicTile(player: number, t: Tile) {
    const S = this.S, p = S.players[player], investments = this.owned(player, ['invest']), cities = this.owned(player, ['city', 'special']);
    switch (t.kind) {
      case 'start':
        this.give(player, 3000, 'landed on START');
        this.toast('Landed on START: +$3,000', 'good');
        break;
      case 'jail': this.toast(`${p.name} is just visiting`); break;
      case 'gojail':
        await this.sendToJail(player);
        break;
      case 'exchange':
        if (!investments) { this.toast(`${t.name}: no investments, no dividend`); break; }
        this.toast(m`${t.name}: +${money(investments * 500)}`, 'good');
        this.give(player, investments * 500, `${t.name} dividend`);
        break;
      case 'tax': {
        const amount = t.i === TAXES[1]
          ? Math.round((p.cash * 0.03 + (p.deposit?.principal ?? 0) * 0.05) / 10) * 10
          : cities * 30 + investments * 50;
        if (!amount) { this.toast(`${t.name}: nothing to tax`); break; }
        this.toast(m`${t.name}: -${money(amount)}`, 'bad');
        await this.pay(player, amount, t.name);
        break;
      }
      case 'casino': await this.casino(player, t); break;
      case 'club':
        this.toast(m`${t.name}: -${money(100)} & party`, 'bad');
        if (await this.pay(player, 100, t.name)) this.emit({ t: 'flag', player, flag: 'party', active: true });
        break;
      case 'bank': {
        const items = this.mortgageable(player, 1), canDep = this.canDeposit(player);
        if (!items.length) { // nothing to mortgage: the deposit is the only offer, if any
          if (canDep) await this.deposit(player);
          else this.toast(`${t.name}: nothing to do`);
          break;
        }
        const sel = (await this.ask(player, { k: 'pick', of: 'tile', title: 'BANK', sub: [`${p.name} · optional${canDep ? ' · 1/2' : ''}`], tone: t.color,
          hint: 'Mortgage properties for their full lot value. Redeeming costs the same.', items, rule: { k: 'any' }, label: 'MORTGAGE', skip: canDep ? 'NEXT' : 'LEAVE' })) as number[] | null;
        if (sel?.length) this.mortgage(player, sel, 1);
        await this.deposit(player, canDep ? '2/2' : undefined);
        break;
      }
      case 'news': await this.news(player); break;
      case 'area51': {
        const to = this.pick(TILES.filter((x) => x.i !== t.i)).i;
        this.toast(m`${t.name}: teleported to ${T(to)}`);
        this.move(player, to, 'jump');
        await this.landOn(player, to);
        break;
      }
    }
  }

  private async news(player: number) {
    this.bonus('BBC', [200], m`${P(player)} triggered News`);
    let story = this.pick(NEWS)(this, player);
    if (this.activeLotOwnedBy(player, 'BBC') && (await this.ask(player, { k: 'news', card: story.card })) === true) story = this.pick(NEWS)(this, player);
    this.emit({ t: 'news', card: story.card }); // kept or drawn again, the story is read by everyone (the ask only decided which)
    const reason = m`News: ${B(story.card.title)}`;
    this.log(reason);
    await story.run(reason);
  }

  private async casino(player: number, t: Tile) {
    const p = this.S.players[player], variant = t.variant ?? 'lucky', visitId = this.nextAskId++;
    const view = { visitId, variant, bet: 0, maxBet: 0, rolls: [] as CasinoRoll[], won: 0, jailed: false };
    let jailed = false;
    if (variant === 'lucky') {
      const rolls: CasinoRoll[] = [];
      let won = 0, maxBet = Math.floor(p.cash / 100) * 100, jackpots = 0;
      if (maxBet < 100) { this.toast(m`${t.name}: the minimum bet is ${money(100)}`); return; }
      let w = (await this.ask(player, { k: 'casino', view: { ...view, stage: 'bet', bet: Math.min(500, maxBet), maxBet } })) as { bet: number; pickedNumber: number };
      for (let n = 1; n <= 2; n++) {
        if (!(await this.pay(player, w.bet, `${t.name} bet`))) { this.emit({ t: 'casino', view: { ...view, stage: 'cash' } }); return; } // the wager busted them: the visit is over
        const dieA = this.d6(), dieB = this.d6(), hits = (dieA === w.pickedNumber ? 1 : 0) + (dieB === w.pickedNumber ? 1 : 0);
        const gain = hits === 2 ? w.bet * 5 - 100 : hits === 1 ? w.bet * 2 - 10 : 0, reason = m`${t.name}: rolled ${String(dieA)} & ${String(dieB)} on ${String(w.pickedNumber)}`;
        jackpots += hits === 2 ? 1 : 0;
        rolls.push([dieA, dieB, gain, w.bet, w.pickedNumber]);
        won += gain;
        jailed = jackpots === 2;
        maxBet = Math.floor((p.cash + gain) / 100) * 100; // what the next wager may be, once this round pays out
        const now = { ...view, bet: w.bet, maxBet, rolls: [...rolls], won, jailed };
        if (n === 2 || maxBet < 100) { this.emit({ t: 'casino', view: { ...now, stage: 'end' } }); this.give(player, gain, reason); break; } // cannot cover the smallest stake again: the table closes
        const next = (await this.ask(player, { k: 'casino', view: { ...now, stage: 'again', bet: Math.min(500, maxBet) } })) as { act: 'roll'; bet: number; pickedNumber: number } | { act: 'cash' };
        this.give(player, gain, reason);
        if (next.act === 'cash') { this.emit({ t: 'casino', view: { ...now, stage: 'cash' } }); break; }
        w = next;
      }
    } else {
      const rolls: CasinoRoll[] = [];
      let won = 0, maxBet = Math.max(200, Math.floor(p.cash / 100) * 100);
      let bet = ((await this.ask(player, { k: 'casino', view: { ...view, stage: 'bet', bet: Math.min(500, maxBet), maxBet } })) as { bet: number }).bet;
      for (let n = 1; n <= 2; n++) {
        if (!(await this.pay(player, bet, `${t.name} bet`))) { this.emit({ t: 'casino', view: { ...view, stage: 'cash' } }); return; } // the wager busted them: the visit is over
        const dieA = this.d6(), dieB = this.d6(), sum = dieA + dieB, gain = Math.round(((sum - 2) / 5) * (bet - 100)), prev = rolls.at(-1), reason = m`${t.name}: rolled ${String(sum)}`;
        rolls.push([dieA, dieB, gain, bet]);
        won += gain;
        jailed = !!prev && [prev[0], prev[1]].sort().join() === [dieA, dieB].sort().join() && sum > 7;
        maxBet = Math.floor((p.cash + gain) / 100) * 100; // what the next wager may be, once this round pays out
        const now = { ...view, bet, maxBet, rolls: [...rolls], won, jailed };
        if (jailed || n === 2 || maxBet < 200) { this.emit({ t: 'casino', view: { ...now, stage: 'end' } }); this.give(player, gain, reason); break; } // not the smallest stake for another round: the table closes
        const next = (await this.ask(player, { k: 'casino', view: { ...now, stage: 'again', bet: Math.min(500, maxBet) } })) as { act: 'roll'; bet: number } | { act: 'cash' };
        this.give(player, gain, reason);
        if (next.act === 'cash') { this.emit({ t: 'casino', view: { ...now, stage: 'cash' } }); break; }
        bet = next.bet;
      }
    }
    if (jailed && !p.bankruptRound) await this.sendToJail(player);
  }
}
