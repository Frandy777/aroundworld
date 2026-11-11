import * as THREE from 'three';
import { box, lamplit } from '../../builder';

// ---- An ordinary city's building: what every level shares (the buildings themselves are one file each, lv1/lv2/lv3) ----
// After dusk every window is a lamp of its own (see `block`: lit or dark, warm or cold), the garden is lit by warm lamps (not in the owner's colour:
// the plot below is that colour, and glows, so a part that shone in it would melt into it, unless it far outshines it, as the villa's lamps do: see lv2.ts),
// and HD-2D adds a warm wrap-around PointLight pair per standing building (see hd2d.ts). A mortgaged building has them all out: the walls are grey,
// and its glass the glass of any other house.
export const WARM = 0xffc070; // the light of a path and the garden lamps
const BULB = 0xfff6b0;        // a lamp's bulb (one of NEON, so unlit)

// The palette and small props a level is drawn with, all of it derived from the owner's state once per build: `wall`/`roof` the colours of the walls
// (the region's tint) and of the roofs, parapets and railings (the owner's), `dim` the grey of a mortgaged building, `lit` the material of a part that
// shines after dusk (k times over, in HDR), or none (its own, grey) when mortgaged.
export interface Kit {
  g: THREE.Group; wall: number; roof: number; lamps: boolean;
  sand: number; green: number; trim: number; grey: number;                                              // paving, planting, white and concrete, `dim`-ed already
  dim: (c: number) => number;
  lit: (c: number, light: number, k?: number) => THREE.Material | undefined;
  walk: (w: number, z: number) => void;                                                                 // paving from the door (at depth z) to the front of the plot, inside its rim, warm after dusk
  bed: (x: number, y: number, z: number, w: number) => void;                                            // a planter, w long: a wooden box and its shrubs, which the lamps light
  bulb: (x: number, y: number, z: number, s?: number) => void;                                          // a lamp's bulb
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
