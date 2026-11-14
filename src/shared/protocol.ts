import type { Ev, GameState, Settings } from './types';

export const NAME_MAX = 10;
export const CODE_RE = /^\d{6}$/;
export const PID_RE = /^[\w-]{8,64}$/; // a player's id (the client makes a UUID)
export const ROUNDS_MIN = 5;
export const ROUNDS_MAX = 100;
export const DEFAULT_SETTINGS: Settings = { mode: 'limited', rounds: 30 };
export const READ = 20_000; // ms a card with nothing to decide stays up before it closes itself

export interface SeatInfo { seat: number; name: string; online: boolean; host: boolean; bot: boolean; pi: number } // seat picks the colour; pi is the player index once the game runs, else -1
export interface RoomInfo { code: string; seats: SeatInfo[]; settings: Settings; started: boolean; me: number; dev: boolean } // me: the receiver's seat; dev: the host may seat bots
export type Fail = 'no-room' | 'full' | 'started' | 'busy';

export type C2S =
  | { t: 'name'; name: string }
  | { t: 'settings'; s: Settings }
  | { t: 'start' }
  | { t: 'bot'; seat: number } // dev room, host: put a bot on an empty seat, or send away the one on it
  | { t: 'answer'; id: number; v: unknown }
  | { t: 'bankrupt' } // declare bankruptcy: out of the game, still in the room to watch
  | { t: 'pause'; on: boolean } // dev room, host: freeze every question's clock (the game still takes real answers)
  | { t: 'again' } // after the game: back to the lobby
  | { t: 'ping' };

export type S2C =
  | { t: 'room'; room: RoomInfo }
  | { t: 'game'; me: number; state: GameState; ask: Ev | null; paused?: boolean } // a full snapshot (join, reconnect): `me` is the receiver's player index; `paused` is a dev room's frozen clocks
  | { t: 'ev'; ev: Ev[] }
  | { t: 'fail'; why: Fail };

// WebSocket close codes
export const LEAVE = 4001; // the client chose to go (forfeits a running game)
export const REPLACED = 4002; // the same player connected again elsewhere
