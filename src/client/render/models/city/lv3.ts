import * as THREE from 'three';
import { block, box, GOLD } from '../../builder';
import type { Kit } from './kit';

const COOL = 0xcfe6ff; // the light of the tower's crown

// Lv 3 — a slim glass tower on a glazed lobby, set back to one corner of it, a gold band at its foot, a crown lit white under the beacon.
export function tower(k: Kit) {
  const { g, roof, lamps, dim, lit, grey, trim, walk, bed } = k;
  const gold = dim(GOLD), glass = dim(0xe4e9f4);
  const parapet = (w: number, d: number, x: number, y: number, z: number, h: number, color: number, mt?: THREE.Material) => { // a low wall h high round a deck of w x d centred at (x, z), flush with the deck's edge
    for (const s of [-1, 1]) { box(g, w, h, 0.1, color, x, y, z + (s * (d - 0.1)) / 2, mt); box(g, 0.1, h, d - 0.2, color, x + (s * (w - 0.1)) / 2, y, z, mt); }
  };
  block(g, 4, 4, 'atrium', glass, 0, 0, 0, lamps, 5); box(g, 2.12, 0.1, 2.12, roof, 0, 0.79);                // the glazed lobby, 2 x 2, under a cornice in the owner's colour
  block(g, 3, 3, 'glass glass glass glass', glass, 0.9, -0.25, -0.25, lamps, 6); box(g, 1.62, 0.1, 1.62, gold, -0.25, 0.9, -0.25); // the tower, 1.5 x 1.5, on its back-left corner, a gold band at its foot
  parapet(1.58, 1.58, -0.25, 4.5, -0.25, 0.1, trim, lit(0xf4f4f4, COOL, 0.7)); box(g, 1.38, 0.04, 1.38, dim(0x6b7385), -0.25, 4.5, -0.25); // the crown: a rim of white light after dusk round a dark roof,
  box(g, 0.8, 0.35, 0.8, grey, -0.25, 4.54, -0.25);                                                          // the plant room on it
  box(g, 0.06, 0.8, 0.06, 0xdddddd, -0.25, 4.89, -0.25); box(g, 0.16, 0.16, 0.16, dim(0xff3b3b), -0.25, 5.69, -0.25); // mast and beacon
  walk(0.8, 1); bed(-0.45, 0.9, 0.75, 0.6); bed(0.45, 0.9, 0.75, 0.6);                                       // the path from the doors, planters on the podium's roof
}
