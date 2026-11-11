import * as THREE from 'three';
import { shade } from '../art';
import { block, box, cyl, gable, lamplit, plaque, GOLD, INK, IRON } from '../builder';

// Buildings on the plot, built from whole storeys (see `block`: a taller house has more windows, never bigger ones): walls in the region's tint, the roofs, parapets and railings in the owner's colour, the trim white and gold;
// all of it grey when mortgaged. Each level has a silhouette and a storey count of its own (1, 2, 5), so they read apart at any zoom, and none is a stack of centred cubes: lv1 a cottage, an L of two gables with a chimney
// and a garden path; lv2 a villa, two floors of glass and timber stepped into an L under flat roofs, a balcony in the corner the upper floor leaves open, a pool in front; lv3 a slim glass tower on a glazed lobby, set back to one
// corner of it, a gold band at its foot, a crown lit white under the beacon. Relief (a stoop, a floor set back, the rim of a roof) is only what does not hide what is below it from this camera: a balcony is open, an overhang a hand's breadth.
// After dusk every window is a lamp of its own (see `block`: lit or dark, warm or cold) and the garden is lit by warm lamps, never in the owner's colour: the plot below is that colour, and glows, so a part that shone in it would
// melt into it. By day the lamps are plain trim (a building takes none of the fixed PointLights, see light.ts). A mortgaged building has them all out: the walls are grey, and its glass the glass of any other house.
const WARM = 0xffc070, COOL = 0xcfe6ff, BULB = 0xfff6b0; // the light of a path, that of a tower's crown, and a lamp's bulb (one of NEON, so unlit)
const TEAK = 0xc79058, WATER = 0x58c8f4, AQUA = 0x5ae0ff, PANE = 0xbfe6f5, HIGH = 0x6cc4dc; // a villa's timber, the water of its pool and the light that comes up through it, and its glass: pale in a rail and a skylight, aqua in its high windows
export function building(g: THREE.Group, lv: number, wall: number, roof: number, m: boolean) {
  const dim = (c: number) => (m ? 0x8c8c8c : c), gold = dim(GOLD), glass = dim(0xe4e9f4), grey = dim(0xcfd6e6), green = dim(0x4f9d4f), sand = dim(0xdad3c0), trim = dim(0xf4f4f4), lamps = !m;
  const teak = dim(TEAK), iron = dim(IRON), pane = dim(PANE), high = dim(HIGH);
  const lit = (c: number, light: number, k = 1) => (m ? undefined : lamplit(c, light, k));            // the material of a part that shines after dusk (k times over, in HDR), or none (its own, grey) when mortgaged
  const led = lit(roof, WARM, 0.7);                                                                     // a rail in the owner's colour by day, a strip of warm light after dusk
  const walk = (w: number, z: number) => box(g, w, 0.03, 1.72 - z, sand, 0, 0, (z + 1.72) / 2, lit(sand, WARM, 0.3)); // paving from the door (at depth z) to the front of the plot, inside its rim, warm after dusk
  const bed = (x: number, y: number, z: number, w: number) => { box(g, w, 0.1, 0.22, dim(0x8a5a2b), x, y, z); box(g, w - 0.08, 0.15, 0.14, green, x, y + 0.1, z, lit(green, WARM, 0.18)); }; // a planter, w long: a wooden box and its shrubs, which the lamps light
  const bulb = (x: number, y: number, z: number, s = 0.07) => box(g, s, s, s, dim(BULB), x, y, z);     // a lamp's bulb
  const parapet = (w: number, d: number, x: number, y: number, z: number, h: number, color: number, mt?: THREE.Material) => { // a low wall h high round a deck of w x d centred at (x, z), flush with the deck's edge
    for (const s of [-1, 1]) { box(g, w, h, 0.1, color, x, y, z + (s * (d - 0.1)) / 2, mt); box(g, 0.1, h, d - 0.2, color, x + (s * (w - 0.1)) / 2, y, z, mt); }
  };
  if (lv === 1) {
    block(g, 4, 3, 'win', wall, 0, 0, -0.2, lamps, 1); block(g, 2, 1, 'door', wall, 0, 0, 0.8, lamps, 2);    // the house, 2 x 1.5, and its entrance wing in front
    gable(g, 2.2, 1.7, 0.75, 0.9, roof, wall, 0, -0.2); gable(g, 1.2, 1.2, 0.55, 0.9, roof, wall, 0, 0.5, true); // its roof, the ridge along x, and the wing's gable across it
    box(g, 0.24, 0.9, 0.24, dim(0xa8503c), -0.65, 1.3, -0.4); box(g, 0.3, 0.05, 0.3, dim(0xa39a8c), -0.65, 2.15, -0.4); // chimney and its cap
    box(g, 0.26, 0.22, 0.02, dim(0x1a2250), 0, 1.0, 1.11); box(g, 0.18, 0.15, 0.03, dim(0x5b8fe8), 0, 1.04, 1.11, lit(0x5b8fe8, 0xffa63d)); // a window in the gable, lit after dusk
    walk(0.4, 1.05); bed(-0.76, 0, 0.68, 0.44); bed(0.76, 0, 0.68, 0.44);                                      // the path from the door, a flower bed under the windows either side
    for (const x of [-0.4, 0.4]) { box(g, 0.05, 0.4, 0.05, dim(INK), x, 0, 1.45); bulb(x, 0.4, 1.45, 0.11); }  // a lamp post either side of the path
  } else if (lv === 2) {
    // The villa: boxes stepped like a modern house, glass and timber under flat roofs. From this camera an overhang hides the wall under it and a covered balcony is a dark slot, so the balcony is the corner that the upper floor leaves open: its floor is the slab over the lounge, its back the glass of the rooms.
    block(g, 4, 4, 'foyer', wall, 0, 0, 0, lamps, 7); box(g, 2.12, 0.1, 2.12, trim, 0, 0.9);                    // the lounge, 2 x 2, the door in its last column; the slab over it
    block(g, 2, 2, 'lounge', wall, 1, -0.5, -0.5, lamps, 8); block(g, 2, 4, 'clad', teak, 1, 0.5, 0, lamps, 9); // over it an L: the glazed rooms at the back left, a block of timber over the door
    const flat = (w: number, d: number, x: number, y: number, z: number) => { box(g, w, 0.14, d, roof, x, y, z); box(g, w - 0.2, 0.03, d - 0.2, grey, x, y + 0.14, z); }; // a flat roof: concrete inside a rim of the owner's colour
    flat(1.1, 1.2, -0.55, 1.9, -0.5); box(g, 1, 0.3, 2, high, 0.5, 1.9, 0); box(g, 1.02, 0.05, 2.02, high, 0.5, 2.025, 0, lit(HIGH, WARM, 0.8)); flat(1.1, 2.2, 0.55, 2.2, 0); // the timber stands higher, on a band of high windows: dark glass after dusk, a thread of light across it
    box(g, 0.56, 0.04, 0.46, trim, -0.55, 2.07, -0.45); box(g, 0.44, 0.03, 0.34, pane, -0.55, 2.11, -0.45);       // a skylight over the rooms
    for (const z of [-0.65, 0, 0.65]) box(g, 0.7, 0.04, 0.5, green, 0.55, 2.37, z);                              // and a green roof, in beds
    box(g, 1.06, 0.04, 1.06, teak, -0.53, 1, 0.53); bed(-0.74, 1.04, 0.8, 0.5);                                   // the balcony's decking, a planter on it
    cyl(g, 0.09, 0.15, trim, -0.28, 1.04, 0.5); for (const z of [0.3, 0.7]) box(g, 0.1, 0.1, 0.1, iron, -0.28, 1.04, z); // a bistro table and its two chairs
    box(g, 1, 0.26, 0.03, pane, -0.53, 1.04, 1.03); box(g, 0.03, 0.26, 1, pane, -1.03, 1.04, 0.5);            // a balustrade of glass
    box(g, 1.06, 0.05, 0.07, roof, -0.53, 1.3, 1.03, led); box(g, 0.07, 0.05, 1, roof, -1.03, 1.3, 0.5, led);  // with a handrail in the owner's colour, which is lit after dusk
    for (const [x, z] of [[-1.03, 1.03], [-0.53, 1.03], [-0.03, 1.03], [-1.03, 0.5], [-1.03, 0]]) box(g, 0.05, 0.3, 0.05, iron, x, 1.04, z); // its posts
    for (const x of [-0.85, -0.53, -0.21]) bulb(x, 1.2, 1.03);                                                 // string lights under the rail
    box(g, 0.5, 0.05, 0.12, dim(0xbdbdbd), 0.75, 0, 1.06); box(g, 0.34, 0.03, 0.66, sand, 0.75, 0, 1.46, lit(sand, WARM, 0.3)); // the doorstep, and the path from it to the plot's front
    for (const x of [0.5, 1]) { cyl(g, 0.035, 0.2, iron, x, 0, 1.5); bulb(x, 0.2, 1.5, 0.08); }                     // a bollard light either side of it
    for (const x of [0.4, 1.1]) { cyl(g, 0.08, 0.08, dim(0x8a5a2b), x, 0, 1.13); for (const [r, y, h] of [[0.12, 0.08, 0.12], [0.085, 0.2, 0.1], [0.05, 0.3, 0.08]]) cyl(g, r, h, green, x, y, 1.13); } // a topiary in a tub either side of the door
    box(g, 1.3, 0.03, 0.76, teak, -0.55, 0, 1.42); box(g, 1.06, 0.07, 0.42, trim, -0.55, 0, 1.55); box(g, 0.94, 0.02, 0.3, dim(WATER), -0.55, 0.06, 1.55, lit(WATER, AQUA, 0.9)); // the pool: decking, coping, water that glows after dusk
    for (const x of [-0.85, -0.4]) { box(g, 0.34, 0.06, 0.16, trim, x, 0.03, 1.14); box(g, 0.1, 0.12, 0.16, trim, x - 0.12, 0.03, 1.14); box(g, 0.1, 0.07, 0.16, roof, x + 0.08, 0.09, 1.14); } // two loungers on the deck, a towel in the owner's colour on each
  } else {
    block(g, 4, 4, 'atrium', glass, 0, 0, 0, lamps, 5); box(g, 2.12, 0.1, 2.12, roof, 0, 0.79);                // the glazed lobby, 2 x 2, under a cornice in the owner's colour
    block(g, 3, 3, 'glass glass glass glass', glass, 0.9, -0.25, -0.25, lamps, 6); box(g, 1.62, 0.1, 1.62, gold, -0.25, 0.9, -0.25); // the tower, 1.5 x 1.5, on its back-left corner, a gold band at its foot
    parapet(1.58, 1.58, -0.25, 4.5, -0.25, 0.1, trim, lit(0xf4f4f4, COOL, 0.7)); box(g, 1.38, 0.04, 1.38, dim(0x6b7385), -0.25, 4.5, -0.25); // the crown: a rim of white light after dusk round a dark roof,
    box(g, 0.8, 0.35, 0.8, grey, -0.25, 4.54, -0.25);                                                          // the plant room on it
    box(g, 0.06, 0.8, 0.06, 0xdddddd, -0.25, 4.89, -0.25); box(g, 0.16, 0.16, 0.16, dim(0xff3b3b), -0.25, 5.69, -0.25); // mast and beacon
    walk(0.8, 1); bed(-0.45, 0.9, 0.75, 0.6); bed(0.45, 0.9, 0.75, 0.6);                                       // the path from the doors, planters on the podium's roof
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
