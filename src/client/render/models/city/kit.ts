import * as THREE from 'three';
import { box, lamplit } from '../../builder';

export const WARM = 0xffc070;
const BULB = 0xfff6b0;

export interface Kit {
  g: THREE.Group; wall: number; roof: number; lamps: boolean;
  sand: number; green: number; trim: number; grey: number;
  dim: (c: number) => number;
  lit: (c: number, light: number, k?: number) => THREE.Material | undefined;
  walk: (w: number, z: number) => void;
  bed: (x: number, y: number, z: number, w: number) => void;
  bulb: (x: number, y: number, z: number, s?: number) => void;
}

export function kit(g: THREE.Group, wall: number, roof: number, m: boolean): Kit {
  const dim = (c: number) => (m ? 0x8c8c8c : c), lit = (c: number, light: number, k = 1) => (m ? undefined : lamplit(c, light, k));
  const sand = dim(0xdad3c0), green = dim(0x4f9d4f), trim = dim(0xf4f4f4), grey = dim(0xcfd6e6);
  return {
    g, wall, roof, lamps: !m, sand, green, trim, grey, dim, lit,
    walk: (w, z) => box(g, w, 0.03, 1.72 - z, sand, 0, 0, (z + 1.72) / 2, lit(sand, WARM, 0.3)),
    bed: (x, y, z, w) => { box(g, w, 0.1, 0.22, dim(0x8a5a2b), x, y, z); box(g, w - 0.08, 0.15, 0.14, green, x, y + 0.1, z, lit(green, WARM, 0.18)); },
    bulb: (x, y, z, s = 0.085) => box(g, s, s, s, dim(BULB), x, y, z),
  };
}
