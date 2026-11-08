import { useSyncExternalStore, type ReactNode } from 'react';
import type { RoomInfo } from '../shared/protocol';
import { stats } from '../shared/state';
import type { Answer, GameState, Msg, Tone } from '../shared/types';

// ---- Cells: one observable value, read in components with useCell ----
export interface Cell<T> { get(): T; set(v: T): void; sub(f: () => void): () => void }
export function cell<T>(v: T): Cell<T> {
  const subs = new Set<() => void>();
  return { get: () => v, set(n) { if (n !== v) { v = n; subs.forEach((f) => f()); } }, sub: (f) => (subs.add(f), () => void subs.delete(f)) };
}
export const useCell = <T,>(c: Cell<T>) => useSyncExternalStore(c.sub, c.get);

// ---- Session: where this client is ----
export type View = 'title' | 'lobby' | 'game';
export const session = cell<{ view: View; room: RoomInfo | null }>({ view: 'title', room: null });

// ---- Game: what is on screen. The director plays the server's events into `S`, so it trails the real game by whatever is still animating.
// It is mutated in place; `bump` tells the components that show it. A component that shows the game reads it with `useGame`: `state()` does not
// subscribe, so what reads it only changes when something else happens to render it. ----
export const G = {
  S: null as GameState | null,
  me: -1, // my player index
};
const version = cell(0);
export const bump = () => version.set(version.get() + 1);
export const useGame = () => { useCell(version); return G.S as GameState; };
export const state = () => G.S as GameState;

// A player's `stats`, kept until ownership or cash changes (`bumpAssets`): a card draws again every frame while its cash rolls
let tallies: ReturnType<typeof stats>[] = [];
export const statsOf = (i: number) => (tallies[i] ??= stats(state(), i));
export const bumpAssets = () => { tallies = []; bump(); };

// ---- The rest of the screen: a cell each, so a change wakes only the parts that show it, not everything that shows the game ----
export type Tab = 'tile' | 'assets' | 'log';
export interface Button { label: string; click(): void; kbd?: boolean; reply?(v: Answer): void } // reply: the question behind the button takes other answers too (the roll question: the dev panel's commands)
export const hudLive = cell(false); // the HUD is up (the turn order is settled)
export const selectedTile = cell(-1); // the tile in the side panel
export const viewedPlayer = cell(-1); // whose assets the side panel shows
export const activeTab = cell<Tab>('tile'); // which pane
export const lastRoll = cell<[number, number] | null>(null); // the last roll, in the action bar
export const actionBtn = cell<Button | null>(null); // the one button in the action bar
export const waitingFor = cell(-1); // the player the game is waiting for

// ---- Preferences: this client's own, kept in localStorage ----
const FOCUS_KEY = 'autoFocus';
export const autoFocus = cell(localStorage.getItem(FOCUS_KEY) === 'true'); // the view goes to the player whose turn begins (mine too); off until asked for
autoFocus.sub(() => localStorage.setItem(FOCUS_KEY, String(autoFocus.get())));
const MAP_KEY = 'showMinimap';
export const showMinimap = cell(localStorage.getItem(MAP_KEY) === 'true'); // the minimap in the corner; off until asked for
showMinimap.sub(() => localStorage.setItem(MAP_KEY, String(showMinimap.get())));

// ---- Toasts and floating numbers: they remove themselves ----
export interface Toast { id: number; m: Msg; tone: Tone }
export interface Float { id: number; x: number; y: number; text: string; cls: string }
export const toasts = cell<Toast[]>([]);
export const floats = cell<Float[]>([]);
let seq = 1;
const expire = <T extends { id: number }>(c: Cell<T[]>, item: T, ms: number) => {
  c.set([...c.get(), item]);
  setTimeout(() => c.set(c.get().filter((x) => x.id !== item.id)), ms);
};
export const toast = (m: Msg | string, tone: Tone = '') => expire(toasts, { id: seq++, m: typeof m === 'string' ? [m] : m, tone }, 2800);
export const floatText = (x: number, y: number, text: string, cls = '') => expire(floats, { id: seq++, x: Math.round(x), y: Math.round(y), text, cls }, 1500);
// The cash on each player's card, put here by the card itself (a ref): what floats numbers over a card finds it by player, without knowing the HUD's markup
export const cashEls: (HTMLElement | null)[] = [];

// ---- Cards: modal dialogs. `done` settles when the card is closed with a value ----
export interface Open<T> { key: number; done: Promise<T>; close(v: T): void }
export const cards = cell<{ key: number; node: ReactNode }[]>([]);
export function openCard<T = void>(render: (close: (v: T) => void) => ReactNode): Open<T> {
  const key = seq++;
  let settle!: (v: T) => void;
  const done = new Promise<T>((r) => (settle = r));
  const close = (v: T) => {
    if (!cards.get().some((c) => c.key === key)) return;
    cards.set(cards.get().filter((c) => c.key !== key));
    settle(v);
  };
  cards.set([...cards.get(), { key, node: render(close) }]);
  return { key, done, close };
}
export const clearCards = () => cards.set([]);

// The tile under the pointer
export const tip = cell<{ i: number; x: number; y: number } | null>(null);
