import { box, cyl, final, plaque, GOLD, IRON, INK, type ModelDef } from '../../builder';

export default {
  key: 'devil',
  lamps: [{ at: [0.72, 2.95, -0.15], color: 0xffe494, power: 4.5, reach: 6, final: true }], // the lighthouse & searchlight
  props: [ // Alcatraz Island: the cellhouse on its rock in the bay, the lighthouse and the water tower beside it, a guard tower on the dock and the ferry moored at the quay
    final((g) => {
      const P = 1.1, SEA = 0x2c6fd2, FOAM = 0xdcefff, WHITE = 0xf4f6fa, CREAM = 0xe4ddc8, TRIM = 0xf4eedb, NAVY = 0x1a2250, GLASS = 0x7db6ff, BLUE = 0x2447a8, LEAF = 0x4f9d4f, GREY = 0xcfd6e6; // the plateau's height, sea, foam, white paint, cellhouse concrete and its trim, windows, glass, ferry blue, planting, light steel
      box(g, 2.2, 0.1, 1.9, SEA); box(g, 2.16, 0.012, 1.62, 0x3d88e0, 0, 0.1, -0.14); box(g, 2.1, 0.02, 1.25, FOAM, 0, 0.1, -0.325);                  // the bay, its shallows, the foam round the rock
      [[2, 0.2, 1.15, 0x4f5565, 0, 0.1, -0.325], [1.92, 0.28, 1.01, 0x6b6d72, 0, 0.3, -0.375], [1.84, 0.34, 0.87, 0x8a857a, 0, 0.58, -0.425], [1.76, 0.18, 0.75, 0xa59f8c, 0, 0.92, -0.465]]
        .forEach(([w, h, d, c, x, y, z]) => box(g, w, h, d, c, x, y, z));                                                                                // the rock in four courses, dark and wet at the waterline, gravel on top
      [[0.16, 0.2, 0.3, 0x6b6d72, -1, 0.1, -0.55], [0.16, 0.14, 0.24, 0x4f5565, 1, 0.1, -0.15], [0.18, 0.2, 0.2, 0x8a857a, -0.96, 0.3, -0.2], [0.16, 0.2, 0.26, 0x8a857a, 0.96, 0.3, -0.5]]
        .forEach(([w, h, d, c, x, y, z]) => box(g, w, h, d, c, x, y, z));                                                                                // boulders on the shore, ledges on the cliff
      [[-0.6, 0.1, 0.2, 0.254], [-0.62, 0.3, 0.28, 0.134], [-0.18, 0.3, 0.28, 0.134], [0.4, 0.3, 0.28, 0.134], [0.8, 0.58, 0.34, 0.014]].forEach(([x, y, h, z]) => box(g, 0.03, h, 0.012, 0x3b4050, x, y, z)); // crevices down the cliff faces
      box(g, 0.8, 0.04, 0.08, LEAF, -0.55, 0.58, 0.07);                                                                                                    // ice plant on the lower ledge
      box(g, 0.24, 0.2, 0.24, 0x2f7a4a, -0.88, 0.3, 0.18); box(g, 0.16, 0.14, 0.16, 0x3f9a5c, -0.88, 0.5, 0.18);                                          // a cypress on the shore
      plaque(g, '🔒', '#6e6a61', '#ffffff', 1.5, 0.3, -0.1, 0.6, -0.045);                                                                                 // the padlock, painted on the cliff wall
      box(g, 1.5, 0.06, 0.06, LEAF, -0.1, 0.92, -0.04); [[-0.5, 0xff8fb8], [0, 0xffd23f], [0.45, 0xff8fb8]].forEach(([x, c]) => box(g, 0.05, 0.04, 0.05, c, x, 0.98, -0.04)); // the hedge along the top terrace, in flower
      [-0.4, 0.4].forEach((x) => box(g, 0.5, 0.014, 0.2, 0x5fae5a, x, P, -0.24)); box(g, 0.2, 0.012, 0.3, 0xd6d0c0, 0, P, -0.27);                          // two lawns and the path to the door

      box(g, 1.64, 0.08, 0.44, 0xbdb6a0, 0, P, -0.62); box(g, 1.6, 0.76, 0.4, CREAM, 0, P + 0.08, -0.62);                                                 // the cellhouse: plinth, walls
      box(g, 1.64, 0.04, 0.42, TRIM, 0, P + 0.44, -0.62); box(g, 1.66, 0.06, 0.46, TRIM, 0, P + 0.84, -0.62);                                             // a belt between the floors, the cornice
      for (const x of [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]) { if (x) box(g, 0.1, 0.26, 0.02, NAVY, x, P + 0.15, -0.415); box(g, 0.1, 0.26, 0.02, NAVY, x, P + 0.53, -0.415); } // two rows of barred windows
      box(g, 0.2, 0.3, 0.03, 0x8a5a2b, 0, P + 0.08, -0.41); box(g, 0.28, 0.04, 0.05, TRIM, 0, P + 0.38, -0.41);                                          // the door and its lintel
      box(g, 1.52, 0.08, 0.4, 0x59606e, 0, P + 0.9, -0.62); box(g, 1.36, 0.08, 0.28, 0x6a7282, 0, P + 0.98, -0.62); box(g, 1.2, 0.06, 0.16, 0x7b8496, 0, P + 1.06, -0.62); // the roof in three steps
      box(g, 1, 0.06, 0.1, 0xaadcff, 0, P + 1.12, -0.62);                                                                                                  // the skylight along the ridge

      box(g, 0.34, 0.1, 0.34, 0xb4bccf, 0.7, P, -0.28);                                                                                                    // the lighthouse: plinth
      [[0.17, 0.44], [0.155, 0.42], [0.14, 0.4], [0.125, 0.38]].reduce((y, [r, h]) => (cyl(g, r, h, WHITE, 0.7, y, -0.28), y + h), P + 0.1);              // the white shaft, tapering in four stages
      box(g, 0.07, 0.15, 0.03, 0x8a5a2b, 0.7, P + 0.1, -0.11); [[P + 0.7, 0.155], [P + 1.1, 0.14]].forEach(([y, r]) => box(g, 0.03, 0.12, 0.02, INK, 0.7, y, -0.28 + r)); // door and slit windows
      cyl(g, 0.2, 0.05, INK, 0.7, P + 1.74, -0.28); cyl(g, 0.1, 0.26, 0xfff6b0, 0.7, P + 1.79, -0.28);                                                    // the gallery, the glowing lantern
      [-1, 1].forEach((s) => box(g, 0.025, 0.26, 0.025, INK, 0.7 + s * 0.075, P + 1.79, -0.205));                                                          // its two front mullions
      cyl(g, 0.16, 0.05, INK, 0.7, P + 2.05, -0.28); cyl(g, 0.1, 0.08, 0x3a4056, 0.7, P + 2.1, -0.28); box(g, 0.04, 0.1, 0.04, GOLD, 0.7, P + 2.18, -0.28); // cap, dome, finial

      for (const x of [-0.85, -0.59]) for (const z of [-0.36, -0.16]) box(g, 0.05, 0.8, 0.05, IRON, x, P, z);                                              // the water tower: four legs
      [-0.36, -0.16].forEach((z) => box(g, 0.31, 0.04, 0.04, IRON, -0.72, P + 0.4, z)); [-1, 1].forEach((s) => (box(g, 0.025, 0.48, 0.025, IRON, -0.72, P - 0.04, -0.16).rotation.z = s * 0.58)); // a ring of beams, cross-bracing in front
      box(g, 0.44, 0.04, 0.4, IRON, -0.72, P + 0.8, -0.26); cyl(g, 0.2, 0.5, 0xe4e1d8, -0.72, P + 0.84, -0.26); cyl(g, 0.205, 0.07, 0xb4573a, -0.72, P + 0.84, -0.26); // platform, the tank, its rust band
      cyl(g, 0.21, 0.04, GREY, -0.72, P + 1.34, -0.26); cyl(g, 0.13, 0.1, 0x9aa5bd, -0.72, P + 1.38, -0.26);                                               // the stepped roof

      box(g, 1.1, 0.16, 0.2, 0xc9c2ae, 0.4, 0.1, 0.35); box(g, 1.1, 0.012, 0.025, GOLD, 0.4, 0.26, 0.425);                                                // the quay, its yellow edge line
      [0, 0.45].forEach((x) => box(g, 0.06, 0.07, 0.06, INK, x, 0.26, 0.4));                                                                              // bollards
      box(g, 0.2, 0.62, 0.18, 0xd6d0c0, 0.8, 0.26, 0.36); box(g, 0.34, 0.26, 0.26, CREAM, 0.8, 0.88, 0.36); box(g, 0.28, 0.12, 0.02, GLASS, 0.8, 0.95, 0.495); // the guard tower on the dock: shaft, cab, its glass
      box(g, 0.42, 0.04, 0.34, 0x4a5170, 0.8, 1.14, 0.36); box(g, 0.08, 0.1, 0.08, 0xfff6b0, 0.8, 1.18, 0.36);                                            // roof, searchlight

      box(g, 0.9, 0.12, 0.22, WHITE, 0.4, 0.1, 0.58); box(g, 0.92, 0.04, 0.23, NAVY, 0.4, 0.1, 0.58); box(g, 0.9, 0.025, 0.225, BLUE, 0.4, 0.18, 0.58);   // the ferry: hull, dark waterline, blue stripe
      box(g, 0.1, 0.12, 0.16, WHITE, 0.9, 0.1, 0.58); box(g, 0.06, 0.12, 0.09, WHITE, 0.96, 0.1, 0.58);                                                   // bow in two steps
      box(g, 0.72, 0.1, 0.18, WHITE, 0.32, 0.22, 0.58); box(g, 0.64, 0.045, 0.02, NAVY, 0.32, 0.245, 0.675);                                              // main deck and its windows
      box(g, 0.46, 0.09, 0.15, WHITE, 0.26, 0.32, 0.58); box(g, 0.4, 0.04, 0.02, NAVY, 0.26, 0.34, 0.66); box(g, 0.5, 0.025, 0.18, GREY, 0.26, 0.41, 0.58); // upper deck, windows, roof
      box(g, 0.18, 0.1, 0.13, WHITE, 0.58, 0.32, 0.58); box(g, 0.14, 0.05, 0.02, GLASS, 0.58, 0.35, 0.65); box(g, 0.22, 0.025, 0.16, GREY, 0.58, 0.42, 0.58); // wheelhouse, its glass, roof
      box(g, 0.1, 0.16, 0.1, BLUE, 0.2, 0.435, 0.58); box(g, 0.105, 0.035, 0.105, WHITE, 0.2, 0.5, 0.58); box(g, 0.11, 0.02, 0.11, INK, 0.2, 0.595, 0.58); // funnel, its band and cap
      box(g, 0.96, 0.012, 0.03, FOAM, 0.42, 0.1, 0.7); box(g, 0.1, 0.012, 0.22, FOAM, 1.02, 0.1, 0.58);                                                   // foam along the hull and at the bow

      cyl(g, 0.07, 0.1, 0xd9423e, -0.75, 0.1, 0.8); cyl(g, 0.04, 0.08, WHITE, -0.75, 0.2, 0.8); box(g, 0.02, 0.1, 0.02, INK, -0.75, 0.28, 0.8);             // a channel buoy
      [[-0.85, 0.55], [-0.3, 0.82], [0.9, 0.8]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x5ec2dc, x, 0.1, z));                                     // ripples
      [[-0.2, 2.7, -0.3], [0.3, 2.95, -0.1]].forEach(([x, y, z]) => { box(g, 0.07, 0.035, 0.04, WHITE, x, y, z); [-1, 1].forEach((s) => (box(g, 0.1, 0.012, 0.05, WHITE, x + s * 0.07, y + 0.03, z).rotation.z = -s * 0.35)); }); // two gulls on the wing
    }),
  ],
} satisfies ModelDef;
