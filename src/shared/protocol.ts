import type { Ev, GameState, Settings } from './types';

export const NAME_MAX = 10;
export const CODE_RE = /^\d{6}$/;
export const PLAYER_ID_RE = /^[\w-]{8,64}$/;
export const ROUNDS_MIN = 5;
export const ROUNDS_MAX = 100;
export const DEFAULT_SETTINGS: Settings = { mode: 'limited', rounds: 30 };
export const AUTO_CLOSE_MS = 20_000;

export interface SeatInfo { seat: number; name: string; online: boolean; host: boolean; bot: boolean; playerIndex: number } // seat picks the colour; playerIndex is -1 before the game runs
export interface RoomInfo { code: string; seats: SeatInfo[]; settings: Settings; started: boolean; mySeat: number; dev: boolean } // dev: the host may seat bots
export type Fail = 'no-room' | 'full' | 'started' | 'busy';

export type C2S =
  | { t: 'name'; name: string }
  | { t: 'settings'; settings: Settings }
  | { t: 'start' }
  | { t: 'bot'; seat: number } // dev room, host: put a bot on an empty seat, or send away the one on it
  | { t: 'answer'; id: number; value: unknown }
  | { t: 'bankrupt' }
  | { t: 'pause'; paused: boolean } // dev room, host: freeze every question's clock (the game still takes real answers)
  | { t: 'again' } // after the game: back to the lobby
  | { t: 'ping' };

export type S2C =
  | { t: 'room'; room: RoomInfo }
  | { t: 'game'; myPlayer: number; state: GameState; openAsk: Ev | null; paused?: boolean } // a full snapshot (join, reconnect); `paused` is a dev room's frozen clocks
  | { t: 'ev'; ev: Ev[] }
  | { t: 'fail'; reason: Fail };

export const WS_CLOSE_LEAVE = 4001;
export const WS_CLOSE_REPLACED = 4002;
