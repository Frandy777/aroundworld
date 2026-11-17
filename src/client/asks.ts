import type { Answer } from '../shared/types';
import { answer } from './net';

// The questions on screen. A question ends when this player answers it or when the server says it is over (somebody else answered, or it timed out).
const dismissByAskId = new Map<number, () => void>();
const closedEarlyAskIds = new Set<number>();

export const hold = (id: number, down: () => void) => dismissByAskId.set(id, down);
export const wasClosed = (id: number) => closedEarlyAskIds.delete(id);
export function close(id: number) {
  const down = dismissByAskId.get(id);
  if (down) { dismissByAskId.delete(id); down(); } else closedEarlyAskIds.add(id);
}
export const reply = (id: number, value: Answer) => { answer(id, value); close(id); };
export const forget = () => { dismissByAskId.clear(); closedEarlyAskIds.clear(); };
