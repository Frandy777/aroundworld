import { block, box, cyl, IRON } from '../../builder';
import { WARM, type Kit } from './kit';

const TEAK = 0xc79058, WATER = 0x58c8f4, AQUA = 0x5ae0ff, PANE = 0xbfe6f5, HIGH = 0x6cc4dc; // the villa's timber, the water of its pool and the light that comes up through it, and its glass: pale in a rail and a skylight, aqua in its high windows

// Lv 2 — a villa: two floors of glass and timber stepped into an L under flat roofs, a balcony in the corner the upper floor leaves open, a pool in front.
// From this camera an overhang hides the wall under it and a covered balcony is a dark slot, so the balcony is the corner that the upper floor leaves open: its floor is the slab over the lounge, its back the glass of the rooms.
export function villa(k: Kit) {
  const { g, wall, roof, lamps, dim, lit, sand, green, trim, grey, bed, bulb } = k;
  const teak = dim(TEAK), iron = dim(IRON), pane = dim(PANE), high = dim(HIGH);
  const led = lit(roof, WARM, 0.7);                                                                          // a rail in the owner's colour by day, a strip of warm light after dusk
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
  for (const x of [0.5, 1]) { cyl(g, 0.035, 0.2, iron, x, 0, 1.5); bulb(x, 0.2, 1.5, 0.11); }                     // a bollard light either side of it
  for (const x of [0.4, 1.1]) { cyl(g, 0.08, 0.08, dim(0x8a5a2b), x, 0, 1.13); for (const [r, y, h] of [[0.12, 0.08, 0.12], [0.085, 0.2, 0.1], [0.05, 0.3, 0.08]]) cyl(g, r, h, green, x, y, 1.13); } // a topiary in a tub either side of the door
  box(g, 1.3, 0.03, 0.76, teak, -0.55, 0, 1.42); box(g, 1.06, 0.07, 0.42, trim, -0.55, 0, 1.55); box(g, 0.94, 0.02, 0.3, dim(WATER), -0.55, 0.06, 1.55, lit(WATER, AQUA, 0.9)); // the pool: decking, coping, water that glows after dusk
  for (const x of [-0.85, -0.4]) { box(g, 0.34, 0.06, 0.16, trim, x, 0.03, 1.14); box(g, 0.1, 0.12, 0.16, trim, x - 0.12, 0.03, 1.14); box(g, 0.1, 0.07, 0.16, roof, x + 0.08, 0.09, 1.14); } // two loungers on the deck, a towel in the owner's colour on each
}
