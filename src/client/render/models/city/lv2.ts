import { block, box, cyl, IRON, INK } from '../../builder';
import type { Kit } from './kit';

const TEAK = 0xc79058, PANE = 0xbfe6f5, HIGH = 0x6cc4dc, GRAPHITE = 0x3a3c44; // the villa's timber, its glass (pale in a balustrade and a skylight, aqua in its high windows), and the dark of its solar panels and stones

// Lv 2 — a villa: two floors of glass and timber stepped into an L under flat roofs, a balcony in the corner the upper floor leaves open, a terrace in front.
// From this camera an overhang hides the wall under it and a covered balcony is a dark slot, so the balcony is the corner that the upper floor leaves open: its floor is the slab over the lounge, its back the glass of the rooms.
// What is not the owner's here is white, sand, timber, graphite or black, never a blue or a green (players' colours): the owner's colour is what the villa is known by, by day (the high roof's rim, rail, cushions, tubs, lamps) and after dusk,
// when everything on it that shines but its windows and string lights shines in that colour, and the windows are fewer and dimmer than a house's. The lower roof is no one's: framed in black, and unlit.
export function villa(k: Kit) {
  const { g, wall, roof, lamps, dim, lit, sand, trim, grey } = k;
  const teak = dim(TEAK), iron = dim(IRON), ink = dim(INK), pane = dim(PANE), high = dim(HIGH), graphite = dim(GRAPHITE);
  const led = lit(roof, roof, 1.2);                                                                          // the owner's colour by day, a strip of light in it after dusk
  const bulb = lit(trim, 0xffffff, 1);                                                                       // white, by day and by night: bulbs of the owner's colour would melt into the strip they hang from
  block(g, 4, 4, 'foyer', wall, 0, 0, 0, lamps, 7); box(g, 2.12, 0.1, 2.12, trim, 0, 0.9);                    // the lounge, 2 x 2, the door in its last column; the slab over it
  block(g, 2, 2, 'lounge', wall, 1, -0.5, -0.5, lamps, 8); block(g, 2, 4, 'clad', teak, 1, 0.5, 0, lamps, 9); // over it an L: the glazed rooms at the back left, a block of timber over the door
  const flat = (w: number, d: number, x: number, y: number, z: number, rim: number, mt?: typeof led) => { box(g, w, 0.14, d, rim, x, y, z, mt); box(g, w - 0.2, 0.03, d - 0.2, grey, x, y + 0.14, z); }; // a flat roof: concrete inside a rim, which shines after dusk if it is given a light
  flat(1.1, 1.2, -0.55, 1.9, -0.5, ink); box(g, 1, 0.3, 2, high, 0.5, 1.9, 0); box(g, 1.02, 0.05, 2.02, high, 0.5, 2.025, 0, lit(HIGH, roof, 0.8)); flat(1.1, 2.2, 0.55, 2.2, 0, roof, led); // the lower roof is framed in black and no one's, dark after dusk; the timber stands higher, on a band of high windows: dark glass after dusk, a thread of the owner's light across it, and a rim of it round the roof
  box(g, 0.56, 0.04, 0.46, trim, -0.55, 2.07, -0.45); box(g, 0.44, 0.03, 0.34, pane, -0.55, 2.11, -0.45); // a skylight over the rooms, of plain glass
  for (const z of [-0.65, 0, 0.65]) box(g, 0.7, 0.04, 0.5, graphite, 0.55, 2.45, z).rotation.x = 0.3;         // and solar panels on the higher roof, each raised at the back to face the street
  box(g, 1.06, 0.04, 1.06, teak, -0.53, 1, 0.53); box(g, 0.5, 0.1, 0.22, trim, -0.74, 1.04, 0.8); box(g, 0.44, 0.05, 0.16, roof, -0.74, 1.14, 0.8); // the balcony's decking, a daybed on it with a cushion in the owner's colour
  cyl(g, 0.09, 0.15, trim, -0.28, 1.04, 0.5); for (const z of [0.3, 0.7]) box(g, 0.1, 0.1, 0.1, iron, -0.28, 1.04, z); // a bistro table and its two chairs
  box(g, 1, 0.26, 0.03, pane, -0.53, 1.04, 1.03); box(g, 0.03, 0.26, 1, pane, -1.03, 1.04, 0.5);            // a balustrade of glass
  box(g, 1.06, 0.05, 0.07, roof, -0.53, 1.3, 1.03, led); box(g, 0.07, 0.05, 1, roof, -1.03, 1.3, 0.5, led);  // with a handrail in the owner's colour, which shines after dusk
  for (const [x, z] of [[-1.03, 1.03], [-0.53, 1.03], [-0.03, 1.03], [-1.03, 0.5], [-1.03, 0]]) box(g, 0.05, 0.3, 0.05, iron, x, 1.04, z); // its posts
  for (const x of [-0.85, -0.53, -0.21]) box(g, 0.085, 0.085, 0.085, trim, x, 1.2, 1.03, bulb);              // string lights under the rail
  box(g, 0.5, 0.05, 0.12, dim(0xbdbdbd), 0.75, 0, 1.06); box(g, 0.34, 0.03, 0.66, sand, 0.75, 0, 1.46);      // the doorstep, and the path from it to the plot's front
  for (const x of [0.5, 1]) { cyl(g, 0.035, 0.2, iron, x, 0, 1.5); box(g, 0.11, 0.11, 0.11, roof, x, 0.2, 1.5, led); } // a bollard light either side of it, bright enough not to melt into the plot, which is that colour
  for (const x of [0.4, 1.1]) { cyl(g, 0.1, 0.12, roof, x, 0, 1.13); for (const [r, y, h] of [[0.09, 0.12, 0.1], [0.065, 0.22, 0.09], [0.04, 0.31, 0.08]]) cyl(g, r, h, graphite, x, y, 1.13); } // a stack of stones in a tub the owner's colour either side of the door
  box(g, 1.3, 0.03, 0.76, sand, -0.55, 0, 1.42); box(g, 0.9, 0.1, 0.22, trim, -0.6, 0.03, 1.2); box(g, 0.9, 0.17, 0.05, trim, -0.6, 0.03, 1.09); // the terrace: paving, and a sofa against the glass
  for (const x of [-0.9, -0.3]) box(g, 0.2, 0.06, 0.15, roof, x, 0.13, 1.21); cyl(g, 0.13, 0.06, trim, -0.6, 0.03, 1.55); // a cushion in the owner's colour at each end of it, a low table in front
}
