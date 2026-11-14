import { box, final, floor, glass, plaque, GOLD, INK, type ModelDef } from '../../builder';

export default {
  key: 'Maersk',
  props: [ // a container terminal: a ship at the quay under a gantry crane, a yard of stacked boxes, a truck and the line's office with its sign
    final((g) => {
      const Z = 0.25, NAVY = 0x1a2c5a, RED = 0xb02a2a, BLUE = 0x42b0d5, WHITE = 0xf2f2f2, DARK = 0x3a4056, GLASS = 0x7db6ff, BOX = [BLUE, 0xd9423e, 0xe0a020, WHITE, 0x3fa65a]; // Z: the ship's centre line
      const stack = (x: number, z: number, n: number, k: number, y: number) => { // a bay of boxes, two wide, the top level split in two
        for (let i = 0; i < n - 1; i++) box(g, 0.26, 0.12, 0.44, BOX[(k + i * 2) % 5], x, y + i * 0.12, z);
        [-0.11, 0.11].forEach((dz, j) => box(g, 0.26, 0.12, 0.2, BOX[(k * 2 + j + 1) % 5], x, y + (n - 1) * 0.12, z + dz));
      };
      box(g, 2.2, 0.08, 1.9, 0x8d9099); box(g, 2.2, 0.02, 0.99, 0x2c6fd2, 0, 0.08, 0.455); box(g, 2.2, 0.1, 0.91, 0xb7b9c4, 0, 0.08, -0.495);        // ground, water in front, the quay behind it
      box(g, 2.2, 0.01, 0.03, GOLD, 0, 0.18, -0.08); box(g, 0.9, 0.02, 0.04, DARK, 0.24, 0.18, -0.1); box(g, 0.9, 0.02, 0.04, DARK, 0.24, 0.18, -0.42);   // yellow edge line, crane rails
      box(g, 1.7, 0.28, 0.5, NAVY, -0.2, 0.08, Z); box(g, 1.7, 0.05, 0.52, RED, -0.2, 0.1, Z); box(g, 1.64, 0.02, 0.44, 0x6d7388, -0.2, 0.36, Z);          // ship: hull, red bottom, deck
      [[0.75, 0.2, 0.4], [0.91, 0.12, 0.28], [1.0, 0.06, 0.14]].forEach(([x, l, w]) => { box(g, l, 0.28, w, NAVY, x, 0.08, Z); box(g, l, 0.05, w + 0.02, RED, x, 0.1, Z); }); // bow in three steps
      box(g, 1.72, 0.012, 0.03, 0xdcefff, -0.2, 0.1, Z + 0.27); box(g, 2.2, 0.012, 0.03, 0xdcefff, 0, 0.1, -0.02);                                      // foam along the hull and the quay
      [[-0.6, 3], [-0.32, 3], [-0.04, 3], [0.24, 2], [0.52, 3]].forEach(([x, n], k) => stack(x, Z, n, k, 0.38));                                          // five bays of cargo
      box(g, 0.24, 0.3, 0.4, WHITE, -0.92, 0.36, Z); [0.5, 0.58].forEach((y) => box(g, 0.2, 0.05, 0.02, NAVY, -0.92, y, Z + 0.205, glass(NAVY))); // accommodation block, two rows of windows
      box(g, 0.28, 0.1, 0.46, WHITE, -0.92, 0.66, Z); box(g, 0.22, 0.05, 0.02, NAVY, -0.92, 0.7, Z + 0.235, glass(NAVY)); box(g, 0.3, 0.03, 0.48, 0xcfd6e6, -0.92, 0.76, Z); // wheelhouse with its wings, windows and roof
      box(g, 0.14, 0.26, 0.24, BLUE, -1.0, 0.79, Z); box(g, 0.15, 0.03, 0.25, INK, -1.0, 1.05, Z); box(g, 0.08, 0.03, 0.02, WHITE, -1.0, 0.9, Z + 0.13); box(g, 0.03, 0.08, 0.02, WHITE, -1.0, 0.875, Z + 0.13); // funnel, with its star
      box(g, 0.03, 0.2, 0.03, INK, -0.86, 0.79, Z); box(g, 0.14, 0.03, 0.03, 0xcfd6e6, -0.86, 0.96, Z);                                                  // mast, radar
      [0.06, 0.42].forEach((x) => { [-0.1, -0.42].forEach((z) => box(g, 0.05, 1.0, 0.05, BLUE, x, 0.2, z)); box(g, 0.05, 0.06, 0.4, BLUE, x, 1.2, -0.26); }); // gantry crane: four legs, the top frame
      [-0.1, -0.42].forEach((z) => { box(g, 0.42, 0.06, 0.07, BLUE, 0.24, 1.2, z); box(g, 0.36, 0.04, 0.04, BLUE, 0.24, 0.6, z); });                     // beams, tie bars
      box(g, 0.34, 0.12, 0.26, WHITE, 0.24, 1.26, -0.26); box(g, 0.08, 0.06, 1.0, BLUE, 0.24, 1.26, 0.14);                                               // machinery house, the boom reaching over the ship
      box(g, 0.16, 0.06, 0.12, DARK, 0.24, 1.2, 0.25); [-0.06, 0.06].forEach((dx) => box(g, 0.015, 0.28, 0.015, INK, 0.24 + dx, 0.925, 0.25));          // trolley, hoist ropes
      box(g, 0.28, 0.025, 0.14, DARK, 0.24, 0.9, 0.25); box(g, 0.26, 0.12, 0.2, 0xd9423e, 0.24, 0.78, 0.25);                                            // spreader, the box it is lifting
      [[0.58, 3], [0.86, 2]].forEach(([x, n], k) => stack(x, -0.7, n, k, 0.18));                                                                          // the yard beside the crane
      box(g, 0.14, 0.04, 0.44, INK, 0.95, 0.18, -0.26); box(g, 0.14, 0.1, 0.28, 0xe0a020, 0.95, 0.22, -0.34); box(g, 0.14, 0.12, 0.12, 0xd9423e, 0.95, 0.22, -0.1); box(g, 0.1, 0.05, 0.02, GLASS, 0.95, 0.28, -0.035, glass(GLASS)); // truck: chassis, box, cab, windscreen
      floor(g, 2, 1, 'win', 0xe8ecf4, 0.18, -0.6, -0.68); box(g, 1.1, 0.08, 0.6, BLUE, -0.6, 1.08, -0.68); plaque(g, '★', '#42b0d5', '#fff', 1.0, 0.3, -0.6, 1.16, -0.5, 'neon'); // office, its roof and sign (the star of the funnel)
      [-0.85, -0.35].forEach((x) => box(g, 0.2, 0.08, 0.16, 0xcfd6e6, x, 1.16, -0.75));                                                                  // roof air-conditioners
    }),
  ],
} satisfies ModelDef;
