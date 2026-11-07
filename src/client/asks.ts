import type { Answer } from '../shared/types';
import { answer } from './net';

// The questions on screen. A question ends when this player answers it or when the server says it is over (somebody else answered, or it timed out).
const open = new Map<number, () => void>(); // question id -> how to take it down
const over = new Set<number>(); // closed before the director got to them

export const hold = (id: number, down: () => void) => open.set(id, down);
export const wasClosed = (id: number) => over.delete(id);
export function close(id: number) {
  const down = open.get(id);
  if (down) { open.delete(id); down(); } else over.add(id);
}
export const reply = (id: number, v: Answer) => { answer(id, v); close(id); };
export const forget = () => { open.clear(); over.clear(); };
