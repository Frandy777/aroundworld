import { box, cyl, final, glass, hip, plaque, GOLD, IRON, INK, type ModelDef } from '../../builder';

export default {
  key: 'choke',
  lamps: [{ at: [0, 2.2, -0.45], color: 0xffe494, power: 4.8, reach: 6.5, final: true }], // the twin lighthouses
  props: [ // a harbour mouth: twin lighthouses (port red, starboard green) at the back, a gas carrier held in the channel by the red-and-white boom, its toll booth and stop signal on the quays
    final((g) => {
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, WHITE = 0xf4f6fa, RED = 0xd9423e, GREEN = 0x2fa84f, NAVY = 0x1a2250, STONE = 0xb4bccf, GLASS = 0x7db6ff, STEEL = 0xcfd6e6, Z = 0.3; // Z: the boom
      box(g, 2.2, 0.08, 1.9, 0x6b6f7a); box(g, 0.9, 0.02, 1.9, WATER, 0, 0.08);                                                     // foundation, the channel (x -0.45 to 0.45)
      for (const s of [-1, 1]) {                                                                                                     // the two quays: sand deck, stone curb, yellow edge line, foam along the water, bollards
        box(g, 0.65, 0.14, 1.9, 0xd8c08a, s * 0.775, 0.08); box(g, 0.08, 0.04, 1.9, STONE, s * 0.49, 0.22); box(g, 0.025, 0.012, 1.9, GOLD, s * 0.57, 0.22); box(g, 0.025, 0.012, 1.9, FOAM, s * 0.4375, 0.1);
        for (const z of [-0.15, 0.7]) box(g, 0.07, 0.08, 0.07, INK, s * 0.49, 0.26, z);
      }
      for (const [x, band] of [[-0.78, RED], [0.78, GREEN]]) {                                                                       // twin lighthouses at the harbour mouth: port (red) and starboard (green)
        const z = -0.6, top = [[0.36, 0.46, WHITE], [0.32, 0.42, band], [0.28, 0.42, WHITE], [0.24, 0.36, band]].reduce((y, [w, h, c]) => (box(g, w, h, w, c, x, y, z), y + h), 0.34); // the shaft, tapering in four bands
        box(g, 0.46, 0.12, 0.46, STONE, x, 0.22, z); box(g, 0.12, 0.2, 0.02, 0x8a5a2b, x, 0.34, z + 0.19);                            // plinth, door
        [[1.0, 0.17], [1.45, 0.15]].forEach(([y, d]) => box(g, 0.05, 0.12, 0.02, INK, x, y, z + d, glass(INK))); // slit windows
        box(g, 0.46, 0.06, 0.46, IRON, x, top, z); box(g, 0.24, 0.28, 0.24, 0xfff6b0, x, top + 0.06, z);                              // gallery, the glowing lantern
        for (const k of [-1, 1]) box(g, 0.03, 0.28, 0.03, INK, x + k * 0.105, top + 0.06, z + 0.125);                                 // its mullions
        hip(g, 0.36, 0.36, 0.26, top + 0.34, band, x, z); box(g, 0.05, 0.14, 0.05, GOLD, x, top + 0.6, z);                            // cap, finial
      }
      [[0.5, -0.5, 0.8], [0.4, -0.05, 0.1], [0.28, 0.035, 0.07], [0.14, 0.095, 0.05]].forEach(([w, z, l]) => {                       // gas carrier (bow to us): the hull in four steps, each with its red boot-topping and its rusty deck inside a rim
        box(g, w, 0.22, l, 0x2d3550, 0, 0.08, z); box(g, w + 0.02, 0.05, l + 0.02, RED, 0, 0.1, z); box(g, w - 0.04, 0.03, l - 0.02, 0xa8503c, 0, 0.3, z);
      });
      for (const z of [-0.46, -0.14]) {                                                                                              // two spherical gas tanks: a cradle and a stepped white dome
        cyl(g, 0.16, 0.04, 0x8f97ad, 0, 0.33, z); [0.15, 0.13, 0.1, 0.06].forEach((r, i) => cyl(g, r, 0.05, i & 1 ? 0xdfe6f2 : WHITE, 0, 0.37 + i * 0.05, z));
      }
      box(g, 0.42, 0.22, 0.26, WHITE, 0, 0.33, -0.77); box(g, 0.34, 0.16, 0.2, WHITE, 0, 0.55, -0.78); box(g, 0.42, 0.1, 0.18, WHITE, 0, 0.71, -0.79); // accommodation: two decks and the wheelhouse
      [[0.4, -0.64], [0.59, -0.68]].forEach(([y, z]) => [-0.1, 0, 0.1].forEach((x) => box(g, 0.05, 0.05, 0.02, NAVY, x, y, z, glass(NAVY)))); // windows, on the face of each deck
      box(g, 0.36, 0.05, 0.02, GLASS, 0, 0.74, -0.7, glass(GLASS)); box(g, 0.44, 0.03, 0.2, STEEL, 0, 0.81, -0.79); // bridge glass, roof
      box(g, 0.1, 0.2, 0.1, 0xe0a020, 0, 0.81, -0.84); box(g, 0.11, 0.04, 0.11, INK, 0, 1.01, -0.84);                               // funnel
      box(g, 0.025, 0.2, 0.025, INK, 0.12, 0.84, -0.76); box(g, 0.2, 0.02, 0.04, STEEL, 0.12, 1.0, -0.76); box(g, 0.04, 0.04, 0.04, 0xff3b3b, 0.12, 1.02, -0.76); // mast, radar, beacon
      box(g, 0.02, 0.14, 0.02, INK, 0, 0.33, 0.07);                                                                                  // jackstaff
      box(g, 0.2, 0.012, 0.03, FOAM, 0, 0.1, 0.14); [-0.2725, 0.2725].forEach((x) => box(g, 0.025, 0.012, 0.7, FOAM, x, 0.1, -0.45)); // foam at the bow and along the hull
      [[-0.36, 0.65], [0.36, 0.5], [-0.36, -0.6], [0.36, -0.8]].forEach(([x, z]) => box(g, 0.1, 0.012, 0.025, 0x5ec2dc, x, 0.1, z));  // ripples
      for (let i = 0; i < 7; i++) box(g, 0.14, 0.07, 0.07, i & 1 ? WHITE : RED, -0.52 + i * 0.14, 0.5, Z);                           // the boom across the channel, red and white, from the booth to the post
      box(g, 0.08, 0.16, 0.12, IRON, -0.5, 0.45, Z); box(g, 0.1, 0.5, 0.1, IRON, 0.5, 0.22, Z);                                      // its hinge, and the post it rests on
      box(g, 0.1, 0.24, 0.08, INK, 0.5, 0.72, Z); box(g, 0.05, 0.05, 0.02, 0xff3b3b, 0.5, 0.86, Z + 0.05); box(g, 0.05, 0.05, 0.02, GREEN, 0.5, 0.77, Z + 0.05); // the signal on the post: red on, green off
      [-0.25, 0.25].forEach((x) => box(g, 0.05, 0.05, 0.05, 0xff3b3b, x, 0.57, Z));                                                  // warning lights
      box(g, 0.5, 0.4, 0.38, WHITE, -0.77, 0.22, Z); box(g, 0.51, 0.06, 0.39, RED, -0.77, 0.22, Z); box(g, 0.6, 0.05, 0.46, RED, -0.77, 0.62, Z); // toll booth: cabin, red skirt, roof
      box(g, 0.34, 0.14, 0.02, GLASS, -0.77, 0.38, Z + 0.19, glass(GLASS)); box(g, 0.03, 0.14, 0.03, WHITE, -0.77, 0.38, Z + 0.19); // window and mullion
      plaque(g, 'TOLL', '#fff', '#d9423e', 0.77, 0.26, -0.77, 0.67, Z);                                                              // its roof sign
      for (const x of [-0.6, -0.95]) { box(g, 0.05, 0.08, 0.05, 0xff8a1f, x, 0.22, 0.62); box(g, 0.055, 0.02, 0.055, 0xffffff, x, 0.26, 0.62); } // traffic cones
      box(g, 0.2, 0.18, 0.2, 0x8a5a2b, 0.7, 0.22, 0.62); box(g, 0.2, 0.18, 0.2, 0xa8743c, 0.93, 0.22, 0.6); box(g, 0.18, 0.16, 0.18, 0xa8743c, 0.8, 0.4, 0.61); // a stack of crates
      [[-0.95, -0.12], [0.95, -0.12]].forEach(([x, z]) => { box(g, 0.26, 0.2, 0.26, GREEN, x, 0.22, z); box(g, 0.16, 0.12, 0.16, 0x4cc36b, x, 0.42, z); }); // shrubs
      [[-0.33, 0.78, RED], [0.33, 0.78, GREEN]].forEach(([x, z, c]) => { cyl(g, 0.07, 0.1, c, x, 0.1, z); cyl(g, 0.04, 0.08, WHITE, x, 0.2, z); box(g, 0.02, 0.1, 0.02, INK, x, 0.28, z); }); // channel buoys
    }),
  ],
} satisfies ModelDef;
