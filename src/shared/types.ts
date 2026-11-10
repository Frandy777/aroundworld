import type { CasinoVariant } from './data';

// ---- Text ----
// Log lines, toasts and card text are data, not HTML: player names are user input. The client turns a segment into
// markup: {p} a player's name in their colour, {t} a tile's name with its flag (`b`: in bold).
export type Seg = string | { p: number } | { t: number; b?: boolean } | { b: string };
export type Msg = Seg[];

// ---- State: what the server decides and every client mirrors (see `apply` in state.ts) ----
export type Mode = 'limited' | 'endless';
export interface Settings { mode: Mode; rounds: number }
export type Step = 'redeem' | 'roll' | 'move' | 'resolve';
export type Flag = 'jail' | 'party' | 'stay'; // each makes the player skip their next turn

export interface Player { name: string; color: number; cash: number; tile: number; jail: boolean; party: boolean; stay: boolean; out: number } // out: the round of bankruptcy, 0 while playing
export interface Owned { p: number; lv: number; m: boolean } // owner, building level, mortgaged
export interface LogLine { id: number; r: number; m: Msg } // id: counts up from 1, so a line keeps its React key as newer ones are added above it
export interface GameState {
  settings: Settings;
  players: Player[];
  own: Record<number, Owned>; // by tile index
  order: number[]; // player indices in turn order
  turn: number; // index into `order`
  round: number;
  step: Step | null;
  bankrupt: number[]; // in order of bankruptcy
  over: boolean;
  log: LogLine[]; // newest first
}

// ---- Cards ----
export type Tone = '' | 'good' | 'bad';
export interface Row { l: Msg; v: Msg; sum?: boolean; tone?: Tone }
export type Block =
  | { k: 'note'; m: Msg }
  | { k: 'rows'; rows: Row[] }
  | { k: 'face'; p: number }; // a player's face, centred
// A card with nothing to decide: closes itself after a moment (twice as long when `long`).
export interface Notice { title: string; sub: Msg; tone: number; label: string; danger?: boolean; long?: boolean; body: Block[] }
export interface NewsCard { cat: string; title: string; text: string; amt?: number }
export interface OrderPass { group: number[]; rolls: [number, number][] } // one round of rolls for `group`, aligned
export interface RankRow { p: number; net: number }

// The casino card is one card across several steps; every step carries all of it.
export type CasinoRoll = [a: number, b: number, gain: number, stake: number];
export interface CasinoView {
  cid: number; v: CasinoVariant;
  stage: 'bet' | 'again' | 'play' | 'end' | 'cash'; // 'play': lucky's roll-or-leave choice; 'end': the result stays up a moment; 'cash': the player cashed out, the card just closes
  bet: number; max: number; // `max`: the largest bet on offer while betting
  rolls: CasinoRoll[]; won: number; jail: boolean; // `jail`: set at the end
}

// ---- Prompts: a decision asked of one player ----
export interface PickItem { i: number; amt?: number; note?: string; own?: Owned } // a tile (or a player) index, with a sum, a word, or who owns the tile and at what level, on the right
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
  | { k: 'news'; card: NewsCard } // the Media owner may keep the story or draw again
  | { k: 'casino'; view: CasinoView };
// What the roll question of a dev room takes besides the roll (see `Game.debug`).
export type Cmd =
  | { c: 'draw'; v: number[] } // the next random draws (dice, news card, coin flip) come out as these, in order; none: back to chance
  | { c: 'cash'; pi: number; v: number } // set a player's cash
  | { c: 'own'; i: number; o: Owned | null } // give a tile to a player (null: back to the bank)
  | { c: 'goto'; pi: number; i: number; land: boolean }; // jump to a tile; `land`: and stop there, which is the turn (it takes the roll's place)
export type Answer = boolean | number[] | null | { act: 'roll'; bet: number } | { act: 'cash' } | Cmd;

// ---- Events: the one stream the game is told in ----
export type Ev =
  | { t: 'start'; state: GameState }
  | { t: 'order'; passes: OrderPass[]; order: number[] }
  | { t: 'turn'; turn: number; round: number }
  | { t: 'step'; s: Step | null }
  | { t: 'dice'; a: number; b: number }
  | { t: 'move'; pi: number; to: number; how: 'hop' | 'jump' }
  | { t: 'strike'; from: number; to: number } // a military launch: the impact precedes the target's `own` downgrade
  | { t: 'cash'; pi: number; d: number }
  | { t: 'own'; i: number; o: Owned | null }
  | { t: 'flag'; pi: number; k: Flag; v: boolean }
  | { t: 'out'; pi: number }
  | { t: 'toast'; m: Msg; tone?: Tone }
  | { t: 'log'; m: Msg }
  | { t: 'sel'; pi: number; i: number } // show a tile in `pi`'s side panel
  | { t: 'skip'; pi: number; m: Msg } // a skipped turn
  | { t: 'notice'; n: Notice }
  | { t: 'news'; card: NewsCard }
  | { t: 'casino'; view: CasinoView }
  | { t: 'ask'; id: number; to: number; p: Prompt }
  | { t: 'close'; id: number } // the prompt `id` was answered (or timed out)
  | { t: 'over'; rank: RankRow[] };
