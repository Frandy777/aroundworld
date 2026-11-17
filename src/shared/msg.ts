import type { Msg, Seg } from './types';

export const money = (n: number) => (n < 0 ? '-$' : '$') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const P = (player: number): Seg => ({ player });
export const T = (tile: number, bold = false): Seg => ({ tile, bold });
export const B = (bold: string): Seg => ({ bold });

// m`${P(1)} paid ${money(500)} to ${P(2)}`: a template whose holes are segments (or whole messages)
export const m = (s: TemplateStringsArray, ...a: (Seg | Msg)[]): Msg => s.flatMap((x, i) => (i < a.length ? [x, ...[a[i]].flat()] : [x])).filter((x) => x !== '');
