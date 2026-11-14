import * as THREE from 'three';
import { box, cyl, decal, final, glass, hip, lampsOf, stone, GOLD, INK, type ModelDef } from '../../builder';

// What the two towers behind the Grossmünster share (see `levels`): the green of weathered copper, how far forward on its plot the church stands to leave them room, the height of the quay they stand on (the church's own) and the line of their centres on it
const COPPER = 0x3fa08e, FWD = 0.4, BANK = 0.22, Z = -0.95;
const bank = (g: THREE.Group, x: number, w: number) => stone(g, w, BANK, 0.8, 0xcfc8b6, x, 0, Z);                                                               // a stretch of that quay behind the church, in its stone and w wide, for a tower to stand on
const finial = (g: THREE.Group, x: number, y: number, z: number, k = 1) => { box(g, 0.015 * k, 0.07 * k, 0.015 * k, GOLD, x, y, z); box(g, 0.05 * k, 0.05 * k, 0.05 * k, GOLD, x, y + 0.06 * k, z); }; // a gold pin with a ball on it, k times the size, on the tip of a roof
const around = (g: THREE.Group, x: number, z: number) => [0, 1, 2, 3].map((k) => { const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = (k * Math.PI) / 2; g.add(p); return p; }); // a tower's four sides: a frame for each, turned so that its side is the front (+z), to draw what the tower has on every side once

export default {
  key: 'Zurich',
  lamps: [{ at: [0, 0.85, 0.95], color: 0xffbe66, power: 3.8, reach: 5.5, final: true }], // the Bahnhofstrasse street lamps (the church stands 0.4 forward on its plot)
  props: [ // Grossmünster: twin sandstone towers on a plinth by the Limmat, each with a slate dome and gold cross, Charlemagne seated in a niche on the right one, a lattice window and the dark red ridge turret between them; swans and ripples on the river, lindens, lamps, and the flags of Zürich and Switzerland
    final((r) => {
      const g = new THREE.Group(); g.position.z = FWD; r.add(g);                                                                                                // the church stands FWD forward on its plot, which leaves its back for the two towers that rise behind it
      const W = 0.59, TX = 0.48, TZ = 0.02, R = (W + 0.06) / 2, FZ = TZ + W / 2;                                                                                // a tower: its width, its centre line (x either side of the middle, z), half a cornice, its front face
      const SAND = 0xd8cdb4, TRIM = 0xece4d0, DARK = 0xb4a78d, SLATE = 0x56627e, SLATE2 = 0x7280a0, ROOF = 0x8c6a42, MAROON = 0x7a1f35, DGOLD = 0xe0a020, WATER = 0x35a0b0, FOAM = 0xdcefff, PAVE = 0xcfc8b6, WOOD = 0x6e3a12, JET = 0x9fd8ff; // paints
      const gap = (n: number) => Array(n).fill('.............');                                                                                                        // n bare rows of a tower face
      const quoin = (rows: string[]) => rows.map((r) => 'x' + r.slice(1, 12) + 'x');                                                                                      // a pale pilaster up either edge of every row
      const SLIT = Array(4).fill('...O.....O...');                                                                                                              // the slit windows of the shaft
      const BELFRY = ['...O.....O...', ...Array(2).fill('..OdO...OdO..'), ...Array(5).fill('.OedeO.OedeO.'), 'xxxxxxxxxxxxx'];                                  // the belfry's pointed windows over a sill
      const UPPER = ['...O.....O...', ...Array(4).fill('..OeO...OeO..'), '.xxxxxxxxxxx.'];                                                                      // the upper stage's small windows over a sill
      const FRONT = quoin([...gap(5), ...UPPER, ...gap(8), ...BELFRY, ...gap(20), ...SLIT, ...gap(4)]);                                                         // a tower's face, top to foot: upper windows, belfry windows, slits, 56 rows
      const LANCET = ['....O....', ...Array(13).fill('.O.OdO.O.')];                                                                                             // the lancets round the octagon
      const KARL = ['.OOOOO.', '.OYOYO.', '.OYYYO.', '.OaaaO.', '.ObwbO.', 'YaaaaaO', '.ObbbO.', 'xxxxxxx', '.xxxxx.'];                                         // Charlemagne: crown, beard, sword across his lap, in his niche
      const LATTICE = ['.OOO.', ...Array(5).fill(['OabaO', 'ObabO']).flat(), 'OOOOO'];                                                                          // the diamond lattice of the big window
      const ZURICH = ['wwwwwww', 'LLwwwww', 'LLLwwww', 'LLLLLww', 'LLLLLLw'], SWISS = ['RRRRRR', 'RRwwRR', 'RwwwwR', 'RwwwwR', 'RRwwRR', 'RRRRRR'];             // the flags: Zürich's blue and white split on the diagonal, the Swiss white cross on red
      box(g, 2.4, 0.1, 1.9, WATER); stone(g, 2.4, 0.12, 1.5, PAVE, 0, 0.1, -0.2); box(g, 2.4, 0.07, 0.05, TRIM, 0, 0.22, 0.525); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.575); // the Limmat, the quay, its parapet, foam along the wall
      stone(g, 1.66, 0.08, 1.31, DARK, 0, 0.22, -0.295);                                                                                                        // the church's plinth
      for (const s of [-1, 1]) {                                                                                                                                // the twin towers; the south one (right) is the Karlsturm
        const x = s * TX; let y = 0.3;                                                                                                                          // this tower's centre line, the height built so far
        const up = (h: number, w = W, c = SAND, m = stone) => { m(g, w, h, w, c, x, y, TZ); y += h; };                                                                  // the next stage of the shaft: ashlar, or a plain box for a cornice
        decal(g, FRONT, x, y, FZ + 0.02, lampsOf(FRONT, 'Ode')); // its windows and pilasters
        up(1.2); up(0.06, W + 0.06, TRIM, box); up(0.72); up(0.06, W + 0.06, TRIM, box); up(0.5); up(0.05, W + 0.1, TRIM, box);                                 // shaft, cornice, belfry, cornice, upper stage, terrace slab
        [[W + 0.1, 0.04, 0, 1], [W + 0.1, 0.04, 0, -1], [0.04, W + 0.1, 1, 0], [0.04, W + 0.1, -1, 0]].forEach(([w, d, a, b]) => box(g, w, 0.1, d, TRIM, x + a * R, y, TZ + b * R)); // its balustrade
        [[0.205, SAND], [0.19, SAND]].forEach(([r, c], k) => { cyl(g, r, 0.33, c, x, y + 0.33 * k, TZ).rotation.y = Math.PI / 10; });                           // the octagonal stage, tapering
        decal(g, LANCET, x, y + 0.04, TZ + 0.2, lampsOf(LANCET, 'Ode')); // its lancets
        y += 0.66; cyl(g, 0.235, 0.05, TRIM, x, y, TZ); y += 0.05;                                                                                              // the crown ring under the dome
        [0.215, 0.25, 0.255, 0.23, 0.18, 0.11, 0.05].forEach((r, i) => cyl(g, r, 0.06, i & 1 ? SLATE2 : SLATE, x, y + i * 0.06, TZ));                           // the dome: a stepped onion in slate
        y += 0.42; cyl(g, 0.015, 0.08, GOLD, x, y, TZ); cyl(g, 0.04, 0.05, GOLD, x, y + 0.06, TZ); box(g, 0.03, 0.14, 0.03, GOLD, x, y + 0.11, TZ); box(g, 0.1, 0.03, 0.03, GOLD, x, y + 0.18, TZ); // the gold post, ball and cross
      }
      decal(g, KARL, TX, 0.95, FZ + 0.02);                                                                                                                      // Charlemagne, seated in his niche on the south tower
      stone(g, 0.37, 0.9, 0.42, SAND, 0, 0.3, -0.01); decal(g, LATTICE, 0, 0.7, 0.22, lampsOf(LATTICE, 'a')); // the wall between the towers and its lattice window
      [0.37, 0.3, 0.23, 0.16, 0.09].forEach((w, i) => stone(g, w, 0.05, 0.42, SAND, 0, 1.2 + i * 0.05, -0.01));                                                 // its stepped gable
      stone(g, 1.52, 0.3, 0.73, SAND, 0, 0.3, -0.585);                                                                                                          // the nave and aisles behind
      [1.52, 1.3, 1.08].forEach((w, i) => box(g, w, 0.07, 0.73, ROOF, 0, 0.6 + i * 0.07, -0.585));                                                              // the aisle roofs
      stone(g, 0.74, 0.16, 0.73, SAND, 0, 0.81, -0.585);                                                                                                        // the clerestory
      [0.84, 0.62, 0.4, 0.18].forEach((w, i) => box(g, w, 0.08, 0.73, ROOF, 0, 0.97 + i * 0.08, -0.585));                                                       // the nave roof, stepped
      box(g, 0.16, 0.1, 0.16, TRIM, 0, 1.29, -0.5); box(g, 0.1, 0.12, 0.1, MAROON, 0, 1.39, -0.5); box(g, 0.14, 0.03, 0.14, DGOLD, 0, 1.51, -0.5);              // the ridge turret: base, lantern, gold gallery
      [0.09, 0.065, 0.045, 0.025].forEach((w, i) => box(g, w, 0.15, w, MAROON, 0, 1.54 + i * 0.15, -0.5)); box(g, 0.02, 0.1, 0.02, GOLD, 0, 2.14, -0.5);        // its needle spire and vane
      for (const x of [-1.03, 1.03]) { box(g, 0.07, 0.3, 0.07, WOOD, x, 0.22, 0.2); cyl(g, 0.21, 0.14, 0x2f7a4a, x, 0.5, 0.2); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, 0.2); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, 0.2); } // two lindens
      [-0.9, 0.9].forEach((x) => { box(g, 0.04, 0.5, 0.04, INK, x, 0.22, 0.45); box(g, 0.09, 0.08, 0.09, 0xfff6b0, x, 0.72, 0.45); });                          // two street lamps
      ([[-1.1, ZURICH], [1.1, SWISS]] as [number, string[]][]).forEach(([x, rows]) => { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.22, 0.45); decal(g, rows, x - Math.sign(x) * rows[0].length / 44, 0.95, 0.45); }); // the flags of Zürich and Switzerland on their masts
      [[-0.45, 0.8], [0.55, 0.74]].forEach(([x, z]) => { box(g, 0.14, 0.06, 0.08, 0xffffff, x, 0.1, z); box(g, 0.03, 0.1, 0.03, 0xffffff, x + 0.06, 0.16, z); box(g, 0.05, 0.03, 0.04, 0xffffff, x + 0.08, 0.26, z); box(g, 0.03, 0.02, 0.02, 0xff9a2e, x + 0.115, 0.26, z); }); // two swans
      [[-0.1, 0.9], [0.2, 0.68], [0.95, 0.85]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));                                                 // ripples on the river
    }),
  ],
  levels: [ // the Grossmünster stands at every level; each upgrade raises a church tower behind it, higher than its twin towers, on a stretch of quay of its own
    [ // Lv 1, St. Peter's behind the church on the left: a sandstone tower with the biggest church clock in Europe, a black ring of gold numerals and hands on every side, over a plain shaft with lancet windows, under a steep slate spire with ribs of copper green, a gabled dormer on each side and a gold-tipped pinnacle at each corner
      final((g) => {
        const W = 0.68, X = -0.85, C = 2.9, E = 3.75, H = 1.4, A = (W + 0.06) / 2;                                                                              // the tower's width and centre, the foot of its clock stage, its eave, the spire's rise and half its base
        const LOW = 0xcdb899, UP = 0xd7caa9, TRIM = 0xece4d0, BAND = 0x5b6d63, SLATE = 0x66625c;                                                                // paints: the stone of the shaft and of the stage, the cornice, the dark string course, the slate
        const CLOCK = ['....ooooo....', '..oooYYYooo..', '.oooYoooYooo.', '.ooo....YYoo.', 'ooY.....YYYoo', 'oYo....YY.oYo', 'oYYYYYY...oYo', 'oYo.......oYo', 'ooY.......Yoo', '.ooo.....ooo.', '.oooYoooYooo.', '..oooYYYooo..', '....ooooo....']; // the dial: a broad black ring with a gold numeral at every hour (a bar at the quarters), the wall showing through its middle, the gold hands at a quarter to two
        const LANCET = ['.O.', 'OdO', 'OdO', 'OdO', 'OdO', 'OdO', 'xxx'];                                                                                       // the lancet window of the shaft
        const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), top = V(X, E + H, Z);                                                        // the spire's tip
        const rib = (from: THREE.Vector3) => { const v = top.clone().sub(from), r = new THREE.Group(); r.position.copy(from); r.quaternion.setFromUnitVectors(V(0, 1, 0), v.clone().normalize()); g.add(r); box(r, 0.05, v.length(), 0.05, COPPER); }; // a rib of copper laid on the roof from a point to the tip
        const sides = around(g, X, Z), [front, ...others] = sides;
        bank(g, -0.76, 0.92);                                                                                                                                   // its stretch of quay
        stone(g, W, C - 0.05 - BANK, W, LOW, X, BANK, Z); box(g, W + 0.05, 0.05, W + 0.05, BAND, X, C - 0.05, Z);                                               // the plain shaft, the dark string course over it
        stone(g, W, E - 0.05 - C, W, UP, X, C, Z); box(g, W + 0.07, 0.05, W + 0.07, TRIM, X, E - 0.05, Z);                                                      // the clock stage, the cornice
        hip(g, 2 * A, 2 * A, H, E, SLATE, X, Z); finial(g, X, E + H, Z, 1.4);                                                                                   // the spire, the gold ball on its tip
        for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rib(V(X + x * A, E, Z + z * A));                                                             // a rib up every corner of the spire
        for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) rib(V(X + x * 0.24, E + 0.5, Z + z * 0.24));                                                   // and one up the middle of every side, from over the dormer
        sides.forEach((p) => { // on every side: a dormer rising from the cornice (flush with it, so that it stands out of the roof) and the pinnacle at the corner after it
          const f = W / 2 + 0.03;                                                                                                                               // the dormer's front
          box(p, 0.2, 0.22, 0.16, UP, 0, E, f - 0.08); hip(p, 0.26, 0.22, 0.22, E + 0.22, COPPER, 0, f - 0.08); finial(p, 0, E + 0.44, f - 0.08);               // the dormer's walls, its roof, its gold ball
          for (const x of [-0.05, 0.05]) box(p, 0.035, 0.08, 0.012, INK, x, E + 0.07, f + 0.004, glass(INK)); // its two windows
          box(p, 0.08, 0.24, 0.08, UP, 0.3, E, 0.3); hip(p, 0.1, 0.1, 0.32, E + 0.24, COPPER, 0.3, 0.3); finial(p, 0.3, E + 0.52, 0.3, 0.9);                    // the pinnacle: its shaft, its needle roof, its gold ball
        });
        const clock = decal(front, CLOCK, 0, C + 0.1, W / 2 + 0.02, lampsOf(CLOCK, 'Y')); others.forEach((p) => p.add(clock.clone())); // the clock on every side (the copies share its material: one draw call)
        for (const y of [0.9, 2.15]) decal(front, LANCET, 0, y, W / 2 + 0.02, lampsOf(LANCET, 'd')); // the lancet windows up the shaft of its front, clear of the church's roofs
      }),
    ],
    [ // Lv 2, the Fraumünster behind the church on the right: a slender tower of warm sandstone with a Gothic window and, on every side, a black and gold clock under a stepped gable, a squat copper roof and a long needle of green copper rising from it, a gold ball on every gable and on its tip, the highest thing on the plot
      final((g) => {
        const W = 0.55, X = 0.93, E = 2.85, SAND = 0xcda57a;                                                                                                    // the tower's width and centre, its eave; the warm sandstone
        const CLOCK = ['...YYYYY...', '..YoooooY..', '.YoooYoooY.', 'YooooooYooY', 'YooooYYoooY', 'YoYYYYYoYoY', 'YooooYooooY', 'YoooooooooY', '.YoooYoooY.', '..YoooooY..', '...YYYYY...']; // the dial: a gold rim, a black face with a gold mark at the quarters, a gold sun at its heart and the hands at a quarter to two
        const WINDOW = ['..O..', '.OdO.', 'OdddO', 'OdOdO', 'OdOdO', 'OdOdO', 'OdOdO', 'OdOdO', 'OeOeO', 'xxxxx'];                                              // the pointed window under the clock, a mullion between its lights
        const sides = around(g, X, Z), [front, ...others] = sides;
        bank(g, 0.85, 0.78);                                                                                                                                    // its stretch of quay
        stone(g, W, E - BANK, W, SAND, X, BANK, Z);                                                                                                             // the tower
        hip(g, W, W, 0.8, E, COPPER, X, Z); hip(g, 0.32, 0.32, 2.65, E + 0.3, COPPER, X, Z); finial(g, X, E + 2.95, Z, 1.2);                                    // the squat roof, the needle that comes out of it, the gold ball on its tip
        sides.forEach((p) => { // on every side: a stepped gable of the tower's stone, in front of the roof, with a gold ball on its tip
          for (let k = 0; k < 6; k++) stone(p, W - 0.095 * k, 0.08, 0.1, SAND, 0, E + 0.08 * k, W / 2 - 0.05);
          finial(p, 0, E + 0.48, W / 2 - 0.05);
        });
        const clock = decal(front, CLOCK, 0, E - 0.37, W / 2 + 0.02, lampsOf(CLOCK, 'Y')); others.forEach((p) => p.add(clock.clone())); // the clock on every side, up into the gable (the copies share its material: one draw call)
        decal(front, WINDOW, 0, E - 1.18, W / 2 + 0.02, lampsOf(WINDOW, 'de')); // the window under the clock on its front
      }),
    ],
  ],
} satisfies ModelDef;
