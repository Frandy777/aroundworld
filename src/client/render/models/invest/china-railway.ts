import { box, final, floor, glass, hip, plaque, GOLD, IRON, INK, type ModelDef } from '../../builder';

export default {
  key: 'China Railway',
  props: [ // a high-speed rail station: a white train at its platform under the overhead wire, a station hall with a stepped red roof, a signal shed, a signal and a second track
    final((g) => {
      const Z = 0.18, WHITE = 0xf4f6fa, RED = 0xd9423e, NAVY = 0x23338f, STEEL = 0x7b86a0, DARK = 0x333a52, CREAM = 0xf0e6c8, TILE = 0x9c2f2f; // Z: the train's centre line
      box(g, 2.2, 0.08, 1.9, 0xb9b2a0);                                                                                                           // station ground
      for (const z of [Z, 0.7]) { // two tracks: ballast, sleepers, rails
        box(g, 2.2, 0.05, 0.5, 0x8d887a, 0, 0.08, z);
        for (let x = -1; x < 1.05; x += 0.2) box(g, 0.08, 0.03, 0.42, 0x5a3a1a, x, 0.13, z);
        for (const s of [-0.13, 0.13]) box(g, 2.2, 0.03, 0.03, 0xb4bccf, 0, 0.16, z + s);
      }
      box(g, 1.9, 0.08, 0.3, DARK, -0.04, 0.17, Z); [-0.8, -0.3, 0.1, 0.5].forEach((x) => box(g, 0.22, 0.1, 0.03, INK, x, 0.15, Z + 0.16));          // train (nose to the right): underframe and bogies
      box(g, 0.96, 0.36, 0.4, WHITE, -0.56, 0.26, Z); box(g, 0.64, 0.36, 0.4, WHITE, 0.28, 0.26, Z);                                                // two cars
      [[0.66, 0.12, 0.36, 0.34], [0.77, 0.1, 0.3, 0.3], [0.86, 0.08, 0.22, 0.24], [0.93, 0.06, 0.14, 0.16]].forEach(([x, l, w, h]) => box(g, l, h, w, WHITE, x, 0.26, Z)); // nose in four steps
      [-0.9, -0.72, -0.54, -0.36, -0.18, 0.02, 0.2, 0.38].forEach((x) => box(g, 0.11, 0.11, 0.02, NAVY, x, 0.44, Z + 0.205, glass(NAVY))); // windows
      [-0.12, 0.52].forEach((x) => box(g, 0.1, 0.24, 0.02, 0x8e98b4, x, 0.28, Z + 0.205));                                                          // doors
      box(g, 0.96, 0.05, 0.02, RED, -0.56, 0.3, Z + 0.205); box(g, 0.64, 0.05, 0.02, RED, 0.28, 0.3, Z + 0.205);                                    // red stripe, along both cars
      [[0.66, 0.185], [0.77, 0.155], [0.86, 0.115]].forEach(([x, z]) => box(g, 0.1, 0.05, 0.02, RED, x, 0.3, Z + z));                                // and round the nose
      box(g, 0.1, 0.02, 0.24, NAVY, 0.66, 0.6, Z, glass(NAVY)); box(g, 0.1, 0.02, 0.2, NAVY, 0.77, 0.56, Z, glass(NAVY)); box(g, 0.1, 0.08, 0.02, NAVY, 0.66, 0.46, Z + 0.185, glass(NAVY)); // driver's windscreen and side window
      [-0.75, 0.3].forEach((x) => box(g, 0.3, 0.05, 0.24, 0xcfd6e6, x, 0.62, Z));                                                                    // air-conditioning units
      box(g, 0.22, 0.03, 0.14, DARK, -0.38, 0.62, Z); box(g, 0.04, 0.16, 0.04, DARK, -0.44, 0.65, Z); box(g, 0.04, 0.16, 0.04, DARK, -0.34, 0.77, Z); box(g, 0.1, 0.03, 0.3, DARK, -0.34, 0.92, Z); // pantograph
      for (const x of [-0.65, 0.55]) { box(g, 0.05, 1.05, 0.05, STEEL, x, 0.18, -0.04); box(g, 0.05, 0.04, 0.28, STEEL, x, 1.1, 0.1); box(g, 0.03, 0.12, 0.03, STEEL, x, 0.97, Z); } // masts, their arms and droppers
      box(g, 2.2, 0.03, 0.03, STEEL, 0, 1.1, Z); box(g, 2.2, 0.03, 0.03, STEEL, 0, 0.95, Z);                                                         // the overhead wire and its carrier
      box(g, 2.2, 0.1, 0.4, 0xd6d0c0, 0, 0.08, -0.26); box(g, 2.2, 0.01, 0.04, GOLD, 0, 0.18, -0.09);                                              // platform, its yellow edge
      floor(g, 3, 1, 'lobby', CREAM, 0.08, 0.35, -0.7); floor(g, 3, 1, 'win', CREAM, 0.98, 0.35, -0.7);                                             // station hall: doors below, windows above
      box(g, 1.7, 0.1, 0.7, TILE, 0.35, 1.88, -0.7); box(g, 1.3, 0.1, 0.54, RED, 0.35, 1.98, -0.7); box(g, 0.8, 0.1, 0.38, TILE, 0.35, 2.08, -0.7); box(g, 0.1, 0.16, 0.1, GOLD, 0.35, 2.18, -0.7); // stepped roof, gold finial
      plaque(g, 'CRH', '#d9423e', '#fff', 0.7, 0.3, 0.35, 0.62, -0.5, 'neon');                                                                      // its sign over the doors
      box(g, 0.6, 0.36, 0.36, 0xd8c08a, -0.75, 0.08, -0.72); hip(g, 0.76, 0.5, 0.2, 0.44, TILE, -0.75, -0.72); box(g, 0.14, 0.22, 0.02, 0x8a5a2b, -0.75, 0.08, -0.53); // signal shed: walls, roof, door
      [-0.2, -0.95].forEach((x) => { box(g, 0.04, 0.55, 0.04, IRON, x, 0.18, -0.2); box(g, 0.12, 0.04, 0.08, INK, x, 0.73, -0.2); box(g, 0.06, 0.03, 0.05, 0xfff6b0, x, 0.7, -0.2); }); // platform lamps
      box(g, 0.3, 0.05, 0.1, 0x8a5a2b, -0.55, 0.26, -0.33); box(g, 0.26, 0.08, 0.04, 0x8a5a2b, -0.55, 0.31, -0.37);                                // bench, with its back
      box(g, 0.04, 0.5, 0.04, IRON, 1.04, 0.08, 0.44); box(g, 0.08, 0.16, 0.06, INK, 1.04, 0.5, 0.44); box(g, 0.04, 0.04, 0.02, 0xff3b3b, 1.04, 0.6, 0.475); // signal, at red
      box(g, 0.14, 0.04, 0.34, IRON, -1.0, 0.13, 0.7); box(g, 0.1, 0.14, 0.3, RED, -1.0, 0.17, 0.7);                                               // buffer stop at the end of the second track
    }),
  ],
} satisfies ModelDef;
