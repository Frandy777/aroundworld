import { box, cyl, decal, final, stone, GOLD, INK, type ModelDef } from '../../builder';

export default {
  key: 'Zurich',
  props: [ // Grossmünster: twin sandstone towers on a plinth by the Limmat, each with a slate dome and gold cross, Charlemagne seated in a niche on the right one, a lattice window and the dark red ridge turret between them; swans and ripples on the river, lindens, lamps, and the flags of Zürich and Switzerland
    final((g) => {
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
        decal(g, FRONT, x, y, FZ + 0.02);                                                                                                                       // its windows and pilasters
        up(1.2); up(0.06, W + 0.06, TRIM, box); up(0.72); up(0.06, W + 0.06, TRIM, box); up(0.5); up(0.05, W + 0.1, TRIM, box);                                 // shaft, cornice, belfry, cornice, upper stage, terrace slab
        [[W + 0.1, 0.04, 0, 1], [W + 0.1, 0.04, 0, -1], [0.04, W + 0.1, 1, 0], [0.04, W + 0.1, -1, 0]].forEach(([w, d, a, b]) => box(g, w, 0.1, d, TRIM, x + a * R, y, TZ + b * R)); // its balustrade
        [[0.205, SAND], [0.19, SAND]].forEach(([r, c], k) => { cyl(g, r, 0.33, c, x, y + 0.33 * k, TZ).rotation.y = Math.PI / 10; });                           // the octagonal stage, tapering
        decal(g, LANCET, x, y + 0.04, TZ + 0.2);                                                                                                                // its lancets
        y += 0.66; cyl(g, 0.235, 0.05, TRIM, x, y, TZ); y += 0.05;                                                                                              // the crown ring under the dome
        [0.215, 0.25, 0.255, 0.23, 0.18, 0.11, 0.05].forEach((r, i) => cyl(g, r, 0.06, i & 1 ? SLATE2 : SLATE, x, y + i * 0.06, TZ));                           // the dome: a stepped onion in slate
        y += 0.42; cyl(g, 0.015, 0.08, GOLD, x, y, TZ); cyl(g, 0.04, 0.05, GOLD, x, y + 0.06, TZ); box(g, 0.03, 0.14, 0.03, GOLD, x, y + 0.11, TZ); box(g, 0.1, 0.03, 0.03, GOLD, x, y + 0.18, TZ); // the gold post, ball and cross
      }
      decal(g, KARL, TX, 0.95, FZ + 0.02);                                                                                                                      // Charlemagne, seated in his niche on the south tower
      stone(g, 0.37, 0.9, 0.42, SAND, 0, 0.3, -0.01); decal(g, LATTICE, 0, 0.7, 0.22);                                                                          // the wall between the towers and its lattice window
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
} satisfies ModelDef;
