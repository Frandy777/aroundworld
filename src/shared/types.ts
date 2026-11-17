import type { CasinoVariant } from './data';

// ---- Text ----
// Log lines, toasts and card text are data, not HTML: player names are user input.
export type Seg = string | { player: number } | { tile: number; bold?: boolean } | { bold: string };
export type Msg = Seg[];

// ---- State: what the server decides and every client mirrors (see `apply` in state.ts) ----
export type Mode = 'limited' | 'endless';
export interface Settings { mode: Mode; rounds: number }
export type Step = 'redeem' | 'roll' | 'move' | 'resolve';
export type Flag = 'jail' | 'party' | 'stay';

export interface Player { name: string; color: number; cash: number; deposit: Deposit | null; tile: number; jail: boolean; party: boolean; stay: boolean; bankruptRound: number }
export interface Deposit { principal: number; termRounds: number; placedRound: number } // matures at placedRound + termRounds
export interface Owned { owner: number; level: number; mortgaged: boolean; upgradePaid?: number } // upgradePaid absent: level × upgradeCost is assumed
export interface LogLine { id: number; round: number; message: Msg } // id: counts up from 1, so a line keeps its React key as newer ones are added above it
export interface GameState {
  settings: Settings;
  players: Player[];
  ownedByTile: Record<number, Owned>;
  turnOrder: number[];
  turnIndex: number;
  round: number;
  step: Step | null;
  bankruptOrder: number[];
  over: boolean;
  log: LogLine[]; // newest first
}

// ---- Cards ----
export type Tone = '' | 'good' | 'bad';
export interface Row { label: Msg; value: Msg; sum?: boolean; tone?: Tone }
export type Block =
  | { k: 'note'; message: Msg }
  | { k: 'rows'; rows: Row[] }
  | { k: 'face'; player: number };
// A card with nothing to decide: closes itself after a moment.
export interface Notice { title: string; sub: Msg; tone: number; label: string; danger?: boolean; body: Block[] }
export interface NewsCard { category: string; title: string; text: string; amount?: number }
export interface OrderPass { group: number[]; rolls: [number, number][] } // one round of rolls for `group`, aligned
export interface RankRow { player: number; netWorth: number }

// The casino card is one card across several steps; every step carries all of it.
export type CasinoRoll = [dieA: number, dieB: number, gain: number, stake: number, pickedNumber?: number];
export interface CasinoView {
  visitId: number; variant: CasinoVariant;
  stage: 'bet' | 'again' | 'end' | 'cash'; // 'again': a further wager on offer (it may be declined); 'end': the result stays up a moment; 'cash': the player cashed out, the card just closes
  bet: number; maxBet: number;
  rolls: CasinoRoll[]; won: number; jailed: boolean;
}

// ---- Prompts: a decision asked of one player ----
export interface PickItem { index: number; level?: number; amount?: number; note?: string; owned?: Owned }
export type PickRule =
  | { k: 'redeem'; cash: number } // pay for what you pick, from `cash`
  | { k: 'raise'; cash: number; need: number } // raise enough to cover `need`
  | { k: 'any' } // at least one
  | { k: 'one'; msg: string }; // exactly one
export type Prompt =
  | { k: 'roll' }
  | { k: 'deed'; tile: number; mode: 'buy' | 'upgrade'; price: number }
  | { k: 'pick'; of: 'tile' | 'player'; title: string; sub: Msg; tone: number; hint: string; items: PickItem[]; rule: PickRule; label: string; skip?: string }
  | { k: 'confirm'; title: string; sub: Msg; tone: number; body: Block[]; yes: string; no: string }
  | { k: 'news'; card: NewsCard }
  | { k: 'dep'; maxPrincipal: number } // a fixed deposit on offer at the bank (cash rounded down to whole thousands)
  | { k: 'casino'; view: CasinoView };
// What the roll question of a dev room takes besides the roll (see `Game.debug`).
export type Cmd =
  | { c: 'draw'; draws: number[] } // the next random draws (dice, news card, coin flip) come out as these, in order; none: back to chance
  | { c: 'cash'; player: number; cash: number }
  | { c: 'own'; tile: number; owned: Owned | null }
  | { c: 'goto'; player: number; tile: number; resolveLanding: boolean }; // and stop there, which is the turn (it takes the roll's place)
export type Answer = boolean | number[] | null | { act: 'roll'; bet: number; pickedNumber?: number } | { act: 'cash' } | { principal: number; termRounds: number } | Cmd;

// ---- Events: the one stream the game is told in ----
export type Ev =
  | { t: 'start'; state: GameState }
  | { t: 'order'; passes: OrderPass[]; order: number[] }
  | { t: 'turn'; turnIndex: number; round: number }
  | { t: 'step'; step: Step | null }
  | { t: 'dice'; dieA: number; dieB: number }
  | { t: 'move'; player: number; to: number; how: 'hop' | 'jump' }
  | { t: 'strike'; from: number; to: number } // a military launch: the impact precedes the target's `own` downgrade
  | { t: 'cash'; player: number; delta: number }
  | { t: 'dep'; player: number; deposit: Deposit | null } // a fixed deposit placed or gone (matured, withdrawn early, lost to bankruptcy): the money side is told by `cash`
  | { t: 'own'; tile: number; owned: Owned | null }
  | { t: 'flag'; player: number; flag: Flag; active: boolean }
  | { t: 'out'; player: number }
  | { t: 'toast'; message: Msg; tone?: Tone }
  | { t: 'log'; message: Msg }
  | { t: 'sel'; player: number; tile: number } // show the tile in the player's side panel
  | { t: 'skip'; player: number; message: Msg } // a skipped turn
  | { t: 'notice'; notice: Notice }
  | { t: 'news'; card: NewsCard }
  | { t: 'casino'; view: CasinoView }
  | { t: 'ask'; id: number; player: number; prompt: Prompt }
  | { t: 'clock'; remainingMs: number; totalMs?: number } // the open prompt takes its default answer in `remainingMs` if nobody answers first (set again when somebody connects or leaves; 0: no clock — the game waits, or the player is a bot)
  | { t: 'paused'; paused: boolean } // a dev room froze or unfroze its question clocks: no prompt times out while frozen, answers are still taken
  | { t: 'close'; id: number } // the prompt `id` was answered (or timed out)
  | { t: 'over'; rank: RankRow[] };
