import { box, final, floor, IRON, INK, type ModelDef } from '../../builder';

export default {
  key: 'build',
  props: [ // a tower going up: glass floors below, a bare frame and concrete core above, a crane hanging a bundle of beams over it; hazard kerb, cabin and materials at the foot
    final((g) => {
      const [tx, tz, mx, mz, jy, hx] = [-0.3, -0.35, 0.8, -0.5, 5.25, -0.62], YEL = 0xffc83d, DARK = 0x333333;     // tower centre (1.5 x 1.0), crane mast, jib height, hook
      box(g, 2.1, 0.08, 1.7, 0xb9b2a0);                                                                          // site ground
      for (const y of [0.08, 0.98]) floor(g, 3, 2, 'glass', 0xdce8ff, y, tx, tz);                                // glazed storeys
      [1.88, 2.78].forEach((y, k) => {                                                                           // bare storeys: a slab, a yellow guard rail, posts (the top ones end in rebar)
        box(g, 1.6, 0.1, 1.1, 0xd4d8e4, tx, y, tz); box(g, 1.5, 0.04, 0.04, YEL, tx, y + 0.5, tz + 0.52);
        for (const x of [-0.7, -0.23, 0.23, 0.7]) for (const z of [-0.45, 0.45]) { box(g, 0.1, 0.8, 0.1, 0x8f97ad, tx + x, y + 0.1, tz + z); if (k) box(g, 0.04, 0.25, 0.04, 0x7a4a2a, tx + x, y + 0.9, tz + z); }
      });
      box(g, 0.5, 2, 0.6, 0x6c7390, tx + 0.35, 1.88, tz - 0.1);                                                  // the core runs ahead of the floors
      box(g, 0.5, 0.2, 0.5, 0x8a8fa3, mx, 0.08, mz); box(g, 0.2, jy - 0.28, 0.2, YEL, mx, 0.28, mz);            // crane: base, mast
      for (let y = 0.5; y < jy; y += 0.4) box(g, 0.26, 0.06, 0.26, 0xe0a020, mx, y, mz);                          // rungs
      for (const y of [jy, jy + 0.24]) box(g, 2.15, 0.06, 0.2, YEL, 0.125, y, mz);                                // jib chords
      for (let x = -0.9; x < 1.2; x += 0.25) box(g, 0.05, 0.3, 0.2, YEL, x, jy, mz);                              // jib struts
      box(g, 0.2, 0.3, 0.26, IRON, 1.05, jy - 0.3, mz); box(g, 0.3, 0.3, 0.3, 0xf4f6fa, mx - 0.3, jy - 0.3, mz); box(g, 0.2, 0.14, 0.04, 0x7db6ff, mx - 0.3, jy - 0.2, mz + 0.16); // counterweight, cab
      box(g, 0.14, 0.45, 0.14, YEL, mx, jy + 0.3, mz); box(g, 0.14, 0.14, 0.14, 0xff3b3b, mx, jy + 0.75, mz);    // apex, beacon
      box(g, 0.18, 0.1, 0.24, DARK, hx, jy - 0.1, mz); box(g, 0.04, 0.36, 0.04, DARK, hx, jy - 0.46, mz); box(g, 0.14, 0.14, 0.14, 0xd9423e, hx, jy - 0.6, mz); // trolley, cable, hook
      for (let i = 0; i < 3; i++) box(g, 0.8, 0.1, 0.14, i & 1 ? 0xd9684a : 0xc2523a, hx, jy - 0.9 + i * 0.1, mz); // the bundle of beams hung from it
      box(g, 2.1, 0.07, 0.1, YEL, 0, 0.08, 0.75); for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) box(g, 0.2, 0.08, 0.1, INK, x, 0.08, 0.75); // hazard kerb
      box(g, 0.55, 0.38, 0.38, 0xdfe3ee, -0.72, 0.08, 0.42); box(g, 0.62, 0.05, 0.44, 0x4f6fc0, -0.72, 0.46, 0.42); box(g, 0.2, 0.12, 0.03, 0x7db6ff, -0.8, 0.26, 0.62); // cabin: body, roof, window
      box(g, 0.44, 0.3, 0.3, 0xc86b3c, 0.1, 0.08, 0.42); box(g, 0.44, 0.04, 0.3, 0xe0906a, 0.1, 0.38, 0.42); box(g, 0.45, 0.02, 0.31, 0xa8503c, 0.1, 0.23, 0.42); // bricks
      [[0.56, 0.4], [0.4, 0.3], [0.22, 0.18]].forEach(([w, d], i) => box(g, w, 0.1, d, 0xd8c08a, 0.82, 0.08 + i * 0.1, 0.45)); // sand heap
    }),
  ],
} satisfies ModelDef;
