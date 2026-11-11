import * as THREE from 'three';
import { box, cyl, final, part, prism, prismMat, GOLD, INK, type ModelDef } from '../../builder';

export default {
  key: 'Hong Kong',
  props: [ // Bank of China Tower: four glass prisms stepping up to twin masts on a granite podium with flags, a rock garden with a red bridge over its pond, and Victoria Harbour with a red-sailed junk and a Star Ferry
    final((g) => {
      const HW = 0.6, MOD = 1.1, RISE = 0.5, TX = -0.4, TZ = -0.35, BASE = 0.44, RED = 0xd9423e, WHITE = 0xf4f6fa, GREEN = 0x2f8f5a, WOOD = 0x6e3a12, TAR = 0x3a2008, PANE = 0xe8edf6, ROCK = 0x8a8f9c, SHRUB = 0x4f9d4f; // the prisms' half-width, storey module and roof rise, the tower's centre and base height; paints
      const disc = (p: THREE.Group, r: number, t: number, c: number, x: number, y: number, z: number) => { cyl(p, r, t, c, x, y - t / 2, z).rotation.x = Math.PI / 2; };                                               // a cylinder facing the viewer, centred at height y
      const peak = (d: number) => BASE + 4 * MOD + (RISE * (HW - d)) / HW;                                                                                         // the tallest roof's height, d from the tower's centre line
      box(g, 2.4, 0.1, 1.9, 0x3a86e0); box(g, 2.4, 0.06, 1.42, 0xb9bdc8, 0, 0.1, -0.24); box(g, 2.4, 0.03, 0.05, 0xe6e9f0, 0, 0.16, 0.42);                   // the harbour, the plaza on it, its kerb
      box(g, 1.46, 0.14, 1.37, 0x8a92a3, -0.39, 0.16, -0.265); box(g, 1.34, 0.14, 1.27, 0xb3bac8, TX, 0.3, -0.315);                                         // the granite podium in two courses
      [[0, 1], [-Math.PI / 2, 2], [Math.PI, 3], [Math.PI / 2, 4]].forEach(([r, n]) => { part(g, prism(HW, n * MOD, RISE, MOD), 0, prismMat(HW, MOD), TX, BASE, TZ).rotation.y = r; }); // the four prisms, south, west, north, east: one module taller each
      box(g, 0.05, 1, 0.05, INK, TX + 0.1, peak(0.1) - 0.03, TZ); box(g, 0.05, 0.75, 0.05, INK, TX + 0.26, peak(0.26) - 0.03, TZ); box(g, 0.07, 0.07, 0.07, 0xff3b3b, TX + 0.1, peak(0.1) + 0.97, TZ); // the twin masts on the tallest roof, a beacon on the higher one
      box(g, 0.46, 0.34, 0.03, PANE, TX, BASE, 0.265); box(g, 0.36, 0.28, 0.03, 0x1d2c4d, TX, BASE, 0.285); box(g, 0.025, 0.28, 0.035, PANE, TX, BASE, 0.287); // the entrance: frame, dark glass doors, the bar between them
      disc(g, 0.075, 0.03, RED, TX, 0.89, 0.265); disc(g, 0.052, 0.04, 0xffffff, TX, 0.89, 0.265); box(g, 0.036, 0.036, 0.05, RED, TX, 0.872, 0.265);          // the bank's coin over it, between the braces: red disc, white ring, red square hole
      for (const d of [-0.31, 0.31]) { box(g, 0.16, 0.1, 0.07, 0x9aa1b0, TX + d, BASE, 0.285); box(g, 0.13, 0.1, 0.05, SHRUB, TX + d, BASE + 0.1, 0.285); }   // a planter either side of the entrance
      for (const x of [-1.04, 0.22]) { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.3, 0.37); box(g, 0.3, 0.18, 0.02, RED, x + 0.165, 1.02, 0.37); }                // a flagpole at each front corner of the podium, with a red flag
      box(g, 0.06, 0.06, 0.025, GOLD, -0.98, 1.14, 0.375); box(g, 0.025, 0.025, 0.025, GOLD, -0.91, 1.17, 0.375); box(g, 0.025, 0.025, 0.025, GOLD, -0.91, 1.1, 0.375); // the Chinese flag's stars
      box(g, 0.08, 0.08, 0.025, 0xffffff, 0.38, 1.07, 0.375);                                                                                                // the Hong Kong flag's bauhinia
      box(g, 0.6, 0.06, 0.44, 0xd8d2c0, 0.82, 0.16, -0.02); box(g, 0.5, 0.04, 0.34, 0x4da3ff, 0.82, 0.17, -0.02);                                           // the garden pond: stone coping, water
      [[0.26, 0.22, 0.2, 0.97, -0.34, ROCK], [0.2, 0.34, 0.16, 0.8, -0.38, 0x767b8a], [0.14, 0.16, 0.14, 0.62, -0.32, 0x9a9fac]].forEach(([w, h, d, x, z, c]) => box(g, w, h, d, c, x, 0.16, z)); // three rocks behind it
      box(g, 0.12, 0.12, 0.1, ROCK, 0.82, 0.5, -0.38); box(g, 0.06, 0.3, 0.02, 0xbfe6ff, 0.8, 0.2, -0.29);                                                   // a stone on the tallest rock, the waterfall down its front
      box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.68, 0.21, 0.04); box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.96, 0.21, 0.1);                                           // two goldfish
      box(g, 0.2, 0.04, 0.1, RED, 0.6, 0.22, -0.02); box(g, 0.22, 0.04, 0.1, RED, 1.04, 0.22, -0.02); box(g, 0.3, 0.04, 0.1, RED, 0.82, 0.26, -0.02); box(g, 0.62, 0.025, 0.02, 0xf4eedb, 0.82, 0.3, 0.03); // the red bridge over it: two ramps, the arch, a white rail
      box(g, 0.06, 0.3, 0.06, WOOD, 1.05, 0.16, -0.72); [[0.34, 0x2f7a4a], [0.26, 0x3f9a5c], [0.18, 0x4fb06a]].forEach(([w, c], i) => box(g, w, 0.16, w, c, 1.05, 0.4 + i * 0.14, -0.72)); // a pine: trunk, three tiers of needles
      box(g, 0.18, 0.14, 0.16, SHRUB, 0.45, 0.16, 0.3); box(g, 0.18, 0.14, 0.16, SHRUB, 1.08, 0.16, 0.36);                                                   // two shrubs
      const jx = -0.8;                                                                                                                                       // the junk's centre
      box(g, 0.68, 0.03, 0.21, TAR, jx, 0.1, 0.74); box(g, 0.66, 0.1, 0.2, WOOD, jx, 0.13, 0.74);                                                            // the junk: a tarred waterline, the hull
      box(g, 0.16, 0.2, 0.2, WOOD, jx + 0.25, 0.13, 0.74); box(g, 0.18, 0.03, 0.22, 0x8a5a2b, jx + 0.25, 0.33, 0.74); box(g, 0.1, 0.16, 0.18, WOOD, jx - 0.35, 0.13, 0.74); // the raised stern and its roof, the upturned bow
      [[-0.22, 0.5], [-0.03, 0.62], [0.16, 0.4]].forEach(([dx, h]) => {                                                                                       // three masts, each with a battened sail
        box(g, 0.025, h + 0.08, 0.025, TAR, jx + dx, 0.23, 0.74); box(g, 0.14, h, 0.03, RED, jx + dx + 0.055, 0.25, 0.74);                                  // the mast, the sail
        for (const k of [1, 2]) box(g, 0.14, 0.018, 0.035, 0x8a1f1f, jx + dx + 0.055, 0.25 + (k * h) / 3, 0.74);                                             // two battens across it
      });
      box(g, 0.08, 0.04, 0.015, GOLD, jx + 0.01, 0.93, 0.74);                                                                                                // a pennant at the main masthead
      const fx = 0.8;                                                                                                                                        // the ferry's centre
      box(g, 0.64, 0.1, 0.2, WHITE, fx, 0.1, 0.74); box(g, 0.65, 0.035, 0.205, GREEN, fx, 0.1, 0.74); box(g, 0.08, 0.1, 0.14, WHITE, fx + 0.35, 0.1, 0.74);   // the Star Ferry: hull, its green band, the narrow bow
      box(g, 0.52, 0.09, 0.17, WHITE, fx - 0.02, 0.2, 0.74); box(g, 0.46, 0.035, 0.02, INK, fx - 0.02, 0.23, 0.835);                                         // the main deck and its windows
      box(g, 0.42, 0.08, 0.15, WHITE, fx - 0.05, 0.29, 0.74); box(g, 0.36, 0.03, 0.02, INK, fx - 0.05, 0.32, 0.82);                                          // the upper deck and its windows
      box(g, 0.46, 0.025, 0.18, GREEN, fx - 0.05, 0.37, 0.74); box(g, 0.07, 0.1, 0.07, GREEN, fx + 0.03, 0.395, 0.74);                                       // the green roof, the funnel
      [[-0.3, 0.9], [0.1, 0.65], [-0.05, 0.86], [0.3, 0.55]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                           // ripples on the harbour
    }),
  ],
} satisfies ModelDef;
