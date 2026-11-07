import { TILES } from '../../shared/data';
import type { GameState } from '../../shared/types';
import { PAL, shade } from '../render/art';
import { POS } from '../render/layout';
import type { Token } from '../render/actors';

// Shaded tile chips, outlined tokens and the view frame (the dithered sea is the canvas' CSS background). One canvas pixel = one art pixel = 2px.
// The chips change only with an owner: they are drawn once on `base` (again after `invalidateMinimap`), and a frame copies it and puts the tokens and the view frame on top.
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const chip = (g: CanvasRenderingContext2D, x: number, y: number, c: number, w = 3) => { px(g, shade(c, 0.55), x, y, w, 3); px(g, hex(c), x, y, w - 1, 2); }; // w x 3: body lit from the top-left, shade on the far edges

const xs = POS.map((p) => p.x), zs = POS.map((p) => p.z); // the board never moves: its bounds are worked out once
const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
const base = document.createElement('canvas');
let mm = { k: 1, ox: 0, oz: 0 }, stale = true;
export const invalidateMinimap = () => (stale = true); // an owner changed: the next frame draws the chips again

function drawBase(cv: HTMLCanvasElement, S: GameState) {
  const k = Math.min((cv.width - 8) / (x1 - x0), (cv.height - 8) / (z1 - z0));
  const ox = (cv.width - (x1 - x0) * k) / 2 - x0 * k, oz = (cv.height - (z1 - z0) * k) / 2 - z0 * k;
  mm = { k, ox, oz };
  base.width = cv.width; base.height = cv.height; // sizing it clears it
  const g = base.getContext('2d')!;
  TILES.forEach((t) => {
    const X = Math.round(POS[t.i].x * k + ox), Z = Math.round(POS[t.i].z * k + oz), o = S.own[t.i];
    const X2 = t.i ? X : Math.round(POS[TILES.length].x * k + ox); // START is two cells wide: its own and the wing, the loop's last cell
    chip(g, Math.min(X, X2) - 1, Z - 1, t.color, Math.abs(X - X2) + 3);
    if (o) px(g, o.m ? '#555' : hex(S.players[o.p].color), X, Z, 1, 1);
  });
  stale = false;
}

export function drawMinimap(cv: HTMLCanvasElement, S: GameState, toks: Token[], view: { x: number; z: number; w: number; h: number }) {
  if (stale) drawBase(cv, S);
  const g = cv.getContext('2d')!, { k, ox, oz } = mm;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(base, 0, 0);
  toks.forEach((t, i) => {
    if (!t || S.players[i].out) return;
    const X = Math.round(POS[t.tile].x * k + ox), Z = Math.round(POS[t.tile].z * k + oz), c = S.players[i].color;
    px(g, PAL.o, X - 2, Z - 2, 5, 5); chip(g, X - 1, Z - 1, c); px(g, '#fff', X - 1, Z - 1, 1, 1);
  });
  const [vx, vz, vw, vh] = [view.x * k + ox - (view.w * k) / 2, view.z * k + oz - (view.h * k) / 2, view.w * k, view.h * k].map(Math.round);
  g.lineWidth = 3; g.strokeStyle = PAL.o; g.strokeRect(vx + 0.5, vz + 0.5, vw, vh);
  g.lineWidth = 1; g.strokeStyle = PAL.Y; g.strokeRect(vx + 0.5, vz + 0.5, vw, vh);
}

export const minimapToWorld = (e: { clientX: number; clientY: number; target: EventTarget | null }): [number, number] => {
  const cv = e.target as HTMLCanvasElement, r = cv.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * cv.width, y = ((e.clientY - r.top) / r.height) * cv.height;
  return [(x - mm.ox) / mm.k, (y - mm.oz) / mm.k];
};
