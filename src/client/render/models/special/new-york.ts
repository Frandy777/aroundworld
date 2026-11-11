import { box, cyl, decal, final, stone, GOLD, INK, IRON, type ModelDef } from '../../builder';

export default {
  key: 'New York',
  props: [ // Statue of Liberty: a verdigris copper figure on a granite pedestal inside the eleven-pointed star of Fort Wood on Liberty Island, torch raised in one hand and the tablet in the other under a crown of seven rays; trees and the Stars and Stripes on the lawn, a Staten Island ferry in the harbour
    final((g) => {
      const [SX, SZ, FY, P] = [0, -0.38, 0.46, 2.04];                                                                                                           // the monument's centre line, the top of Fort Wood, the top of the pedestal (the plinth she stands on)
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, GRASS = 0x4f9d4f, WALL = 0xcfc8b6, PATH = 0xdba596, FORT = 0xb4ab95, GR = 0xcbc3ae, GRL = 0xded8c6, GRD = 0xa9a08a, DARK = 0x3f392e;  // paints: sea, foam, lawn, seawall, the pink promenade, fort stone, granite in three tones, the loggia's shade
      const WOOD = 0x6e3a12, WHITE = 0xf4f6fa, NAVY = 0x1a2250, ORANGE = 0xf26b1d;                                                                              // trunks, the ferry's white paint, its windows, its orange
      const PAT = 0x5cc6a6, PATL = 0x8fe4cc, PATD = 0x419e83, PATDD = 0x2d7662, DGOLD = 0xe0a020;                                                               // the statue's verdigris in four tones, the flame's darker gold
      const rod = (x: number, y: number, len: number, a: number, w: number, c: number, z = SZ, d = w) => { box(g, w, len, d, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, z).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; };  // a bar standing on (x, y), len long, tipped over by a (to the viewer's left when positive); returns its tip
      const Y = (h: number) => P + h;                                                                                                                                   // a height above the plinth
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);                                                                           // the harbour, its shallows
      const isle = (r: number, h: number, c: number, y: number) => { cyl(g, r, h, c, SX, y, SZ + 0.08).scale.set(1.2, 1, 1); };                                                                 // a round slab of the island, wider than it is deep
      isle(0.95, 0.02, FOAM, 0.1); isle(0.9, 0.14, WALL, 0.1); isle(0.84, 0.03, PATH, 0.24); isle(0.78, 0.03, GRASS, 0.27);                                     // foam round the shore, the seawall, the pink promenade along it, the lawn
      const [N, D] = [11, 0.25];                                                                                                                                // Fort Wood's eleven bastions, each a diamond with this half-diagonal
      for (let k = 0; k < N; k++) { const a = (k * 2 * Math.PI) / N; stone(g, D * Math.SQRT2, 0.22, D * Math.SQRT2, FORT, SX + (0.8 - D) * Math.sin(a), 0.24, SZ + (0.8 - D) * Math.cos(a)).rotation.y = a + Math.PI / 4; }  // the star: a pointed bastion every 33 degrees
      cyl(g, 0.55, 0.22, FORT, SX, 0.24, SZ);                                                                                                                   // the keep inside it
      const ped = (m: typeof stone, w: number, h: number, y: number, c: number, d = w) => m(g, w, h, d, c, SX, y, SZ);                                                                                        // a course of the pedestal, on the monument's axis
      ped(stone, 1.06, 0.07, FY, GRL); ped(stone, 1, 0.07, FY + 0.07, GRL);                                                                                     // the stepped base
      ped(stone, 0.92, 0.32, 0.6, GR); ped(box, 0.99, 0.05, 0.92, GRL);                                                                                         // the lower plinth in rusticated granite, its cornice
      box(g, 0.16, 0.22, 0.02, DARK, SX, 0.62, SZ + 0.47); box(g, 0.22, 0.03, 0.03, GRL, SX, 0.84, SZ + 0.47);                                                  // the doorway and its lintel
      ped(stone, 0.84, 0.22, 0.97, GR); ped(box, 0.9, 0.05, 1.19, GRL);                                                                                         // the dado, a string course
      ped(box, 0.8, 0.46, 1.24, DARK);                                                                                                                          // the loggia: its dark back wall
      for (const s of [-1, 1]) stone(g, 0.12, 0.46, 0.84, GRD, SX + s * 0.34, 1.24, SZ);                                                                        // a rusticated pier at either end
      for (const x of [-0.24, -0.08, 0.08, 0.24]) box(g, 0.07, 0.46, 0.07, GRL, SX + x, 1.24, SZ + 0.41);                                                       // four columns across its front
      ped(box, 0.98, 0.07, 1.7, GRL); ped(box, 1.06, 0.05, 1.77, GR);                                                                                           // the cornice, the balcony slab
      box(g, 1.04, 0.1, 0.04, GRL, SX, 1.82, SZ + 0.51);                                                                                                        // the balustrade along the front
      for (const s of [-1, 1]) { box(g, 0.04, 0.1, 1, GRL, SX + s * 0.51, 1.82, SZ); box(g, 0.07, 0.14, 0.07, GRL, SX + s * 0.51, 1.82, SZ + 0.51); }           // along both sides, a post at each front corner
      ped(stone, 0.8, 0.16, 1.82, GR); ped(box, 0.76, 0.06, 1.98, PAT);                                                                                         // the plinth she stands on, its copper plate
      box(g, 0.14, 0.05, 0.2, PATD, SX + 0.1, P, SZ + 0.12); box(g, 0.14, 0.07, 0.2, PATD, SX - 0.12, P, SZ - 0.1);                                             // her feet, the right one raised behind
      box(g, 0.1, 0.02, 0.05, IRON, SX - 0.04, P, SZ + 0.24); box(g, 0.06, 0.02, 0.04, INK, SX + 0.04, P, SZ + 0.27);                                           // the broken chain at her feet
      box(g, 0.66, 0.1, 0.42, PATD, SX, P, SZ); box(g, 0.58, 0.9, 0.34, PATD, SX, Y(0.1), SZ);                                                                  // the hem of her robe, the skirt
      [[-0.29, 0.1, PAT, 0], [-0.19, 0.13, PATL, 0.03], [-0.06, 0.13, PAT, 0.05], [0.07, 0.12, PATD, 0.03], [0.19, 0.1, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.46, 0.04, c, SX + x + w / 2, Y(0.1), SZ + 0.17 + z));  // folds down the skirt
      [[-0.27, 0.12, PATL, 0.01], [-0.15, 0.14, PAT, 0.04], [-0.01, 0.14, PATD, 0.03], [0.13, 0.12, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.4, 0.04, c, SX + x + w / 2, Y(0.56), SZ + 0.17 + z));  // and over the hips
      box(g, 0.6, 0.3, 0.32, PAT, SX, Y(1), SZ); box(g, 0.52, 0.2, 0.3, PAT, SX - 0.03, Y(1.3), SZ); box(g, 0.36, 0.12, 0.28, PATL, SX - 0.02, Y(1.5), SZ);     // the bodice, narrowing to the shoulders
      rod(SX + 0.3, Y(0.55), 0.95, 0.58, 0.1, PATL, SZ + 0.2, 0.08); rod(SX + 0.14, Y(0.4), 0.8, 0.58, 0.07, PATD, SZ + 0.2, 0.06);                             // two long folds of the cloak across her body, one light, one dark
      box(g, 0.2, 0.36, 0.28, PAT, SX - 0.25, Y(1.4), SZ); box(g, 0.08, 0.5, 0.2, PATL, SX - 0.3, Y(1), SZ + 0.04);                                             // the shoulder under the raised arm, the sleeve's fold hanging down its outside
      const HX = SX - 0.015;                                                                                                                                    // the head's centre line
      box(g, 0.1, 0.16, 0.1, PATL, HX, Y(1.56), SZ);                                                                                                            // the neck
      box(g, 0.18, 0.2, 0.15, PATL, HX, Y(1.7), SZ); box(g, 0.22, 0.26, 0.1, PATD, HX, Y(1.66), SZ - 0.09);                                                     // the face, the hair behind it
      for (const s of [-1, 1]) box(g, 0.05, 0.22, 0.07, PATD, HX + s * 0.12, Y(1.5), SZ);                                                                       // a lock of hair down to either shoulder
      box(g, 0.25, 0.09, 0.19, PATD, HX, Y(1.9), SZ - 0.01);                                                                                                    // the diadem
      [-0.06, 0, 0.06].forEach((x) => box(g, 0.03, 0.05, 0.012, PATDD, HX + x, Y(1.92), SZ + 0.086));                                                           // its windows
      box(g, 0.14, 0.025, 0.012, PATDD, HX, Y(1.82), SZ + 0.076); box(g, 0.035, 0.08, 0.03, PAT, HX, Y(1.74), SZ + 0.085); box(g, 0.07, 0.015, 0.012, PATDD, HX, Y(1.72), SZ + 0.076);  // her stern brow, nose and mouth
      for (const s of [-1, 1]) box(g, 0.03, 0.025, 0.012, PATDD, HX + s * 0.04, Y(1.78), SZ + 0.076);                                                           // the deep-set eyes
      [90, 60, 30, 0, -30, -60, -90].forEach((d) => { const a = (d * Math.PI) / 180; rod(HX - 0.075 * Math.sin(a), Y(1.93) + 0.075 * Math.cos(a), 0.14, a, 0.05, PATL); });  // the seven rays of the crown, fanned out through half a circle
      const [hx] = rod(SX - 0.26, Y(1.65), 0.55, 0.05, 0.1, PAT, SZ + 0.01, 0.12);                                                                              // the raised arm, a hair off the vertical; hx: the torch's centre line
      box(g, 0.13, 0.2, 0.12, PATL, hx, Y(2.12), SZ + 0.02); box(g, 0.07, 0.4, 0.07, PATD, hx, Y(2.1), SZ); box(g, 0.1, 0.035, 0.1, PATDD, hx, Y(2.34), SZ);    // her hand, the torch's handle through it, a collar above the fist
      cyl(g, 0.075, 0.04, PATDD, hx, Y(2.4), SZ); cyl(g, 0.115, 0.035, PATD, hx, Y(2.44), SZ); cyl(g, 0.105, 0.05, PATL, hx, Y(2.475), SZ);                     // the gallery: its bowl, the platter, the railing
      [[0.12, 0.06, DGOLD], [0.14, 0.07, GOLD], [0.1, 0.07, GOLD], [0.06, 0.05, 0xfff6b0]].reduce((y, [w, h, c], i) => { box(g, w, h, w, c, hx + i * 0.01, y, SZ); return y + h; }, Y(2.525));  // the gilded flame, leaning a little, pale at its tip
      rod(SX + 0.27, Y(0.95), 0.62, 0.25, 0.15, PAT, SZ + 0.03, 0.2); box(g, 0.14, 0.1, 0.18, PATD, SX + 0.29, Y(0.9), SZ + 0.04);                              // the other arm, sloping out from the shoulder to the elbow, the cloth gathered there
      box(g, 0.22, 0.4, 0.05, PATD, SX + 0.4, Y(0.98), SZ + 0.2).rotation.z = -0.4; box(g, 0.16, 0.32, 0.03, PATL, SX + 0.4, Y(1.02), SZ + 0.225).rotation.z = -0.4;  // the tablet, tipped outward: its frame, its face
      box(g, 0.08, 0.1, 0.08, PATL, SX + 0.47, Y(1.05), SZ + 0.2);                                                                                              // her hand on its edge
      const fx = 0.72;                                                                                                                                          // the ferry's centre
      box(g, 0.7, 0.1, 0.22, ORANGE, fx, 0.1, 0.74); box(g, 0.72, 0.03, 0.225, INK, fx, 0.1, 0.74); box(g, 0.1, 0.1, 0.16, ORANGE, fx + 0.38, 0.1, 0.74);       // the Staten Island ferry: its orange hull, the dark waterline, the narrow bow
      box(g, 0.58, 0.1, 0.19, WHITE, fx - 0.03, 0.2, 0.74); box(g, 0.52, 0.04, 0.02, NAVY, fx - 0.03, 0.23, 0.84);                                              // the main deck and its windows
      box(g, 0.42, 0.09, 0.16, WHITE, fx - 0.05, 0.3, 0.74); box(g, 0.36, 0.035, 0.02, NAVY, fx - 0.05, 0.33, 0.82); box(g, 0.46, 0.025, 0.18, ORANGE, fx - 0.05, 0.39, 0.74);  // the upper deck, its windows, the orange roof
      box(g, 0.16, 0.09, 0.12, WHITE, fx + 0.2, 0.3, 0.74); box(g, 0.12, 0.04, 0.02, NAVY, fx + 0.2, 0.33, 0.8);                                                // the wheelhouse and its glass
      box(g, 0.1, 0.22, 0.1, ORANGE, fx - 0.18, 0.415, 0.74); box(g, 0.105, 0.03, 0.105, INK, fx - 0.18, 0.635, 0.74);                                          // the funnel, its black cap
      box(g, 0.76, 0.012, 0.03, FOAM, fx, 0.1, 0.86); box(g, 0.08, 0.012, 0.22, FOAM, fx + 0.45, 0.1, 0.74);                                                    // foam along the hull and at the bow
      [[-1, -0.2], [1, -0.2], [-0.86, 0.22]].forEach(([x, z]) => { box(g, 0.05, 0.2, 0.05, WOOD, x, 0.27, z); cyl(g, 0.15, 0.12, 0x2f7a4a, x, 0.42, z); cyl(g, 0.12, 0.11, 0x3f9a5c, x, 0.52, z); cyl(g, 0.07, 0.09, 0x4fb06a, x, 0.61, z); });  // three trees on the island: a trunk and three tiers of leaves
      box(g, 0.03, 0.9, 0.03, 0xdddddd, 0.62, 0.3, 0.3); box(g, 0.05, 0.05, 0.05, GOLD, 0.62, 1.2, 0.3); decal(g, ['uuurrrr', 'uuuwwww', 'rrrrrrr', 'wwwwwww'], 0.8, 1, 0.31);  // the Stars and Stripes on its mast: a blue canton over the stripes
      [[-0.9, 0.78], [-0.4, 0.9], [0.1, 0.93]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                                            // ripples on the harbour
    }),
  ],
} satisfies ModelDef;
