import { START_CASH, TILES, TILE_COUNT, cityRent, kindAt, maxLevel, tileAt, type Tile } from '../shared/data';
import { B, P, T, m, money } from '../shared/msg';
import { apply, canPick, command, hasMonopoly, maxRounds, ranking, stats } from '../shared/state';
import type { Answer, Block, CasinoRoll, Cmd, Ev, GameState, Msg, Notice, OrderPass, Owned, PickItem, Prompt, Settings, Tone } from '../shared/types';
import { NEWS } from './news';

const N = TILE_COUNT;
const JAIL = kindAt('jail');
const JERU = tileAt('Jerusalem');
const VEGAS = tileAt('Las Vegas');
const ASK_MS = 60_000; // how long a player has to decide before the default answer is taken
const OFFLINE_MS = 8_000; // ... when they are not connected (long enough to reload the page)
const BOT_MS = 300; // ... when it is a bot: a beat for the screen to follow, then the default answer
const LAPSE_MAX = 20; // questions in a row that ran out of time, with no answer in between: nobody is playing (an open tab alone keeps the room up), and the game ends

export interface Host {
  emit(ev: Ev): void; // tell every client
  online(pi: number): boolean;
  bot(pi: number): boolean; // a bot is not waited for: it takes the default answer after BOT_MS
  anyOnline(): boolean;
  save(): void; // the game waits: write down where it stands
  readonly dev: boolean; // a dev room: its roll question also takes the commands of the dev panel
}
interface Pending { id: number; to: number; p: Prompt; ev: Ev; resolve(a: Answer): void; due: number } // due: when it answers itself (epoch ms; 0: it waits)
// What the next move of a player is bent by (news events). They never show: the news card said it.
export interface Mods { fuel: boolean; half: boolean; back: boolean; magnet: boolean }
const noMods = (): Mods => ({ fuel: false, half: false, back: false, magnet: false });

// What a restart keeps of a game: how a turn began (a checkpoint), and what that turn has taken from outside since (the tape: its dice, and the answers it was given; `k` is 'rnd' or the kind of prompt answered).
interface Entry { k: string; v: unknown }
export interface Ckpt { S: GameState; mods: Mods[]; nextId: number; gone: number[]; turn: number; round: number; rig: number[] }
export interface Saved { ckpt: Ckpt; tape: Entry[]; due: number; lapsed: number }

/** The game before its first turn. */
export const fresh = (players: { name: string; color: number }[], settings: Settings): Ckpt => ({
  S: {
    settings, own: {}, order: players.map((_, i) => i), turn: 0, round: 1, step: null, bankrupt: [], over: false, log: [],
    players: players.map((p) => ({ ...p, cash: START_CASH, tile: 0, jail: false, party: false, stay: false, out: 0 })),
  },
  mods: players.map(noMods), nextId: 1, gone: [], turn: 0, round: 1, rig: [],
});

const note = (...a: Msg): Block => ({ k: 'note', m: a });
const tiles = (sel: number[]): Msg => sel.flatMap((i, k) => (k ? [', ', T(i)] : [T(i)]));

// What a player who does not answer in time gets.
function fallback(p: Prompt): Answer {
  switch (p.k) {
    case 'roll': return true;
    case 'pick': {
      if (p.skip) return null;
      if (p.rule.k !== 'raise') return p.items.slice(0, 1).map((x) => x.i);
      let need = p.rule.need - p.rule.cash; // the fewest properties that raise enough
      const sel: number[] = [];
      for (const x of [...p.items].sort((a, b) => (b.amt ?? 0) - (a.amt ?? 0))) { if (need <= 0) break; sel.push(x.i); need -= x.amt ?? 0; }
      return sel;
    }
    case 'casino': return p.view.stage === 'bet' || p.view.stage === 'play' ? { act: 'roll', bet: p.view.bet } : { act: 'cash' };
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
      const by = new Map(p.items.map((x) => [x.i, x.amt ?? 0]));
      if (!v.every((i) => by.has(i))) return undefined;
      const sum = v.reduce((s: number, i: number) => s + (by.get(i) ?? 0), 0), r = p.rule;
      return canPick(r, v.length, sum) ? (v as number[]) : undefined;
    }
    case 'casino': {
      const a = v as { act?: unknown; bet?: unknown } | null;
      if (!a || typeof a !== 'object') return undefined;
      if (a.act === 'cash') return p.view.stage === 'again' || p.view.stage === 'play' ? { act: 'cash' } : undefined;
      if (a.act !== 'roll') return undefined;
      if (p.view.stage === 'play') return { act: 'roll', bet: p.view.bet };
      const bet = a.bet;
      return typeof bet === 'number' && Number.isInteger(bet) && bet % 100 === 0 && bet >= 200 && bet <= p.view.max ? { act: 'roll', bet } : undefined;
    }
  }
}

export class Game {
  readonly S: GameState;
  mods: Mods[];
  again = false; // Buy One, Get One: the player goes once more
  passed = new Set<number>(); // players walked past this turn
  private rig: number[] = []; // what the dev panel wants the next random draws to be (see `rnd`)
  private nextId: number;
  private pending: Pending | null = null;
  private gone: Set<number>; // players who left: their asks answer themselves, and they drop out on their next turn
  private tape: Entry[] = []; // what the turn in progress has taken from outside so far
  private replay: Entry[] | null = null; // the tape while it plays back after a restart; null once the game is live
  private wasDue = 0; // the clock the open question had before the restart
  private lapsed = 0; // questions in a row that ran out of time (a bot's do not count; an answer clears it): see LAPSE_MAX
  private caughtUp?: () => void; // the playback is over

  /** A game standing at a checkpoint: a new one (`fresh`), or the one a restart found. */
  constructor(private host: Host, private ckpt: Ckpt) {
    this.S = structuredClone(ckpt.S);
    this.mods = structuredClone(ckpt.mods);
    this.nextId = ckpt.nextId;
    this.gone = new Set(ckpt.gone);
    this.rig = [...(ckpt.rig ?? [])]; // a game saved before the dev panel has none
  }

  /** The ask a reconnecting client still has to see. */
  get pendingEv() { return this.pending?.ev ?? null; }
  /** When the open question answers itself (epoch ms; 0: it waits). */
  get due() { return this.pending?.due ?? 0; }
  /** What a restart needs to bring the game back. */
  get saved(): Saved { return { ckpt: this.ckpt, tape: this.tape, due: this.due, lapsed: this.lapsed }; }

  // ---- Chance and the tape ----
  // The game is a chain of awaits, which a restart cannot carry over. A turn can be played again though: from its checkpoint, fed from the tape instead of the dice and the
  // players, it ends up where it stood. That holds while everything a turn takes from outside comes through `rnd` and `ask`, and while the clients hear nothing of the replay.
  private next(k: string): Entry | undefined {
    const e = this.replay?.shift();
    if (e) {
      if (e.k !== k) throw new Error(`the tape has ${e.k} where the game wants ${k}`);
      this.tape.push(e);
      return e;
    }
    if (this.replay) { this.replay = null; this.caughtUp?.(); } // the tape is spent: live from here
  }
  /** 1..n */
  rnd(n: number): number {
    const e = this.next('rnd'), rigged = this.rig.shift(); // a draw of the replay takes its turn in the queue too, so the queue stands where it stood
    if (e) return e.v as number;
    const v = Math.min(n, rigged ?? 1 + Math.floor(Math.random() * n));
    this.tape.push({ k: 'rnd', v });
    return v;
  }
  d6() { return this.rnd(6); }
  pick<T>(a: readonly T[]): T { return a[this.rnd(a.length) - 1]; }
  coin() { return this.rnd(2) === 1; }

  // ---- Events ----
  emit(ev: Ev) { apply(this.S, ev); if (!this.replay) this.host.emit(ev); } // an event of the replay is no news to the clients
  log(msg: Msg) { this.emit({ t: 'log', m: msg }); }
  toast(msg: Msg | string, tone: Tone = '') { this.emit({ t: 'toast', m: typeof msg === 'string' ? [msg] : msg, tone }); }
  notice(n: Notice) { this.emit({ t: 'notice', n }); }
  /** The one place a player's cash changes: the log says by how much, and what for. */
  cash(pi: number, d: number, why: Msg | string) {
    if (!d) return;
    this.emit({ t: 'cash', pi, d });
    this.log(m`${P(pi)} ${(d > 0 ? '+' : '') + money(d)} \u00B7 ${why}`);
  }
  /** Money from one player to another: the same two cash events, but a single log line that names both. `paid` is what the payer's event reports. */
  private xfer(from: number, to: number, amt: number, why: Msg | string, paid = amt) {
    if (paid) this.emit({ t: 'cash', pi: from, d: -paid });
    this.emit({ t: 'cash', pi: to, d: amt });
    this.log(m`${P(from)} paid ${P(to)} ${money(amt)} \u00B7 ${why}`);
  }
  own(i: number, o: Owned | null) { this.emit({ t: 'own', i, o }); }
  move(pi: number, to: number, how: 'hop' | 'jump') { this.emit({ t: 'move', pi, to, how }); }
  nm(pi: number) { return this.S.players[pi].name; }

  // ---- Prompts ----
  ask(to: number, p: Prompt): Promise<Answer> {
    return new Promise((resolve) => {
      const id = this.nextId++, ev: Ev = { t: 'ask', id, to, p }, pend: Pending = { id, to, p, ev, resolve, due: 0 }, replaying = !!this.replay;
      const past = this.next(p.k);
      if (past) return resolve(past.v as Answer);
      this.pending = pend;
      if (replaying) { pend.due = this.wasDue; return; } // it was asked before the restart: the clients know, and its clock runs on
      this.emit(ev);
      if (this.gone.has(to)) return this.settle(pend, fallback(p));
      this.arm(pend);
      this.host.save();
    });
  }
  private settle(pend: Pending, v: Answer) {
    if (this.pending !== pend) return;
    this.pending = null;
    this.tape.push({ k: pend.p.k, v });
    this.emit({ t: 'close', id: pend.id });
    pend.resolve(v);
  }
  private arm(pend: Pending) {
    pend.due = this.host.anyOnline() ? Date.now() + (this.host.bot(pend.to) ? BOT_MS : this.host.online(pend.to) ? ASK_MS : OFFLINE_MS) : 0; // nobody is watching: the game waits
  }
  answer(pi: number, id: number, v: unknown) {
    const pend = this.pending;
    if (!pend || pend.id !== id || pend.to !== pi) return;
    // A dev room's roll question also takes the panel's commands. One that makes no sense is an answer of nothing (false): the question is asked again, and the panel never ends up without it.
    const a = this.host.dev && pend.p.k === 'roll' && v !== true ? command(this.S, v) ?? false : check(pend.p, v);
    if (a === undefined) return;
    this.lapsed = 0;
    this.settle(pend, a);
  }
  /** Somebody connected or left: the clock on the open question runs differently now. */
  presence() { if (this.pending) this.arm(this.pending); }
  /** The clock of the open question may have run out: then the default answer is taken (true). */
  tick(now: number) {
    const pend = this.pending;
    if (!pend?.due || pend.due > now) return false;
    if (!this.host.bot(pend.to)) this.lapsed++;
    this.settle(pend, fallback(pend.p));
    return true;
  }
  forfeit(pi: number) {
    this.gone.add(pi);
    if (this.pending?.to === pi) this.settle(this.pending, fallback(this.pending.p));
  }
  dispose() { this.pending = null; }

  // ---- Who is who ----
  alive() { return this.S.order.filter((i) => !this.S.players[i].out); }
  over() { return this.alive().length <= 1; }
  /** Jailed players collect nothing. */
  collects(pi: number) { return !this.S.players[pi].jail; }
  /** Working (not mortgaged) tiles of a kind that a player owns. */
  count(pi: number, kind: string) { return Object.keys(this.S.own).filter((k) => this.S.own[+k].p === pi && !this.S.own[+k].m && TILES[+k].kind === kind).length; }
  owned(pi: number, types: string[]) { return Object.keys(this.S.own).filter((k) => this.S.own[+k].p === pi && types.includes(TILES[+k].type)).length; }
  /** Players with a working tile of any of these kinds, in turn order. */
  owners(kinds: string[]) { return this.alive().filter((pi) => kinds.some((k) => this.count(pi, k))); }
  /** A working single tile (a special city, the Media group's BBC...) by name. */
  private sp(name: string) { const o = this.S.own[tileAt(name)]; return o && !o.m ? o : null; }
  spOf(pi: number, name: string) { const o = this.sp(name); return o?.p === pi ? o : null; }
  /** The player nearest to `pi` ahead (dir 1) or behind (dir -1) on the loop; a shared tile counts as a full lap. -1 for nobody. */
  nearest(pi: number, dir: 1 | -1) {
    const me = this.S.players[pi].tile, gap = (o: number) => ((((this.S.players[o].tile - me) * dir) % N) + N) % N || N;
    return this.alive().filter((o) => o !== pi).sort((a, b) => gap(a) - gap(b))[0] ?? -1;
  }
  private mortgageable(pi: number): PickItem[] {
    return Object.keys(this.S.own).map(Number).filter((i) => this.S.own[i].p === pi && !this.S.own[i].m && TILES[i].mort).map((i) => ({ i, lv: this.S.own[i].lv, amt: TILES[i].mort }));
  }

  // ---- Money: what each of these is for (`why`) goes to the log with the sum ----
  /** Money from the bank: Zurich takes its cut. */
  give(pi: number, amt: number, why: Msg | string, bank = true) {
    if (amt <= 0) return;
    this.cash(pi, amt, why);
    if (bank) this.bonus('Zurich', [100, 200, 300], m`${P(pi)} got money from the bank`, false);
  }
  /** A special tile pays its owner by level, for what `why` says somebody did. */
  private bonus(name: string, vals: number[], why: Msg, bank = true) {
    const o = this.sp(name), i = tileAt(name);
    if (!o || !this.collects(o.p)) return;
    this.toast(m`${T(i)}: ${this.nm(o.p)} earns ${money(vals[o.lv])}`, 'good');
    this.give(o.p, vals[o.lv], m`${T(i, true)}: ${why}`, bank);
  }
  /** Take `amt` from a player for the bank or for `to`, mortgaging what must be mortgaged. False when they went bankrupt instead. */
  async pay(pi: number, amt: number, why: Msg | string, to: number | null = null): Promise<boolean> {
    const S = this.S, p = S.players[pi];
    if (amt <= 0) return true;
    if (p.cash < amt) {
      const val = stats(S, pi).val, raised = p.cash + val;
      if (raised < amt) {
        this.notice({ title: 'BANKRUPT!', sub: [p.name], tone: 0xb13e53, label: 'OH NO...', danger: true, long: true, body: [
          { k: 'face', p: pi },
          note(`${p.name} owes ${money(amt)} but can only raise ${money(raised)} (cash + mortgage value). ${to !== null ? S.players[to].name + ' receives what can be raised.' : 'The bank takes everything.'}`)] });
        if (to !== null) this.xfer(pi, to, raised, m`${why} (bankrupt)`, p.cash);
        this.goBankrupt(pi);
        return false;
      }
      const items = this.mortgageable(pi), forced = raised - Math.min(...items.map((x) => x.amt ?? 0)) < amt; // short even without the cheapest: every city goes, nothing to choose
      if (forced) this.toast(`${p.name} must mortgage every city to pay ${money(amt)}`, 'bad');
      const sel = forced ? items.map((x) => x.i) : (await this.ask(pi, { k: 'pick', of: 'tile', title: 'MORTGAGE TO PAY', sub: [`${p.name} owes ${money(amt)}`], tone: 0x3b7bd9,
        hint: `You can't afford this. Mortgage properties to raise at least ${money(amt - p.cash)}.`, items, rule: { k: 'raise', cash: p.cash, need: amt }, label: 'MORTGAGE & PAY' })) as number[];
      this.mortgage(pi, sel);
    }
    if (to === null) this.cash(pi, -amt, why);
    else this.xfer(pi, to, amt, why);
    return true;
  }
  private mortgage(pi: number, sel: number[]) {
    for (const i of sel) this.own(i, { ...this.S.own[i], m: true });
    this.cash(pi, sel.reduce((s, i) => s + TILES[i].mort, 0), m`mortgaged ${tiles(sel)}`);
  }
  /** Out of the game: the properties go back to the bank. */
  private goBankrupt(pi: number) {
    for (const k of Object.keys(this.S.own).map(Number)) if (this.S.own[k].p === pi) this.own(k, null);
    this.emit({ t: 'out', pi });
    this.log(m`${P(pi)} went bankrupt`);
  }
  lower(i: number) {
    const o = this.S.own[i];
    this.own(i, { ...o, lv: o.lv - 1 });
    this.log(m`${T(i, true)} was lowered to Lv ${String(o.lv - 1)}`);
  }

  // ---- The game ----
  /** A turn begins: this is where a restart comes back to. */
  private mark(turn: number, round: number) {
    this.ckpt = structuredClone({ S: this.S, mods: this.mods, nextId: this.nextId, gone: [...this.gone], turn, round, rig: this.rig });
    this.tape = [];
  }

  /** After a restart: play the turn in progress again from its checkpoint, fed from the tape. Resolves once it stands where it stood; rejects when the code no longer plays it the same way. */
  resume({ tape, due, lapsed }: Omit<Saved, 'ckpt'>) {
    if (this.S.over) return Promise.resolve();
    return new Promise<void>((caughtUp, fail) => {
      this.replay = tape; this.wasDue = due; this.lapsed = lapsed ?? 0; this.caughtUp = caughtUp; // a game saved before the count has none
      this.run(true).then(caughtUp, (err) => { if (this.replay) fail(err); else console.error('game crashed', err); });
    });
  }

  async run(resumed = false) {
    const S = this.S;
    if (!resumed) {
      this.emit({ t: 'start', state: structuredClone(S) });
      this.rollOrder();
      this.log(['Game started. Good luck!']);
    }
    let { turn, round } = this.ckpt;
    for (;;) {
      const pi = S.order[turn];
      do {
        this.again = false;
        if (resumed) resumed = false; else this.mark(turn, round); // a resumed run begins in a turn that is marked already
        this.emit({ t: 'turn', turn, round });
        await this.play(pi);
        if (this.replay) throw new Error('the turn ended before its tape did'); // the code plays it differently than it was played
      } while (this.again && !this.over() && !S.players[pi].out);
      if (this.over() || this.lapsed >= LAPSE_MAX) break;
      do { if (++turn >= S.order.length) { turn = 0; round++; } } while (S.players[S.order[turn]].out);
      if (round > maxRounds(S)) break;
    }
    this.emit({ t: 'over', rank: ranking(S) });
    this.mark(turn, round); // the finished game is what a restart finds
    this.host.save();
  }

  // Everyone rolls two dice, the lowest total goes first, ties roll again among themselves.
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

  private async play(pi: number) {
    const S = this.S, p = S.players[pi];
    this.log(m`${P(pi)}'s turn`);
    if (this.gone.has(pi)) { this.toast(`${p.name} left the game`, 'bad'); this.goBankrupt(pi); return; }
    if (p.jail || p.party || p.stay) {
      this.emit({ t: 'skip', pi, m: [`${p.name} ${p.jail ? 'is in jail' : p.party ? 'is partying' : 'is held up'}: turn skipped`] });
      for (const k of ['jail', 'party', 'stay'] as const) if (p[k]) this.emit({ t: 'flag', pi, k, v: false });
      return;
    }
    // 1. Redeem (only when the cheapest mortgaged property is affordable: otherwise there is nothing to choose)
    this.emit({ t: 'step', s: 'redeem' });
    const mort = Object.keys(S.own).map(Number).filter((i) => S.own[i].p === pi && S.own[i].m);
    if (mort.length && p.cash >= Math.min(...mort.map((i) => TILES[i].mort))) {
      const sel = (await this.ask(pi, { k: 'pick', of: 'tile', title: 'REDEEM PROPERTIES?', sub: [`${p.name} \u00B7 optional`], tone: 0x2d7d6f,
        hint: 'Pay the mortgage value to bring a property back to life. Skipping is fine.', items: mort.map((i) => ({ i, amt: TILES[i].mort })), rule: { k: 'redeem', cash: p.cash }, label: 'REDEEM', skip: 'SKIP' })) as number[] | null;
      if (sel?.length) { for (const i of sel) this.own(i, { ...S.own[i], m: false }); this.cash(pi, -sel.reduce((s, i) => s + TILES[i].mort, 0), m`redeemed ${tiles(sel)}`); }
    }
    // 2. Roll (in a dev room the question may be answered with a command of the panel instead: it runs, and the question is asked again)
    this.emit({ t: 'step', s: 'roll' });
    for (let go = await this.ask(pi, { k: 'roll' }); go !== true; go = await this.ask(pi, { k: 'roll' })) if (go && (await this.debug(go as Cmd))) return;
    const a = this.d6(), b = this.d6();
    this.emit({ t: 'dice', a, b });
    if (a === b) this.bonus('Rio', [200, 500, 1000], m`${P(pi)} rolled doubles`);
    // 3. Move and 4. resolve the tile
    this.emit({ t: 'step', s: 'move' });
    await this.walk(pi, a + b);
    if (p.out || this.over()) return;
    this.emit({ t: 'step', s: 'resolve' });
    await this.landOn(pi, p.tile);
  }

  /** A command of the dev panel, which came as the answer to the roll question. It is an input like the dice and the answers: it is on the tape and plays again after a restart, and the clients hear it in order, so neither needs anything of its own. True when it played the turn out, in the roll's place. */
  private async debug(c: Cmd): Promise<boolean> {
    switch (c.c) {
      case 'draw': this.rig = [...c.v]; this.toast(`DEV: next draws ${c.v.join(', ') || 'by chance'}`); break; // a copy: the tape keeps the command as it came
      case 'cash': this.cash(c.pi, c.v - this.S.players[c.pi].cash, 'DEV: set cash'); break;
      case 'own': this.own(c.i, c.o); break;
      case 'goto':
        if (c.land) this.emit({ t: 'step', s: 'resolve' });
        this.move(c.pi, c.i, 'jump');
        if (c.land) await this.landOn(c.pi, c.i);
        return c.land;
    }
    return false;
  }

  // A normal move passes every tile on the way. Weather halves it, fuel adds 3, a World Tour turns it around (and passes nothing).
  private async walk(pi: number, total: number) {
    const S = this.S, p = S.players[pi], md = this.mods[pi], back = md.back;
    const steps = Math.ceil((total + (md.fuel ? 3 : 0)) / (md.half ? 2 : 1));
    this.mods[pi] = noMods(); // used up; so is this player's Blind Date
    this.passed.clear();
    for (let k = 1; k <= steps; k++) {
      const to = (p.tile + (back ? N - 1 : 1)) % N;
      this.move(pi, to, 'hop');
      if (back || k === steps) continue;
      const here = this.alive().filter((o) => o !== pi && S.players[o].tile === to);
      const date = here.find((o) => this.mods[o].magnet);
      if (date !== undefined) { this.toast(`${p.name} stops to meet ${this.nm(date)}`); break; }
      here.forEach((o) => this.passed.add(o));
      await this.passEffect(pi, to);
      if (p.out || this.over()) return;
    }
  }

  private async passEffect(pi: number, i: number) {
    const S = this.S, t = TILES[i], o = S.own[i], p = S.players[pi];
    if (t.kind === 'start') { this.give(pi, 3000, 'passed START'); return this.toast(`${p.name} passed START: +$3,000`, 'good'); }
    if (!o || o.m) return;
    if (o.p === pi) { if (t.kind === 'oil') { this.give(pi, 400, m`passed ${T(i, true)}`); this.toast(m`${T(i)}: +$400`, 'good'); } return; }
    if (!this.collects(o.p)) return;
    await this.toll(pi, i);
  }

  // The fee a chokepoint or Hong Kong charges a player who passes — or stops.
  private async toll(pi: number, i: number) {
    const S = this.S, t = TILES[i], o = S.own[i], p = S.players[pi];
    if (t.kind === 'choke') {
      const fee = [200, 300, 400, 500][this.count(o.p, 'choke') - 1];
      this.toast(m`Toll at ${T(i)}: -${money(fee)}`, 'bad');
      await this.pay(pi, fee, m`toll at ${T(i, true)}`, o.p);
    } else if (t.name === 'Hong Kong') {
      const fee = Math.round((p.cash * [0.05, 0.1, 0.15][o.lv]) / 10) * 10;
      this.toast(m`${T(i)} levy: -${money(fee)}`, 'bad');
      await this.pay(pi, fee, m`${T(i, true)} levy`, o.p);
    }
  }

  // ---- Landing ----
  async landOn(pi: number, i: number) {
    const S = this.S, p = S.players[pi], t = TILES[i], o = S.own[i];
    this.log(m`${P(pi)} stops at ${T(i, true)}`);
    if (t.type === 'public') return this.publicTile(pi, t);
    if (!o) {
      if (!(await this.offer(pi, i, 'buy', t.price)) || !(await this.pay(pi, t.price, m`bought ${T(i, true)}`))) return;
      this.own(i, { p: pi, lv: 0, m: false });
      this.toast(m`${p.name} bought ${T(i)}`, 'good');
      return;
    }
    if (o.p === pi) {
      if (o.m) return this.toast(m`${T(i)} is mortgaged`);
      if (t.kind === 'military') return this.strike(pi, i);
      if (i === JERU) { await this.jerusalem(pi, o); if (this.over()) return; }
      const price = o.lv === 0 && this.count(pi, 'build') ? 0 : t.up; // a construction company builds the first level for free
      const lv = o.lv + 1, what = m`upgraded ${T(i, true)} to Lv ${String(lv)}`;
      if (o.lv >= maxLevel(t) || !(await this.offer(pi, i, 'upgrade', price)) || !(await this.pay(pi, price, what))) return;
      if (!price) this.log(m`${P(pi)} ${what}`); // a free one has no payment to say it
      this.own(i, { ...o, lv });
      this.toast(m`${T(i)} upgraded to Lv ${String(lv)}`, 'good');
      this.bonus('New York', [300, 500, 700], m`${P(pi)} upgraded ${T(i, true)}`);
      return;
    }
    const owner = S.players[o.p];
    if (o.m) return this.toast(m`${T(i)} is mortgaged: no fee`);
    if (!this.collects(o.p)) return this.toast(`${owner.name} is in jail: no fee`);
    if (i === VEGAS) return this.vegas(pi, o);
    const fee = this.rent(pi, t, o);
    if (!fee) {
      if (t.kind === 'choke' || t.name === 'Hong Kong') return this.toll(pi, i);
      return this.toast(m`${owner.name} owns ${T(i)} (passive effect, no toll)`);
    }
    await this.pay(pi, fee, m`rent at ${T(i, true)}`, o.p);
  }

  // The owner of a working Military Base may pay $500 to bring any built city (anybody's) down one level.
  private async strike(pi: number, i: number) {
    const S = this.S, p = S.players[pi], items = Object.keys(S.own).map(Number).filter((k) => S.own[k].lv > 0).map((k) => ({ i: k, own: S.own[k] }));
    if (p.cash < 500 || !items.length) return;
    const sel = (await this.ask(pi, { k: 'pick', of: 'tile', title: 'MILITARY BASE', sub: [`${p.name} \u00B7 optional`], tone: TILES[i].color,
      hint: 'Pay $500 to bring any city down by 1 level.', items, rule: { k: 'one', msg: 'Pick a city' }, label: 'LOWER FOR $500', skip: 'SKIP' })) as number[] | null;
    if (!sel || !(await this.pay(pi, 500, m`strike on ${T(sel[0], true)}`))) return;
    this.toast(m`${p.name} paid $500: ${T(sel[0])} is lowered`, 'bad');
    this.emit({ t: 'strike', from: i, to: sel[0] });
    this.lower(sel[0]);
  }

  // The owner stopping at Jerusalem rolls the dice and charges every other player the total × $100/$200/$300 by level.
  private async jerusalem(pi: number, o: Owned) {
    const a = this.d6(), b = this.d6(), fee = (a + b) * [100, 200, 300][o.lv];
    this.emit({ t: 'dice', a, b });
    this.toast(m`${T(JERU)}: rolled ${String(a + b)}, every other player pays ${money(fee)}`, 'good');
    this.log(m`${P(pi)} rolled ${String(a + b)} at ${T(JERU, true)}`);
    for (const q of this.alive()) {
      if (q !== pi) await this.pay(q, fee, m`${T(JERU, true)}: rolled ${String(a + b)}`, pi);
      if (this.over()) return;
    }
  }

  // A visitor stopping at Las Vegas rolls the dice and pays the owner the total × $300/$500/$700 by level.
  private async vegas(pi: number, o: Owned) {
    const a = this.d6(), b = this.d6(), fee = (a + b) * [300, 500, 700][o.lv];
    this.emit({ t: 'dice', a, b });
    this.toast(m`${T(VEGAS)}: rolled ${String(a + b)}, pays ${money(fee)}`, 'bad');
    this.log(m`${P(pi)} rolled ${String(a + b)} at ${T(VEGAS, true)}`);
    await this.pay(pi, fee, m`${T(VEGAS, true)}: rolled ${String(a + b)}`, o.p);
  }

  // BUY / UPGRADE card. Without the cash there is nothing to decide: say so and show the tile in the side panel.
  private async offer(pi: number, i: number, mode: 'buy' | 'upgrade', price: number) {
    const p = this.S.players[pi];
    if (p.cash >= price) return (await this.ask(pi, { k: 'deed', tile: i, mode, price })) === true;
    this.toast(m`${p.name} can't afford to ${mode} ${T(i)}: ${money(price)}`, 'bad');
    this.emit({ t: 'sel', pi, i });
    return false;
  }

  private rent(pi: number, t: Tile, o: Owned): number {
    const S = this.S;
    if (t.type === 'city') {
      const base = cityRent(t)[o.lv];
      const mono = hasMonopoly(S, t);
      const sg = this.spOf(o.p, 'Singapore'), py = this.spOf(pi, 'Pyongyang'); // the owner's bonus adds to the monopoly's; the payer's discount takes off the sum
      const up = (mono ? 0.5 : 0) + (sg ? [0.1, 0.15, 0.2][sg.lv] : 0), down = py ? [0.1, 0.15, 0.2][py.lv] : 0;
      return Math.round(base * (1 + up) * (1 - down));
    }
    if (t.kind === 'transport') return [500, 1000, 2000][this.count(o.p, 'transport') - 1];
    return 0;
  }

  async sendToJail(pi: number) {
    const p = this.S.players[pi];
    if (p.jail) return;
    if (this.spOf(pi, "Devil's Island") && p.cash >= 700 && (await this.ask(pi, { k: 'confirm', title: "DEVIL'S ISLAND", sub: [p.name], tone: TILES[tileAt("Devil's Island")].color,
      body: [note("You own Devil's Island. Pay $700 bail and only visit the Jail tile, with no stay?")], yes: 'PAY $700', no: 'GO TO JAIL' })) === true) {
      await this.pay(pi, 700, m`bail at ${T(tileAt("Devil's Island"), true)}`);
      this.toast(`${p.name} paid bail`);
      this.move(pi, JAIL, 'jump');
      return;
    }
    this.emit({ t: 'flag', pi, k: 'jail', v: true });
    this.toast(`${p.name} goes to JAIL!`, 'bad');
    this.log(m`${P(pi)} was sent to jail`);
    this.move(pi, JAIL, 'jump');
    this.bonus("Devil's Island", [700], m`${P(pi)} went to jail`);
  }

  // ---- Public tiles ----
  private async publicTile(pi: number, t: Tile) {
    const S = this.S, p = S.players[pi], inv = this.owned(pi, ['invest']), cities = this.owned(pi, ['city', 'special']);
    switch (t.kind) {
      case 'start':
        this.give(pi, 3000, 'landed on START');
        this.toast('Landed on START: +$3,000', 'good');
        break;
      case 'jail': this.toast(`${p.name} is just visiting`); break;
      case 'gojail':
        await this.sendToJail(pi);
        break;
      case 'exchange':
        if (!inv) { this.toast(`${t.name}: no investments, no dividend`); break; }
        this.toast(m`${t.name}: +${money(inv * 500)}`, 'good');
        this.give(pi, inv * 500, `${t.name} dividend`);
        break;
      case 'tax': {
        const amt = cities * 300 + inv * 500;
        if (!amt) { this.toast(`${t.name}: nothing to tax`); break; }
        this.toast(m`${t.name}: -${money(amt)}`, 'bad');
        await this.pay(pi, amt, t.name);
        break;
      }
      case 'casino': await this.casino(pi, t); break;
      case 'club':
        this.toast(m`${t.name}: -${money(100)} & party`, 'bad');
        if (await this.pay(pi, 100, t.name)) this.emit({ t: 'flag', pi, k: 'party', v: true });
        break;
      case 'bank': {
        const items = this.mortgageable(pi);
        if (!items.length) { this.toast('Nothing to mortgage'); break; }
        const sel = (await this.ask(pi, { k: 'pick', of: 'tile', title: 'BANK', sub: [`${p.name} \u00B7 optional`], tone: t.color,
          hint: 'Mortgage cities for cash. Mortgaged properties stop earning until you redeem them.', items, rule: { k: 'any' }, label: 'MORTGAGE', skip: 'LEAVE' })) as number[] | null;
        if (sel?.length) this.mortgage(pi, sel);
        break;
      }
      case 'news': await this.news(pi); break;
      case 'area51': { // an event move to any other tile: nothing on the way is passed, and the effect of the tile it lands on is resolved
        const to = this.pick(TILES.filter((x) => x.i !== t.i)).i;
        this.toast(m`${t.name}: teleported to ${T(to)}`);
        this.move(pi, to, 'jump');
        await this.landOn(pi, to);
        break;
      }
    }
  }

  // The Media owner is paid for every story and may throw their own away once.
  private async news(pi: number) {
    this.bonus('BBC', [500], m`${P(pi)} triggered News`);
    let story = this.pick(NEWS)(this, pi);
    if (this.spOf(pi, 'BBC') && (await this.ask(pi, { k: 'news', card: story.card })) === true) story = this.pick(NEWS)(this, pi);
    this.emit({ t: 'news', card: story.card }); // kept or drawn again, the story is read by everyone (the ask only decided which)
    const why = m`News: ${B(story.card.title)}`;
    this.log(why);
    await story.run(why); // what the story takes or gives says it was for this
  }

  // Lucky: a free roll on offer — doubles pay dice total × $1,000, anything else is jail; it may be declined. High stakes: up to 2 rolls, each staking
  // a bet of its own and settling before the next wager is offered; the same pair twice above 7 is jail. The one card is told in views.
  private async casino(pi: number, t: Tile) {
    const p = this.S.players[pi], v = t.variant ?? 'lucky', cid = this.nextId++;
    const view = { cid, v, bet: 0, max: 0, rolls: [] as CasinoRoll[], won: 0, jail: false };
    let delta = 0, jail = false;
    if (v === 'lucky') {
      const go = (await this.ask(pi, { k: 'casino', view: { ...view, stage: 'play' } })) as { act: 'roll' | 'cash' };
      if (go.act === 'cash') this.emit({ t: 'casino', view: { ...view, stage: 'cash' } });
      else {
        const a = this.d6(), b = this.d6();
        jail = a !== b;
        delta = jail ? 0 : (a + b) * 1000;
        this.emit({ t: 'casino', view: { ...view, stage: 'end', rolls: [[a, b, delta, 0]], won: delta, jail } });
      }
    } else {
      const rolls: CasinoRoll[] = [];
      let won = 0, max = Math.max(200, Math.floor(p.cash / 100) * 100);
      let bet = ((await this.ask(pi, { k: 'casino', view: { ...view, stage: 'bet', bet: Math.min(500, max), max } })) as { bet: number }).bet;
      for (let n = 1; n <= 2; n++) {
        if (!(await this.pay(pi, bet, `${t.name} bet`))) { this.emit({ t: 'casino', view: { ...view, stage: 'cash' } }); return; } // the wager busted them: the visit is over
        const a = this.d6(), b = this.d6(), sum = a + b, gain = Math.round(((sum - 2) / 5) * (bet - 100)), prev = rolls.at(-1), why = m`${t.name}: rolled ${String(sum)}`;
        rolls.push([a, b, gain, bet]);
        won += gain;
        jail = !!prev && [prev[0], prev[1]].sort().join() === [a, b].sort().join() && sum > 7; // the same pair twice, above 7
        max = Math.floor((p.cash + gain) / 100) * 100; // what the next wager may be, once this round pays out
        const now = { ...view, bet, max, rolls: [...rolls], won, jail };
        if (jail || n === 2 || max < 200) { this.emit({ t: 'casino', view: { ...now, stage: 'end' } }); this.give(pi, gain, why); break; } // not the smallest stake for another round: the table closes
        const next = (await this.ask(pi, { k: 'casino', view: { ...now, stage: 'again', bet: Math.min(500, max) } })) as { act: 'roll'; bet: number } | { act: 'cash' };
        this.give(pi, gain, why);
        if (next.act === 'cash') { this.emit({ t: 'casino', view: { ...now, stage: 'cash' } }); break; }
        bet = next.bet;
      }
    }
    if (delta > 0) this.give(pi, delta, `${t.name}: doubles`); else await this.pay(pi, -delta, t.name);
    if (jail && !p.out) await this.sendToJail(pi);
  }
}
