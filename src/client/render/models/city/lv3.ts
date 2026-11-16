import * as THREE from 'three';
import { block, box, emissive } from '../../builder';
import type { Kit } from './kit';

export function tower(k: Kit) {
  const { g, roof, lamps, dim, lit, grey, trim, walk, bed } = k;
  const glass = dim(0xe4e9f4), slab = dim(0x9aa5bb), led = lit(roof, roof, 1.2), lamp = lamps ? emissive(roof) : undefined;
  const rim = (w: number, d: number, x: number, y: number, z: number, h: number, t: number, color: number, mt?: THREE.Material) => {
    for (const s of [-1, 1]) { box(g, w, h, t, color, x, y, z + (s * (d - t)) / 2, mt); box(g, t, h, d - 2 * t, color, x + (s * (w - t)) / 2, y, z, mt); }
  };
  block(g, 4, 4, 'atrium', glass, 0, 0, 0, lamps, 5); box(g, 2.12, 0.1, 2.12, roof, 0, 0.79);
  block(g, 3, 3, 'glass glass glass', glass, 0.9, -0.25, -0.25, lamps, 6); box(g, 1.62, 0.1, 1.62, slab, -0.25, 0.9, -0.25);
  rim(1.62, 1.62, -0.25, 3.4, -0.25, 0.22, 0.08, roof, led); box(g, 1.46, 0.04, 1.46, slab, -0.25, 3.6, -0.25);
  block(g, 2, 2, 'glass', glass, 3.64, -0.25, -0.25, lamps, 7); rim(1, 1, -0.25, 4.54, -0.25, 0.06, 0.06, trim);
  box(g, 0.5, 0.2, 0.4, grey, -0.25, 4.54, -0.25); box(g, 0.06, 0.7, 0.06, 0xdddddd, -0.25, 4.74, -0.25); box(g, 0.16, 0.16, 0.16, roof, -0.25, 5.44, -0.25, lamp);
  walk(0.8, 1); bed(-0.45, 0.9, 0.75, 0.6); bed(0.45, 0.9, 0.75, 0.6);
}
