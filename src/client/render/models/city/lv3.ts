import * as THREE from 'three';
import { block, box, emissive } from '../../builder';
import type { Kit } from './kit';

// Lv 3 — a slim ribbon-glazed tower on a glazed lobby, set back to one corner of it: a strip of glass to every floor, white after dusk,
// a band of the owner's light round the top of the shaft, a smaller lantern floor over it, and the owner's lamp on the mast.
export function tower(k: Kit) {
  const { g, roof, lamps, dim, lit, grey, trim, walk, bed } = k;
  const glass = dim(0xe4e9f4), slab = dim(0x9aa5bb), led = lit(roof, roof, 1.2), lamp = lamps ? emissive(roof) : undefined; // the owner's colour by day, a strip of light in it after dusk; the mast's lamp is lit by day too
  const rim = (w: number, d: number, x: number, y: number, z: number, h: number, t: number, color: number, mt?: THREE.Material) => { // a wall h high and t thick round a w x d deck centred at (x, z), flush with its edge
    for (const s of [-1, 1]) { box(g, w, h, t, color, x, y, z + (s * (d - t)) / 2, mt); box(g, t, h, d - 2 * t, color, x + (s * (w - t)) / 2, y, z, mt); }
  };
  block(g, 4, 4, 'atrium', glass, 0, 0, 0, lamps, 5); box(g, 2.12, 0.1, 2.12, roof, 0, 0.79);          // the glazed lobby, 2 x 2, under a cornice in the owner's colour
  block(g, 3, 3, 'glass glass glass', glass, 0.9, -0.25, -0.25, lamps, 6); box(g, 1.62, 0.1, 1.62, slab, -0.25, 0.9, -0.25); // the shaft, 1.5 x 1.5, on its back-left corner, on a plinth
  rim(1.62, 1.62, -0.25, 3.4, -0.25, 0.22, 0.08, roof, led); box(g, 1.46, 0.04, 1.46, slab, -0.25, 3.6, -0.25);  // the main band of light, a collar round the top floor, and the roof inside it
  block(g, 2, 2, 'glass', glass, 3.64, -0.25, -0.25, lamps, 7); rim(1, 1, -0.25, 4.54, -0.25, 0.06, 0.06, trim); // the lantern floor, 1 x 1, and the parapet of its roof
  box(g, 0.5, 0.2, 0.4, grey, -0.25, 4.54, -0.25); box(g, 0.06, 0.7, 0.06, 0xdddddd, -0.25, 4.74, -0.25); box(g, 0.16, 0.16, 0.16, roof, -0.25, 5.44, -0.25, lamp); // the plant room on it, its mast and the mast's lamp
  walk(0.8, 1); bed(-0.45, 0.9, 0.75, 0.6); bed(0.45, 0.9, 0.75, 0.6);                                       // the path from the doors, planters on the podium's roof
}
