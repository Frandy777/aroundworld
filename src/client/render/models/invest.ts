import * as THREE from 'three';
import { box, cyl, final, floor, hip, plaque, GOLD, IRON, INK, type Prop } from '../builder';
import { LAUNCH_PAD, MISSILE_LENGTH, MISSILE_NAME, MISSILE_SCALE, missile } from './missile';
import { oil } from './oil';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// The investments' props: every carrier has a model of its own (keyed by name), every other kind one per kind
export const INVEST_PROPS: Record<string, Prop[]> = {
  'United Airlines': [ // an airport apron: a jet at its stand between a glass terminal and the control tower, with a fuel truck, a baggage train, airstairs and traffic cones
    final((g) => {
      const Z = 0.25, WHITE = 0xf4f6fa, BLUE = 0x2447a8, NAVY = 0x1a2250, WING = 0xe3e8f2, GLASS = 0x7db6ff, DARK = 0x4a5170, YEL = 0xe0a020, RED = 0xd9423e; // Z: the jet's centre line
      const tube = (r: number, len: number, c: number, x: number, y: number, z: number) => { cyl(g, r, len, c, x, y - len / 2, z).rotation.z = Math.PI / 2; };                                         // a cylinder lying along x, centred at height y
      box(g, 2.2, 0.08, 1.9, 0x676c82); box(g, 0.06, 0.01, 0.62, GOLD, 0.66, 0.08, 0.64);                                                               // apron, the yellow lead-in line to the nose wheel
      box(g, 1.5, 0.22, 0.4, WHITE, 0, 0.28, Z); box(g, 1.5, 0.08, 0.28, WHITE, 0, 0.5, Z); box(g, 1.5, 0.08, 0.28, BLUE, 0, 0.2, Z);                    // airliner (nose to the right): body, rounded by a crown and a blue keel
      box(g, 0.12, 0.26, 0.34, WHITE, 0.81, 0.26, Z); box(g, 0.09, 0.2, 0.26, WHITE, 0.915, 0.29, Z); box(g, 0.06, 0.14, 0.16, DARK, 0.99, 0.32, Z);    // nose: two steps and the radome
      box(g, 0.1, 0.02, 0.22, NAVY, 0.78, 0.52, Z); box(g, 0.08, 0.05, 0.02, NAVY, 0.84, 0.42, Z + 0.17);                                              // cockpit glass, on top and at the side
      box(g, 0.14, 0.26, 0.3, WHITE, -0.82, 0.3, Z); box(g, 0.1, 0.2, 0.18, WHITE, -0.94, 0.38, Z); box(g, 0.04, 0.08, 0.1, DARK, -1.01, 0.44, Z);      // tail cone, rising to the exhaust
      box(g, 0.36, 0.3, 0.06, BLUE, -0.73, 0.58, Z); box(g, 0.24, 0.26, 0.06, BLUE, -0.8, 0.88, Z); box(g, 0.2, 0.04, 0.76, WING, -0.9, 0.44, Z);       // fin in two steps, tailplane
      box(g, 0.14, 0.14, 0.02, 0xdce8ff, -0.74, 0.66, Z + 0.04); box(g, 0.14, 0.02, 0.03, BLUE, -0.74, 0.72, Z + 0.04); box(g, 0.02, 0.14, 0.03, BLUE, -0.74, 0.66, Z + 0.04); // the globe on the fin
      for (const s of [1, -1]) { // each side: a wing swept in three steps with its winglet, an engine under it, a main wheel
        [[0.64, 0.2, 0.02, 0.3], [0.5, 0.16, -0.08, 0.48], [0.36, 0.12, -0.18, 0.62]].forEach(([w, d, x, z]) => box(g, w, 0.05, d, WING, x, 0.28, Z + s * z));
        box(g, 0.1, 0.1, 0.03, BLUE, -0.3, 0.3, Z + s * 0.67); tube(0.075, 0.34, WING, 0.2, 0.25, Z + s * 0.42); tube(0.063, 0.03, NAVY, 0.37, 0.25, Z + s * 0.42);
        box(g, 0.04, 0.12, 0.04, IRON, 0.02, 0.08, Z + s * 0.13); box(g, 0.14, 0.07, 0.06, INK, 0.02, 0.08, Z + s * 0.13);
      }
      box(g, 0.04, 0.12, 0.04, IRON, 0.66, 0.08, Z); box(g, 0.1, 0.06, 0.12, INK, 0.66, 0.08, Z);                                                      // nose wheel
      for (let x = -0.6; x < 0.4; x += 0.11) box(g, 0.06, 0.06, 0.02, NAVY, x, 0.4, Z + 0.205);                                                        // cabin windows
      box(g, 1.5, 0.04, 0.02, BLUE, 0, 0.28, Z + 0.205); box(g, 0.09, 0.16, 0.02, 0xaeb8d0, 0.55, 0.3, Z + 0.205);                                       // cheat line, forward door
      floor(g, 3, 1, 'glass', 0xdce8ff, 0.08, -0.35, -0.7); box(g, 1.62, 0.08, 0.62, BLUE, -0.35, 0.98, -0.7); plaque(g, '⊕', '#fff', '#2447a8', 1.1, 0.3, -0.35, 1.06, -0.46); // terminal: glass concourse, blue roof, its sign (the globe of the tail)
      box(g, 0.5, 0.3, 0.46, 0xe8e8ee, 0.82, 0.08, -0.7); box(g, 0.24, 1.0, 0.24, WHITE, 0.82, 0.38, -0.7); box(g, 0.26, 0.08, 0.26, BLUE, 0.82, 0.7, -0.7); // control tower: base, shaft, blue band
      box(g, 0.56, 0.08, 0.56, IRON, 0.82, 1.38, -0.7); box(g, 0.5, 0.26, 0.5, GLASS, 0.82, 1.46, -0.7); box(g, 0.52, 0.04, 0.52, NAVY, 0.82, 1.56, -0.7); box(g, 0.62, 0.06, 0.62, WHITE, 0.82, 1.72, -0.7); // its cab: deck, glass, frame, roof
      box(g, 0.04, 0.3, 0.04, INK, 0.82, 1.78, -0.7); box(g, 0.3, 0.05, 0.06, WING, 0.82, 1.98, -0.7); box(g, 0.08, 0.08, 0.08, 0xff3b3b, 0.82, 2.08, -0.7); // mast, radar bar, beacon
      box(g, 0.6, 0.05, 0.22, IRON, 0.78, 0.12, 0.72); tube(0.1, 0.4, WHITE, 0.72, 0.29, 0.72); tube(0.105, 0.05, RED, 0.72, 0.29, 0.72);               // fuel truck: chassis, tank, red band
      box(g, 0.18, 0.2, 0.22, RED, 1.0, 0.12, 0.72); box(g, 0.1, 0.07, 0.02, GLASS, 1.0, 0.24, 0.83); [0.6, 0.95].forEach((x) => box(g, 0.12, 0.1, 0.03, INK, x, 0.08, 0.84)); // cab, its window, wheels
      box(g, 0.2, 0.12, 0.14, YEL, -0.5, 0.08, 0.78); box(g, 0.1, 0.08, 0.12, 0xb87c14, -0.54, 0.2, 0.78);                                              // baggage tug and its cab
      [[-0.74, RED], [-0.98, 0x3f6fd0]].forEach(([x, c]) => { box(g, 0.22, 0.04, 0.16, IRON, x, 0.1, 0.78); box(g, 0.16, 0.1, 0.12, c, x, 0.14, 0.78); }); // two carts with a case each
      [0.06, 0.12, 0.18].forEach((h, i) => box(g, 0.14, h, 0.05, WING, 0.5, 0.08, 0.64 - i * 0.05)); box(g, 0.14, 0.02, 0.07, WING, 0.5, 0.26, 0.5);       // airstairs up to the forward door
      [0.84, 0.98].forEach((x) => { box(g, 0.05, 0.08, 0.05, 0xff8a1f, x, 0.08, 0.5); box(g, 0.055, 0.02, 0.055, 0xffffff, x, 0.12, 0.5); });                // two traffic cones
    }),
  ],
  'China Railway': [ // a high-speed rail station: a white train at its platform under the overhead wire, a station hall with a stepped red roof, a signal shed, a signal and a second track
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
      [-0.9, -0.72, -0.54, -0.36, -0.18, 0.02, 0.2, 0.38].forEach((x) => box(g, 0.11, 0.11, 0.02, NAVY, x, 0.44, Z + 0.205));                      // windows
      [-0.12, 0.52].forEach((x) => box(g, 0.1, 0.24, 0.02, 0x8e98b4, x, 0.28, Z + 0.205));                                                          // doors
      box(g, 0.96, 0.05, 0.02, RED, -0.56, 0.3, Z + 0.205); box(g, 0.64, 0.05, 0.02, RED, 0.28, 0.3, Z + 0.205);                                    // red stripe, along both cars
      [[0.66, 0.185], [0.77, 0.155], [0.86, 0.115]].forEach(([x, z]) => box(g, 0.1, 0.05, 0.02, RED, x, 0.3, Z + z));                                // and round the nose
      box(g, 0.1, 0.02, 0.24, NAVY, 0.66, 0.6, Z); box(g, 0.1, 0.02, 0.2, NAVY, 0.77, 0.56, Z); box(g, 0.1, 0.08, 0.02, NAVY, 0.66, 0.46, Z + 0.185); // driver's windscreen and side window
      [-0.75, 0.3].forEach((x) => box(g, 0.3, 0.05, 0.24, 0xcfd6e6, x, 0.62, Z));                                                                    // air-conditioning units
      box(g, 0.22, 0.03, 0.14, DARK, -0.38, 0.62, Z); box(g, 0.04, 0.16, 0.04, DARK, -0.44, 0.65, Z); box(g, 0.04, 0.16, 0.04, DARK, -0.34, 0.77, Z); box(g, 0.1, 0.03, 0.3, DARK, -0.34, 0.92, Z); // pantograph
      for (const x of [-0.65, 0.55]) { box(g, 0.05, 1.05, 0.05, STEEL, x, 0.18, -0.04); box(g, 0.05, 0.04, 0.28, STEEL, x, 1.1, 0.1); box(g, 0.03, 0.12, 0.03, STEEL, x, 0.97, Z); } // masts, their arms and droppers
      box(g, 2.2, 0.03, 0.03, STEEL, 0, 1.1, Z); box(g, 2.2, 0.03, 0.03, STEEL, 0, 0.95, Z);                                                         // the overhead wire and its carrier
      box(g, 2.2, 0.1, 0.4, 0xd6d0c0, 0, 0.08, -0.26); box(g, 2.2, 0.01, 0.04, GOLD, 0, 0.18, -0.09);                                              // platform, its yellow edge
      floor(g, 3, 1, 'lobby', CREAM, 0.08, 0.35, -0.7); floor(g, 3, 1, 'win', CREAM, 0.98, 0.35, -0.7);                                             // station hall: doors below, windows above
      box(g, 1.7, 0.1, 0.7, TILE, 0.35, 1.88, -0.7); box(g, 1.3, 0.1, 0.54, RED, 0.35, 1.98, -0.7); box(g, 0.8, 0.1, 0.38, TILE, 0.35, 2.08, -0.7); box(g, 0.1, 0.16, 0.1, GOLD, 0.35, 2.18, -0.7); // stepped roof, gold finial
      plaque(g, 'CRH', '#d9423e', '#fff', 0.7, 0.3, 0.35, 0.62, -0.5);                                                                              // its sign over the doors
      box(g, 0.6, 0.36, 0.36, 0xd8c08a, -0.75, 0.08, -0.72); hip(g, 0.76, 0.5, 0.2, 0.44, TILE, -0.75, -0.72); box(g, 0.14, 0.22, 0.02, 0x8a5a2b, -0.75, 0.08, -0.53); // signal shed: walls, roof, door
      [-0.2, -0.95].forEach((x) => { box(g, 0.04, 0.55, 0.04, IRON, x, 0.18, -0.2); box(g, 0.12, 0.04, 0.08, INK, x, 0.73, -0.2); box(g, 0.06, 0.03, 0.05, 0xfff6b0, x, 0.7, -0.2); }); // platform lamps
      box(g, 0.3, 0.05, 0.1, 0x8a5a2b, -0.55, 0.26, -0.33); box(g, 0.26, 0.08, 0.04, 0x8a5a2b, -0.55, 0.31, -0.37);                                // bench, with its back
      box(g, 0.04, 0.5, 0.04, IRON, 1.04, 0.08, 0.44); box(g, 0.08, 0.16, 0.06, INK, 1.04, 0.5, 0.44); box(g, 0.04, 0.04, 0.02, 0xff3b3b, 1.04, 0.6, 0.475); // signal, at red
      box(g, 0.14, 0.04, 0.34, IRON, -1.0, 0.13, 0.7); box(g, 0.1, 0.14, 0.3, RED, -1.0, 0.17, 0.7);                                               // buffer stop at the end of the second track
    }),
  ],
  Maersk: [ // a container terminal: a ship at the quay under a gantry crane, a yard of stacked boxes, a truck and the line's office with its sign
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
      box(g, 0.24, 0.3, 0.4, WHITE, -0.92, 0.36, Z); [0.5, 0.58].forEach((y) => box(g, 0.2, 0.05, 0.02, NAVY, -0.92, y, Z + 0.205));                        // accommodation block, two rows of windows
      box(g, 0.28, 0.1, 0.46, WHITE, -0.92, 0.66, Z); box(g, 0.22, 0.05, 0.02, NAVY, -0.92, 0.7, Z + 0.235); box(g, 0.3, 0.03, 0.48, 0xcfd6e6, -0.92, 0.76, Z); // wheelhouse with its wings, windows and roof
      box(g, 0.14, 0.26, 0.24, BLUE, -1.0, 0.79, Z); box(g, 0.15, 0.03, 0.25, INK, -1.0, 1.05, Z); box(g, 0.08, 0.03, 0.02, WHITE, -1.0, 0.9, Z + 0.13); box(g, 0.03, 0.08, 0.02, WHITE, -1.0, 0.875, Z + 0.13); // funnel, with its star
      box(g, 0.03, 0.2, 0.03, INK, -0.86, 0.79, Z); box(g, 0.14, 0.03, 0.03, 0xcfd6e6, -0.86, 0.96, Z);                                                  // mast, radar
      [0.06, 0.42].forEach((x) => { [-0.1, -0.42].forEach((z) => box(g, 0.05, 1.0, 0.05, BLUE, x, 0.2, z)); box(g, 0.05, 0.06, 0.4, BLUE, x, 1.2, -0.26); }); // gantry crane: four legs, the top frame
      [-0.1, -0.42].forEach((z) => { box(g, 0.42, 0.06, 0.07, BLUE, 0.24, 1.2, z); box(g, 0.36, 0.04, 0.04, BLUE, 0.24, 0.6, z); });                     // beams, tie bars
      box(g, 0.34, 0.12, 0.26, WHITE, 0.24, 1.26, -0.26); box(g, 0.08, 0.06, 1.0, BLUE, 0.24, 1.26, 0.14);                                               // machinery house, the boom reaching over the ship
      box(g, 0.16, 0.06, 0.12, DARK, 0.24, 1.2, 0.25); [-0.06, 0.06].forEach((dx) => box(g, 0.015, 0.28, 0.015, INK, 0.24 + dx, 0.925, 0.25));          // trolley, hoist ropes
      box(g, 0.28, 0.025, 0.14, DARK, 0.24, 0.9, 0.25); box(g, 0.26, 0.12, 0.2, 0xd9423e, 0.24, 0.78, 0.25);                                            // spreader, the box it is lifting
      [[0.58, 3], [0.86, 2]].forEach(([x, n], k) => stack(x, -0.7, n, k, 0.18));                                                                          // the yard beside the crane
      box(g, 0.14, 0.04, 0.44, INK, 0.95, 0.18, -0.26); box(g, 0.14, 0.1, 0.28, 0xe0a020, 0.95, 0.22, -0.34); box(g, 0.14, 0.12, 0.12, 0xd9423e, 0.95, 0.22, -0.1); box(g, 0.1, 0.05, 0.02, GLASS, 0.95, 0.28, -0.035); // truck: chassis, box, cab, windscreen
      floor(g, 2, 1, 'win', 0xe8ecf4, 0.18, -0.6, -0.68); box(g, 1.1, 0.08, 0.6, BLUE, -0.6, 1.08, -0.68); plaque(g, '★', '#42b0d5', '#fff', 1.0, 0.3, -0.6, 1.16, -0.5); // office, its roof and sign (the star of the funnel)
      [-0.85, -0.35].forEach((x) => box(g, 0.2, 0.08, 0.16, 0xcfd6e6, x, 1.16, -0.75));                                                                  // roof air-conditioners
    }),
  ],
  build: [ // a tower going up: glass floors below, a bare frame and concrete core above, a crane hanging a bundle of beams over it; hazard kerb, cabin and materials at the foot
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
  military: [ // a missile launch complex: the rocket and its service gantry dominate the pad, with a flame trench, fuel tanks, radar and a low control bunker
    final((g) => {
      const { x: px, y: py, z: pz } = LAUNCH_PAD, gx = px - 0.64, gz = pz - 0.25;
      const OD = 0x5b6b3a, DARK = 0x3a4528, STEEL = 0x7b86a0, LIGHT = 0xcfd6e6, WALL = 0xb7bd96, GLASS = 0x7db6ff, RED = 0xd9423e;
      const strut = (a: [number, number, number], b: [number, number, number]) => {
        const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), m = box(g, 0.045, d.length(), 0.045, STEEL);
        m.position.set(...a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
      };
      box(g, 2.3, 0.08, 1.95, 0xa9a48f);                                                                                  // hardened site
      box(g, 0.54, 0.035, 1.18, INK, px, 0.08, pz + 0.5); box(g, 0.34, 0.02, 0.92, 0x4a4f6e, px, 0.115, pz + 0.58); // flame trench and its scorched channel
      cyl(g, 0.82, 0.12, 0x8a8fa3, px, 0.08, pz); cyl(g, 0.7, 0.12, LIGHT, px, 0.2, pz);                              // circular launch pad, two concrete courses
      for (const x of [-0.34, 0.34]) for (const z of [-0.34, 0.34]) box(g, 0.12, 0.16, 0.12, DARK, px + x, 0.32, pz + z);
      cyl(g, 0.5, 0.12, OD, px, 0.36, pz); cyl(g, 0.34, 0.04, INK, px, 0.44, pz);                                     // launch mount and exhaust well
      for (const x of [-0.23, 0.23]) for (const z of [-0.23, 0.23]) box(g, 0.07, 3.08, 0.07, STEEL, gx + x, 0.16, gz + z); // service gantry
      for (let y = 0.38; y < 3.05; y += 0.53) {
        box(g, 0.54, 0.05, 0.05, LIGHT, gx, y, gz + 0.23); box(g, 0.05, 0.05, 0.54, LIGHT, gx + 0.23, y, gz);
        strut([gx - 0.23, y, gz + 0.23], [gx + 0.23, y + 0.48, gz + 0.23]); strut([gx + 0.23, y, gz - 0.23], [gx + 0.23, y + 0.48, gz + 0.23]);
      }
      for (const y of [0.82, 1.62, 2.42, 3.18]) {
        box(g, 0.64, 0.07, 0.62, DARK, gx, y, gz); box(g, 0.64, 0.08, 0.04, GOLD, gx, y + 0.07, gz + 0.29);
      }
      for (const y of [1.32, 2.12]) {                                                                                   // hinged service arms holding the rocket
        box(g, 0.55, 0.09, 0.13, OD, (gx + px) / 2 + 0.12, y, pz); box(g, 0.12, 0.18, 0.24, DARK, px - 0.25, y - 0.04, pz);
      }
      box(g, 0.05, 0.48, 0.05, INK, gx, 3.25, gz); box(g, 0.1, 0.1, 0.1, 0xff3b3b, gx, 3.73, gz);                    // lightning mast and warning lamp
      const rocket = new THREE.Group(); rocket.name = MISSILE_NAME;
      rocket.position.set(px, py + MISSILE_LENGTH * MISSILE_SCALE, pz); rocket.scale.setScalar(MISSILE_SCALE); missile(rocket); g.add(rocket);
      for (const z of [-0.64, -0.25]) {                                                                                 // propellant tanks, deliberately secondary
        cyl(g, 0.16, 0.52, LIGHT, 0.35, 0.08, z); cyl(g, 0.165, 0.1, RED, 0.35, 0.28, z); cyl(g, 0.12, 0.06, STEEL, 0.35, 0.6, z);
      }
      box(g, 0.52, 0.42, 0.62, WALL, 0.82, 0.08, -0.58); box(g, 0.58, 0.07, 0.68, DARK, 0.82, 0.5, -0.58);           // low blast-proof control bunker
      box(g, 0.34, 0.09, 0.025, GLASS, 0.82, 0.32, -0.26); box(g, 0.12, 0.24, 0.03, DARK, 0.82, 0.08, -0.25);
      box(g, 0.07, 0.68, 0.07, STEEL, 0.8, 0.08, 0.43);                                                                // radar pedestal
      const dish = cyl(g, 0.28, 0.06, LIGHT, 0.8, 0.75, 0.43); dish.rotation.x = -0.65;
      box(g, 0.04, 0.34, 0.04, DARK, 0.8, 0.72, 0.49).rotation.x = -0.65; box(g, 0.08, 0.08, 0.08, RED, 0.8, 1.04, 0.32);
      for (let i = 0; i < 7; i++) box(g, 0.24, 0.08, 0.12, i & 1 ? INK : GOLD, -0.99 + i * 0.33, 0.08, 0.84);         // hazard kerb
      for (const z of [0.38, 0.61]) box(g, 0.32, 0.012, 0.045, GOLD, px, 0.12, z);
    }),
  ],
  choke: [ // a harbour mouth: twin lighthouses (port red, starboard green) at the back, a gas carrier held in the channel by the red-and-white boom, its toll booth and stop signal on the quays
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
        [[1.0, 0.17], [1.45, 0.15]].forEach(([y, d]) => box(g, 0.05, 0.12, 0.02, INK, x, y, z + d));                                  // slit windows
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
      [[0.4, -0.64], [0.59, -0.68]].forEach(([y, z]) => [-0.1, 0, 0.1].forEach((x) => box(g, 0.05, 0.05, 0.02, NAVY, x, y, z)));      // windows, on the face of each deck
      box(g, 0.36, 0.05, 0.02, GLASS, 0, 0.74, -0.7); box(g, 0.44, 0.03, 0.2, STEEL, 0, 0.81, -0.79);                               // bridge glass, roof
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
      box(g, 0.34, 0.14, 0.02, GLASS, -0.77, 0.38, Z + 0.19); box(g, 0.03, 0.14, 0.03, WHITE, -0.77, 0.38, Z + 0.19);                // window and mullion
      plaque(g, 'TOLL', '#fff', '#d9423e', 0.77, 0.26, -0.77, 0.67, Z);                                                              // its roof sign
      for (const x of [-0.6, -0.95]) { box(g, 0.05, 0.08, 0.05, 0xff8a1f, x, 0.22, 0.62); box(g, 0.055, 0.02, 0.055, 0xffffff, x, 0.26, 0.62); } // traffic cones
      box(g, 0.2, 0.18, 0.2, 0x8a5a2b, 0.7, 0.22, 0.62); box(g, 0.2, 0.18, 0.2, 0xa8743c, 0.93, 0.22, 0.6); box(g, 0.18, 0.16, 0.18, 0xa8743c, 0.8, 0.4, 0.61); // a stack of crates
      [[-0.95, -0.12], [0.95, -0.12]].forEach(([x, z]) => { box(g, 0.26, 0.2, 0.26, GREEN, x, 0.22, z); box(g, 0.16, 0.12, 0.16, 0x4cc36b, x, 0.42, z); }); // shrubs
      [[-0.33, 0.78, RED], [0.33, 0.78, GREEN]].forEach(([x, z, c]) => { cyl(g, 0.07, 0.1, c, x, 0.1, z); cyl(g, 0.04, 0.08, WHITE, x, 0.2, z); box(g, 0.02, 0.1, 0.02, INK, x, 0.28, z); }); // channel buoys
    }),
  ],
  oil: [ // a derrick and its doghouse over the well, a pumping unit at work (its beam nodding, a faint light blinking), two tanks joined by pipes, a flare stack with a living flame, barrels at the front (see oil.ts)
    final(oil),
  ],
  bbc: [ // Broadcasting House: a stepped Art Deco tower in Portland stone (statue over the doors, the three black BBC squares on its frieze, a red ON AIR sign and a banded mast on top), on its forecourt an outside-broadcast van with a dish, a camera on its dolly and a studio light
    final((g) => {
      const Z = -0.45, STONE = 0xffffff, TRIM = 0xe4ddc8, WHITE = 0xf4f6fa, GREY = 0xcfd6e6, DARK = 0x3a4056, RED = 0xd9423e, GLASS = 0x7db6ff, BRONZE = 0xb89a5a; // Z: the tower's centre line
      box(g, 2.2, 0.08, 1.9, 0xb9b2a0); box(g, 1.1, 0.04, 0.18, TRIM, 0, 0.08, 0.14);                                                         // forecourt, the step at the doors
      floor(g, 4, 2, 'lobby', STONE, 0.08, 0, Z); floor(g, 4, 2, 'win', STONE, 0.98, 0, Z);                                                  // the tower: glass doors, a storey of windows
      box(g, 2, 0.5, 1, STONE, 0, 1.88, Z); box(g, 2.02, 0.03, 1.02, GOLD, 0, 1.88, Z); box(g, 2.12, 0.1, 1.12, TRIM, 0, 2.38, Z);           // frieze on a gold rule, cornice
      floor(g, 3, 2, 'win', STONE, 2.48, 0, Z); box(g, 1.62, 0.1, 1.12, TRIM, 0, 3.38, Z);                                                    // second tier, set in
      floor(g, 2, 2, 'win', STONE, 3.48, 0, Z); box(g, 1.12, 0.1, 1.12, TRIM, 0, 4.38, Z);                                                    // third tier and its roof
      [[0.97, 0.08, 2.3], [0.72, 2.48, 0.9], [0.47, 3.48, 0.9]].forEach(([x, y, h]) => [-1, 1].forEach((s) => box(g, 0.08, h, 0.08, TRIM, s * x, y, Z + 0.52))); // a pier up each front corner of the three tiers
      ['B', 'B', 'C'].forEach((c, i) => plaque(g, c, '#14161f', '#fff', 0.41, 0.36, (i - 1) * 0.47, 1.95, Z + 0.56));                        // the logo: three black squares on the frieze
      box(g, 0.16, 0.06, 0.08, TRIM, 0, 1.2, Z + 0.54); box(g, 0.09, 0.26, 0.06, BRONZE, -0.03, 1.26, Z + 0.54); box(g, 0.06, 0.06, 0.06, BRONZE, -0.03, 1.52, Z + 0.54); box(g, 0.05, 0.16, 0.05, BRONZE, 0.05, 1.26, Z + 0.54); // Prospero and Ariel on the pier over the doors
      box(g, 0.05, 0.12, 0.05, GREY, 0.88, 2.48, -0.3); cyl(g, 0.14, 0.03, WHITE, 0.88, 2.7, -0.28).rotation.x = Math.PI / 4; box(g, 0.04, 0.04, 0.04, DARK, 0.88, 2.78, -0.2); // a satellite dish on the first terrace
      for (const x of [-0.45, 0.45]) box(g, 0.06, 0.12, 0.06, DARK, x, 4.48, Z + 0.4); plaque(g, 'ON AIR', '#d9423e', '#fff', 1.1, 0.3, 0, 4.6, Z + 0.4); // the roof sign on two posts
      box(g, 0.3, 0.1, 0.3, TRIM, 0.2, 4.48, -0.6); for (let i = 0; i < 5; i++) box(g, 0.12, 0.34, 0.12, i & 1 ? WHITE : RED, 0.2, 4.58 + i * 0.34, -0.6); // the mast on its plinth, in red and white bands
      box(g, 0.5, 0.04, 0.04, WHITE, 0.2, 5.35, -0.6); [-0.05, 0.45].forEach((x) => box(g, 0.08, 0.16, 0.04, GREY, x, 5.19, -0.6));                // a crossarm with a panel antenna at each end
      box(g, 0.03, 0.26, 0.03, GREY, 0.2, 6.28, -0.6); box(g, 0.08, 0.08, 0.08, 0xff3b3b, 0.2, 6.54, -0.6);                                  // aerial and its red beacon
      const [vx, vz, kx, kz] = [-0.7, 0.42, 0.6, 0.45];                                                                                         // the van's centre, the camera's
      box(g, 0.72, 0.06, 0.3, DARK, vx, 0.1, vz); box(g, 0.46, 0.32, 0.34, WHITE, vx - 0.13, 0.16, vz); box(g, 0.26, 0.22, 0.34, GREY, vx + 0.23, 0.16, vz);  // van (nose to the right): chassis, studio box, cab
      box(g, 0.72, 0.045, 0.02, RED, vx, 0.2, vz + 0.175); box(g, 0.14, 0.09, 0.02, GLASS, vx + 0.23, 0.27, vz + 0.175);                     // red stripe, cab window
      for (let i = -1; i < 2; i++) box(g, 0.09, 0.09, 0.02, 0x14161f, vx - 0.13 + i * 0.11, 0.3, vz + 0.175);                                  // the BBC squares on its side
      [-0.2, 0.22].forEach((dx) => box(g, 0.14, 0.14, 0.05, INK, vx + dx, 0.08, vz + 0.15));                                                  // wheels
      box(g, 0.04, 0.18, 0.04, GREY, vx - 0.2, 0.48, vz); cyl(g, 0.17, 0.03, WHITE, vx - 0.2, 0.74, vz + 0.03).rotation.x = Math.PI / 4; box(g, 0.04, 0.04, 0.04, DARK, vx - 0.2, 0.83, vz + 0.12); // roof dish on its post, tilted to the sky, its feed horn
      box(g, 0.03, 0.3, 0.03, GREY, vx, 0.48, vz - 0.1); box(g, 0.05, 0.05, 0.05, 0xff3b3b, vx, 0.78, vz - 0.1);                              // telescopic aerial and its red tip
      box(g, 0.94, 0.012, 0.025, INK, 0.13, 0.08, 0.52);                                                                                      // cable from the van to the camera
      box(g, 0.36, 0.03, 0.05, DARK, kx, 0.08, kz); box(g, 0.05, 0.03, 0.36, DARK, kx, 0.08, kz); box(g, 0.05, 0.32, 0.05, 0x7b86a0, kx, 0.11, kz); // camera dolly: crossed legs and column
      box(g, 0.12, 0.05, 0.1, INK, kx, 0.43, kz); box(g, 0.24, 0.16, 0.14, GREY, kx, 0.48, kz); box(g, 0.16, 0.1, 0.1, INK, kx - 0.2, 0.51, kz);  // pan head, body, lens
      box(g, 0.05, 0.14, 0.14, DARK, kx - 0.3, 0.49, kz); box(g, 0.12, 0.07, 0.07, INK, kx + 0.02, 0.64, kz); box(g, 0.04, 0.04, 0.04, 0xff3b3b, kx - 0.06, 0.64, kz + 0.07); // lens hood, viewfinder, red tally lamp
      box(g, 0.03, 0.5, 0.03, IRON, 0.95, 0.08, 0.3); box(g, 0.2, 0.15, 0.1, INK, 0.95, 0.58, 0.3); box(g, 0.16, 0.11, 0.02, 0xfff6b0, 0.95, 0.6, 0.36); // studio light on its stand, its glowing lens
    }),
  ],
  devil: [ // Alcatraz Island: the cellhouse on its rock in the bay, the lighthouse and the water tower beside it, a guard tower on the dock and the ferry moored at the quay
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
};
