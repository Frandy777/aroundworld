import * as THREE from 'three';
import { box, cyl, decal, final, glass, hip, lampsOf, stone, GOLD, INK, type ModelDef } from '../../builder';

const COPPER = 0x3fa08e, FWD = 0.4, BANK = 0.22, Z = -0.95;
const bank = (g: THREE.Group, x: number, w: number) => stone(g, w, BANK, 0.8, 0xcfc8b6, x, 0, Z);
const finial = (g: THREE.Group, x: number, y: number, z: number, k = 1) => { box(g, 0.015 * k, 0.07 * k, 0.015 * k, GOLD, x, y, z); box(g, 0.05 * k, 0.05 * k, 0.05 * k, GOLD, x, y + 0.06 * k, z); };
const around = (g: THREE.Group, x: number, z: number) => [0, 1, 2, 3].map((k) => { const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = (k * Math.PI) / 2; g.add(p); return p; });

export default {
  key: 'Zurich',
  lamps: [{ at: [0, 0.85, 0.95], color: 0xffbe66, power: 3.8, reach: 5.5, final: true }],
  props: [
    final((r) => {
      const g = new THREE.Group(); g.position.z = FWD; r.add(g);
      const W = 0.59, TX = 0.48, TZ = 0.02, R = (W + 0.06) / 2, FZ = TZ + W / 2;
      const SAND = 0xd8cdb4, TRIM = 0xece4d0, DARK = 0xb4a78d, SLATE = 0x56627e, SLATE2 = 0x7280a0, ROOF = 0x8c6a42, MAROON = 0x7a1f35, DGOLD = 0xe0a020, WATER = 0x35a0b0, FOAM = 0xdcefff, PAVE = 0xcfc8b6, WOOD = 0x6e3a12, JET = 0x9fd8ff;
      const gap = (n: number) => Array(n).fill('.............');
      const quoin = (rows: string[]) => rows.map((r) => 'x' + r.slice(1, 12) + 'x');
      const SLIT = Array(4).fill('...O.....O...');
      const BELFRY = ['...O.....O...', ...Array(2).fill('..OdO...OdO..'), ...Array(5).fill('.OedeO.OedeO.'), 'xxxxxxxxxxxxx'];
      const UPPER = ['...O.....O...', ...Array(4).fill('..OeO...OeO..'), '.xxxxxxxxxxx.'];
      const FRONT = quoin([...gap(5), ...UPPER, ...gap(8), ...BELFRY, ...gap(20), ...SLIT, ...gap(4)]);
      const LANCET = ['....O....', ...Array(13).fill('.O.OdO.O.')];
      const KARL = ['.OOOOO.', '.OYOYO.', '.OYYYO.', '.OaaaO.', '.ObwbO.', 'YaaaaaO', '.ObbbO.', 'xxxxxxx', '.xxxxx.'];
      const LATTICE = ['.OOO.', ...Array(5).fill(['OabaO', 'ObabO']).flat(), 'OOOOO'];
      const ZURICH = ['wwwwwww', 'LLwwwww', 'LLLwwww', 'LLLLLww', 'LLLLLLw'], SWISS = ['RRRRRR', 'RRwwRR', 'RwwwwR', 'RwwwwR', 'RRwwRR', 'RRRRRR'];
      box(g, 2.4, 0.1, 1.9, WATER); stone(g, 2.4, 0.12, 1.5, PAVE, 0, 0.1, -0.2); box(g, 2.4, 0.07, 0.05, TRIM, 0, 0.22, 0.525); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.575);
      stone(g, 1.66, 0.08, 1.31, DARK, 0, 0.22, -0.295);
      for (const s of [-1, 1]) {
        const x = s * TX; let y = 0.3;
        const up = (h: number, w = W, c = SAND, m = stone) => { m(g, w, h, w, c, x, y, TZ); y += h; };
        decal(g, FRONT, x, y, FZ + 0.02, lampsOf(FRONT, 'Ode'));
        up(1.2); up(0.06, W + 0.06, TRIM, box); up(0.72); up(0.06, W + 0.06, TRIM, box); up(0.5); up(0.05, W + 0.1, TRIM, box);
        [[W + 0.1, 0.04, 0, 1], [W + 0.1, 0.04, 0, -1], [0.04, W + 0.1, 1, 0], [0.04, W + 0.1, -1, 0]].forEach(([w, d, a, b]) => box(g, w, 0.1, d, TRIM, x + a * R, y, TZ + b * R));
        [[0.205, SAND], [0.19, SAND]].forEach(([r, c], k) => { cyl(g, r, 0.33, c, x, y + 0.33 * k, TZ).rotation.y = Math.PI / 10; });
        decal(g, LANCET, x, y + 0.04, TZ + 0.2, lampsOf(LANCET, 'Ode'));
        y += 0.66; cyl(g, 0.235, 0.05, TRIM, x, y, TZ); y += 0.05;
        [0.215, 0.25, 0.255, 0.23, 0.18, 0.11, 0.05].forEach((r, i) => cyl(g, r, 0.06, i & 1 ? SLATE2 : SLATE, x, y + i * 0.06, TZ));
        y += 0.42; cyl(g, 0.015, 0.08, GOLD, x, y, TZ); cyl(g, 0.04, 0.05, GOLD, x, y + 0.06, TZ); box(g, 0.03, 0.14, 0.03, GOLD, x, y + 0.11, TZ); box(g, 0.1, 0.03, 0.03, GOLD, x, y + 0.18, TZ);
      }
      decal(g, KARL, TX, 0.95, FZ + 0.02);
      stone(g, 0.37, 0.9, 0.42, SAND, 0, 0.3, -0.01); decal(g, LATTICE, 0, 0.7, 0.22, lampsOf(LATTICE, 'a'));
      [0.37, 0.3, 0.23, 0.16, 0.09].forEach((w, i) => stone(g, w, 0.05, 0.42, SAND, 0, 1.2 + i * 0.05, -0.01));
      stone(g, 1.52, 0.3, 0.73, SAND, 0, 0.3, -0.585);
      [1.52, 1.3, 1.08].forEach((w, i) => box(g, w, 0.07, 0.73, ROOF, 0, 0.6 + i * 0.07, -0.585));
      stone(g, 0.74, 0.16, 0.73, SAND, 0, 0.81, -0.585);
      [0.84, 0.62, 0.4, 0.18].forEach((w, i) => box(g, w, 0.08, 0.73, ROOF, 0, 0.97 + i * 0.08, -0.585));
      box(g, 0.16, 0.1, 0.16, TRIM, 0, 1.29, -0.5); box(g, 0.1, 0.12, 0.1, MAROON, 0, 1.39, -0.5); box(g, 0.14, 0.03, 0.14, DGOLD, 0, 1.51, -0.5);
      [0.09, 0.065, 0.045, 0.025].forEach((w, i) => box(g, w, 0.15, w, MAROON, 0, 1.54 + i * 0.15, -0.5)); box(g, 0.02, 0.1, 0.02, GOLD, 0, 2.14, -0.5);
      for (const x of [-1.03, 1.03]) { box(g, 0.07, 0.3, 0.07, WOOD, x, 0.22, 0.2); cyl(g, 0.21, 0.14, 0x2f7a4a, x, 0.5, 0.2); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, 0.2); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, 0.2); }
      [-0.9, 0.9].forEach((x) => { box(g, 0.04, 0.5, 0.04, INK, x, 0.22, 0.45); box(g, 0.09, 0.08, 0.09, 0xfff6b0, x, 0.72, 0.45); });
      ([[-1.1, ZURICH], [1.1, SWISS]] as [number, string[]][]).forEach(([x, rows]) => { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.22, 0.45); decal(g, rows, x - Math.sign(x) * rows[0].length / 44, 0.95, 0.45); });
      [[-0.45, 0.8], [0.55, 0.74]].forEach(([x, z]) => { box(g, 0.14, 0.06, 0.08, 0xffffff, x, 0.1, z); box(g, 0.03, 0.1, 0.03, 0xffffff, x + 0.06, 0.16, z); box(g, 0.05, 0.03, 0.04, 0xffffff, x + 0.08, 0.26, z); box(g, 0.03, 0.02, 0.02, 0xff9a2e, x + 0.115, 0.26, z); });
      [[-0.1, 0.9], [0.2, 0.68], [0.95, 0.85]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));
    }),
  ],
  levels: [
    [
      final((g) => {
        const W = 0.68, X = -0.85, C = 2.9, E = 3.75, H = 1.4, A = (W + 0.06) / 2;
        const LOW = 0xcdb899, UP = 0xd7caa9, TRIM = 0xece4d0, BAND = 0x5b6d63, SLATE = 0x66625c;
        const CLOCK = ['....ooooo....', '..oooYYYooo..', '.oooYoooYooo.', '.ooo....YYoo.', 'ooY.....YYYoo', 'oYo....YY.oYo', 'oYYYYYY...oYo', 'oYo.......oYo', 'ooY.......Yoo', '.ooo.....ooo.', '.oooYoooYooo.', '..oooYYYooo..', '....ooooo....'];
        const LANCET = ['.O.', 'OdO', 'OdO', 'OdO', 'OdO', 'OdO', 'xxx'];
        const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), top = V(X, E + H, Z);
        const rib = (from: THREE.Vector3) => { const v = top.clone().sub(from), r = new THREE.Group(); r.position.copy(from); r.quaternion.setFromUnitVectors(V(0, 1, 0), v.clone().normalize()); g.add(r); box(r, 0.05, v.length(), 0.05, COPPER); };
        const sides = around(g, X, Z), [front, ...others] = sides;
        bank(g, -0.76, 0.92);
        stone(g, W, C - 0.05 - BANK, W, LOW, X, BANK, Z); box(g, W + 0.05, 0.05, W + 0.05, BAND, X, C - 0.05, Z);
        stone(g, W, E - 0.05 - C, W, UP, X, C, Z); box(g, W + 0.07, 0.05, W + 0.07, TRIM, X, E - 0.05, Z);
        hip(g, 2 * A, 2 * A, H, E, SLATE, X, Z); finial(g, X, E + H, Z, 1.4);
        for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rib(V(X + x * A, E, Z + z * A));
        for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) rib(V(X + x * 0.24, E + 0.5, Z + z * 0.24));
        sides.forEach((p) => {
          const f = W / 2 + 0.03;
          box(p, 0.2, 0.22, 0.16, UP, 0, E, f - 0.08); hip(p, 0.26, 0.22, 0.22, E + 0.22, COPPER, 0, f - 0.08); finial(p, 0, E + 0.44, f - 0.08);
          for (const x of [-0.05, 0.05]) box(p, 0.035, 0.08, 0.012, INK, x, E + 0.07, f + 0.004, glass(INK));
          box(p, 0.08, 0.24, 0.08, UP, 0.3, E, 0.3); hip(p, 0.1, 0.1, 0.32, E + 0.24, COPPER, 0.3, 0.3); finial(p, 0.3, E + 0.52, 0.3, 0.9);
        });
        const clock = decal(front, CLOCK, 0, C + 0.1, W / 2 + 0.02, lampsOf(CLOCK, 'Y')); others.forEach((p) => p.add(clock.clone()));
        for (const y of [0.9, 2.15]) decal(front, LANCET, 0, y, W / 2 + 0.02, lampsOf(LANCET, 'd'));
      }),
    ],
    [
      final((g) => {
        const W = 0.55, X = 0.93, E = 2.85, SAND = 0xcda57a;
        const CLOCK = ['...YYYYY...', '..YoooooY..', '.YoooYoooY.', 'YooooooYooY', 'YooooYYoooY', 'YoYYYYYoYoY', 'YooooYooooY', 'YoooooooooY', '.YoooYoooY.', '..YoooooY..', '...YYYYY...'];
        const WINDOW = ['..O..', '.OdO.', 'OdddO', 'OdOdO', 'OdOdO', 'OdOdO', 'OdOdO', 'OdOdO', 'OeOeO', 'xxxxx'];
        const sides = around(g, X, Z), [front, ...others] = sides;
        bank(g, 0.85, 0.78);
        stone(g, W, E - BANK, W, SAND, X, BANK, Z);
        hip(g, W, W, 0.8, E, COPPER, X, Z); hip(g, 0.32, 0.32, 2.65, E + 0.3, COPPER, X, Z); finial(g, X, E + 2.95, Z, 1.2);
        sides.forEach((p) => {
          for (let k = 0; k < 6; k++) stone(p, W - 0.095 * k, 0.08, 0.1, SAND, 0, E + 0.08 * k, W / 2 - 0.05);
          finial(p, 0, E + 0.48, W / 2 - 0.05);
        });
        const clock = decal(front, CLOCK, 0, E - 0.37, W / 2 + 0.02, lampsOf(CLOCK, 'Y')); others.forEach((p) => p.add(clock.clone()));
        decal(front, WINDOW, 0, E - 1.18, W / 2 + 0.02, lampsOf(WINDOW, 'de'));
      }),
    ],
  ],
} satisfies ModelDef;
