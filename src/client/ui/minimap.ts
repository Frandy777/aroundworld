import type * as THREE from 'three';
import { TILES } from '../../shared/data';
import type { GameState } from '../../shared/types';
import { PAL, shade } from '../render/art';
import type { Token } from '../render/actors';

// Shaded tile chips, outlined tokens and the view frame (the dithered sea is the canvas' CSS background). One canvas pixel = one art pixel = 2px.
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
let mm = { k: 1, ox: 0, oz: 0 };
const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const chip = (g: CanvasRenderingContext2D, x: number, y: number, c: number, w = 3) => { px(g, shade(c, 0.55), x, y, w, 3); px(g, hex(c), x, y, w - 1, 2); }; // w x 3: body lit from the top-left, shade on the far edges

export function drawMinimap(cv: HTMLCanvasElement, S: GameState, POS: THREE.Vector3[], toks: Token[], view: { x: number; z: number; w: number; h: number }) {
  const g = cv.getContext('2d')!, xs = POS.map((p) => p.x), zs = POS.map((p) => p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const k = Math.min((cv.width - 8) / (x1 - x0), (cv.height - 8) / (z1 - z0));
  const ox = (cv.width - (x1 - x0) * k) / 2 - x0 * k, oz = (cv.height - (z1 - z0) * k) / 2 - z0 * k;
  mm = { k, ox, oz };
  g.clearRect(0, 0, cv.width, cv.height);
  TILES.forEach((t) => {
    const X = Math.round(POS[t.i].x * k + ox), Z = Math.round(POS[t.i].z * k + oz), o = S.own[t.i];
    const X2 = t.i ? X : Math.round(POS[TILES.length].x * k + ox); // START is two cells wide: its own and the wing, the loop's last cell
    chip(g, Math.min(X, X2) - 1, Z - 1, t.color, Math.abs(X - X2) + 3);
    if (o) px(g, o.m ? '#555' : hex(S.players[o.p].color), X, Z, 1, 1);
  });
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
