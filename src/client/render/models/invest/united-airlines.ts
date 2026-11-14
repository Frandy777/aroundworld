import { box, cyl, final, floor, glass, plaque, GOLD, IRON, INK, type ModelDef } from '../../builder';

export default {
  key: 'United Airlines',
  props: [ // an airport apron: a jet at its stand between a glass terminal and the control tower, with a fuel truck, a baggage train, airstairs and traffic cones
    final((g) => {
      const Z = 0.25, WHITE = 0xf4f6fa, BLUE = 0x2447a8, NAVY = 0x1a2250, WING = 0xe3e8f2, GLASS = 0x7db6ff, DARK = 0x4a5170, YEL = 0xe0a020, RED = 0xd9423e; // Z: the jet's centre line
      const tube = (r: number, len: number, c: number, x: number, y: number, z: number) => { cyl(g, r, len, c, x, y - len / 2, z).rotation.z = Math.PI / 2; };                                         // a cylinder lying along x, centred at height y
      box(g, 2.2, 0.08, 1.9, 0x676c82); box(g, 0.06, 0.01, 0.62, GOLD, 0.66, 0.08, 0.64);                                                               // apron, the yellow lead-in line to the nose wheel
      box(g, 1.5, 0.22, 0.4, WHITE, 0, 0.28, Z); box(g, 1.5, 0.08, 0.28, WHITE, 0, 0.5, Z); box(g, 1.5, 0.08, 0.28, BLUE, 0, 0.2, Z);                    // airliner (nose to the right): body, rounded by a crown and a blue keel
      box(g, 0.12, 0.26, 0.34, WHITE, 0.81, 0.26, Z); box(g, 0.09, 0.2, 0.26, WHITE, 0.915, 0.29, Z); box(g, 0.06, 0.14, 0.16, DARK, 0.99, 0.32, Z);    // nose: two steps and the radome
      box(g, 0.1, 0.02, 0.22, NAVY, 0.78, 0.52, Z, glass(NAVY)); box(g, 0.08, 0.05, 0.02, NAVY, 0.84, 0.42, Z + 0.17, glass(NAVY)); // cockpit glass, on top and at the side
      box(g, 0.14, 0.26, 0.3, WHITE, -0.82, 0.3, Z); box(g, 0.1, 0.2, 0.18, WHITE, -0.94, 0.38, Z); box(g, 0.04, 0.08, 0.1, DARK, -1.01, 0.44, Z);      // tail cone, rising to the exhaust
      box(g, 0.36, 0.3, 0.06, BLUE, -0.73, 0.58, Z); box(g, 0.24, 0.26, 0.06, BLUE, -0.8, 0.88, Z); box(g, 0.2, 0.04, 0.76, WING, -0.9, 0.44, Z);       // fin in two steps, tailplane
      box(g, 0.14, 0.14, 0.02, 0xdce8ff, -0.74, 0.66, Z + 0.04); box(g, 0.14, 0.02, 0.03, BLUE, -0.74, 0.72, Z + 0.04); box(g, 0.02, 0.14, 0.03, BLUE, -0.74, 0.66, Z + 0.04); // the globe on the fin
      for (const s of [1, -1]) { // each side: a wing swept in three steps with its winglet, an engine under it, a main wheel
        [[0.64, 0.2, 0.02, 0.3], [0.5, 0.16, -0.08, 0.48], [0.36, 0.12, -0.18, 0.62]].forEach(([w, d, x, z]) => box(g, w, 0.05, d, WING, x, 0.28, Z + s * z));
        box(g, 0.1, 0.1, 0.03, BLUE, -0.3, 0.3, Z + s * 0.67); tube(0.075, 0.34, WING, 0.2, 0.25, Z + s * 0.42); tube(0.063, 0.03, NAVY, 0.37, 0.25, Z + s * 0.42);
        box(g, 0.04, 0.12, 0.04, IRON, 0.02, 0.08, Z + s * 0.13); box(g, 0.14, 0.07, 0.06, INK, 0.02, 0.08, Z + s * 0.13);
      }
      box(g, 0.04, 0.12, 0.04, IRON, 0.66, 0.08, Z); box(g, 0.1, 0.06, 0.12, INK, 0.66, 0.08, Z);                                                      // nose wheel
      for (let x = -0.6; x < 0.4; x += 0.11) box(g, 0.06, 0.06, 0.02, NAVY, x, 0.4, Z + 0.205, glass(NAVY)); // cabin windows
      box(g, 1.5, 0.04, 0.02, BLUE, 0, 0.28, Z + 0.205); box(g, 0.09, 0.16, 0.02, 0xaeb8d0, 0.55, 0.3, Z + 0.205);                                       // cheat line, forward door
      floor(g, 3, 1, 'glass', 0xdce8ff, 0.08, -0.35, -0.7); box(g, 1.62, 0.08, 0.62, BLUE, -0.35, 0.98, -0.7); plaque(g, '⊕', '#fff', '#2447a8', 1.1, 0.3, -0.35, 1.06, -0.46); // terminal: glass concourse, blue roof, its sign (the globe of the tail)
      box(g, 0.5, 0.3, 0.46, 0xe8e8ee, 0.82, 0.08, -0.7); box(g, 0.24, 1.0, 0.24, WHITE, 0.82, 0.38, -0.7); box(g, 0.26, 0.08, 0.26, BLUE, 0.82, 0.7, -0.7); // control tower: base, shaft, blue band
      box(g, 0.56, 0.08, 0.56, IRON, 0.82, 1.38, -0.7); box(g, 0.5, 0.26, 0.5, GLASS, 0.82, 1.46, -0.7, glass(GLASS)); box(g, 0.52, 0.04, 0.52, NAVY, 0.82, 1.56, -0.7); box(g, 0.62, 0.06, 0.62, WHITE, 0.82, 1.72, -0.7); // its cab: deck, glass, frame, roof
      box(g, 0.04, 0.3, 0.04, INK, 0.82, 1.78, -0.7); box(g, 0.3, 0.05, 0.06, WING, 0.82, 1.98, -0.7); box(g, 0.08, 0.08, 0.08, 0xff3b3b, 0.82, 2.08, -0.7); // mast, radar bar, beacon
      box(g, 0.6, 0.05, 0.22, IRON, 0.78, 0.12, 0.72); tube(0.1, 0.4, WHITE, 0.72, 0.29, 0.72); tube(0.105, 0.05, RED, 0.72, 0.29, 0.72);               // fuel truck: chassis, tank, red band
      box(g, 0.18, 0.2, 0.22, RED, 1.0, 0.12, 0.72); box(g, 0.1, 0.07, 0.02, GLASS, 1.0, 0.24, 0.83, glass(GLASS)); [0.6, 0.95].forEach((x) => box(g, 0.12, 0.1, 0.03, INK, x, 0.08, 0.84)); // cab, its window, wheels
      box(g, 0.2, 0.12, 0.14, YEL, -0.5, 0.08, 0.78); box(g, 0.1, 0.08, 0.12, 0xb87c14, -0.54, 0.2, 0.78);                                              // baggage tug and its cab
      [[-0.74, RED], [-0.98, 0x3f6fd0]].forEach(([x, c]) => { box(g, 0.22, 0.04, 0.16, IRON, x, 0.1, 0.78); box(g, 0.16, 0.1, 0.12, c, x, 0.14, 0.78); }); // two carts with a case each
      [0.06, 0.12, 0.18].forEach((h, i) => box(g, 0.14, h, 0.05, WING, 0.5, 0.08, 0.64 - i * 0.05)); box(g, 0.14, 0.02, 0.07, WING, 0.5, 0.26, 0.5);       // airstairs up to the forward door
      [0.84, 0.98].forEach((x) => { box(g, 0.05, 0.08, 0.05, 0xff8a1f, x, 0.08, 0.5); box(g, 0.055, 0.02, 0.055, 0xffffff, x, 0.12, 0.5); });                // two traffic cones
    }),
  ],
} satisfies ModelDef;
