import * as THREE from 'three';
import { shade } from '../art';
import { box, cyl, floor, hip, plaque, GOLD } from '../builder';

// Buildings on the plot, built from whole storey modules (so a taller house has more windows, never bigger texels): walls in the region's tint, the roof in the owner's colour
// (hip roof, parapet, tower cap), the trim in gold; all of it grey when mortgaged. Each level has a silhouette and a storey count of its own (1, 3, 5), so they read apart at
// any zoom: lv1 cottage under a hip roof, with a dormer and a garden path, lv2 apartments round a roof terrace, lv3 stepped glass tower, both with a lobby. Nothing juts out of a
// facade: from this camera it would hide what is below it.
export function building(g: THREE.Group, lv: number, wall: number, roof: number, m: boolean) {
  const dim = (c: number) => (m ? 0x8c8c8c : c), gold = dim(GOLD), glass = dim(0xe4e9f4), grey = dim(0xcfd6e6), green = dim(0x4f9d4f);
  let y = 0;
  const add = (n: number, kind: string, color = wall) => { floor(g, n, n, kind, color, y); y += 0.9; };       // a square storey, n modules (0.5 each) a side
  const belt = (color = 0xf4f4f4, w = 2.12) => box(g, w, 0.1, w, color, 0, y - 0.05);         // a band round the joint between two storeys
  const walk = (w: number, z: number) => box(g, w, 0.03, 1.72 - z, dim(0xdad3c0), 0, 0, (z + 1.72) / 2);      // paving from the door (at depth z) to the front of the plot, inside its rim
  const bed = (x: number, y: number, z: number, w: number) => { box(g, w, 0.1, 0.22, dim(0x8a5a2b), x, y, z); box(g, w - 0.08, 0.15, 0.14, green, x, y + 0.1, z); }; // a planter, w long: a wooden box and its shrubs
  if (lv === 1) {
    add(3, 'door'); hip(g, 1.8, 1.8, 1, y, roof); walk(0.5, 0.75);
    box(g, 0.25, 0.85, 0.25, dim(0xa8503c), 0.4, y + 0.1, -0.25); box(g, 0.3, 0.05, 0.3, dim(0xa39a8c), 0.4, y + 0.95, -0.25);  // chimney and its cap
    box(g, 0.4, 0.44, 0.4, wall, 0, y + 0.15, 0.5); hip(g, 0.56, 0.5, 0.18, y + 0.59, roof, 0, 0.5);                     // dormer: its body sunk into the slope, its roof
    box(g, 0.26, 0.2, 0.02, 0x1a2250, 0, y + 0.33, 0.7); box(g, 0.2, 0.14, 0.03, 0x5b8fe8, 0, y + 0.36, 0.7);             // and its window
    bed(-0.8, 0, 1.5, 0.5); bed(0.8, 0, 1.5, 0.5);                                                                         // a flower bed either side of the path
  } else if (lv === 2) {
    add(4, 'lobby'); belt(); add(4, 'win'); belt(); add(4, 'win'); walk(0.6, 1);
    box(g, 2, 0.04, 2, dim(0xa3a9bd), 0, y);                                                   // roof deck, inside a parapet of the owner's colour
    for (const [w, d, x, z] of [[2.2, 0.1, 0, 1.05], [2.2, 0.1, 0, -1.05], [0.1, 2, -1.05, 0], [0.1, 2, 1.05, 0]]) box(g, w, 0.22, d, roof, x, y, z);
    box(g, 0.5, 0.4, 0.5, wall, -0.55, y, -0.4); cyl(g, 0.2, 0.4, grey, 0.5, y, -0.3); box(g, 0.4, 0.2, 0.3, grey, -0.4, y, 0.4); // stair head, water tank, air-con
    bed(0.5, y, 0.5, 0.4);                                                                     // a planter on the roof
  } else {
    add(4, 'lobby'); belt(roof); add(4, 'glass', glass); add(4, 'glass', glass); walk(0.8, 1); // the top of a tier is the next one's terrace, with a gold band round its foot
    box(g, 1.58, 0.12, 1.58, gold, 0, y); add(3, 'glass', glass); box(g, 1.08, 0.12, 1.08, gold, 0, y); add(2, 'glass', glass);
    hip(g, 1.3, 1.3, 0.55, y, roof);                                                           // the cap
    box(g, 0.08, 1, 0.08, 0xdddddd, 0, y + 0.4); box(g, 0.2, 0.2, 0.2, dim(0xff3b3b), 0, y + 1.35); // mast and beacon
  }
}
// Owner flag (empty lots and investments) / "for sale" sign: both stand at the front-left corner of the plot, in the building group's space
const SPOT = [-0.85, 1.2];
export const flag = (g: THREE.Group, color: number) => {
  const [x, z] = SPOT, cx = x + 0.75, dark = shade(new THREE.Color(color).getHex(), 0.7);
  box(g, 0.45, 0.14, 0.45, 0xb9b2a0, x, 0, z); box(g, 0.14, 2.6, 0.14, 0xe8e8e8, x, 0.14, z); box(g, 0.28, 0.28, 0.28, GOLD, x, 2.74, z);
  box(g, 1.4, 0.85, 0.08, color, cx, 1.8, z); box(g, 1.4, 0.16, 0.09, dark, cx, 1.8, z);
};
export const sign = (g: THREE.Group) => { const z = SPOT[1] + 0.35; box(g, 0.14, 0.9, 0.14, 0x8a5a2b, 0, 0, z - 0.1); plaque(g, 'SALE', '#fff', '#d9423e', 1.8, 0.85, 0, 0.7, z, 2); }; // out on the apron, clear of the props behind it
// A special city's landmark stands on its plot at every level, so an upgrade is posted on a small gold sign at the front-left corner instead
export const level = (g: THREE.Group, lv: number, m: boolean) => {
  if (!lv) return;
  const [x, z] = SPOT;
  box(g, 0.1, 0.4, 0.1, 0x8a5a2b, x + 0.5, 0, z - 0.1); plaque(g, 'LV ' + lv, m ? '#8c8c8c' : '#ffd23f', '#23263a', 1.0, 0.5, x + 0.5, 0.35, z);
};
