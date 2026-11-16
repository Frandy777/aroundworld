import * as THREE from 'three';
import { box, cyl, decal, final, glass, hip, lamplit, mat, part, rnd, stone, GOLD, INK, IRON, type ModelDef } from '../../builder';
import { canvas, shade } from '../../art';
import { DENSITY, pixelTexture, toon } from '../../scene';

const WW = 24, WH = 16, STONES = [0xdcbf86, 0xd4b57a, 0xe1c48c, 0xcfae70], COURSES = [[2, 5], [2, 6], [3, 7], [4, 9], [5, 12]];
const face = (night: boolean) => pixelTexture(canvas(WW, WH, (g) => {
  const at = (c: number, k: number, x: number, y: number, w = 1, h = 1) => { g.fillStyle = shade(c, k * (night ? 0.3 : 1)); g.fillRect(x, y, w, h); };
  let y = 0;
  COURSES.forEach(([h, sw], c) => {
    let x = -Math.floor(rnd(c, 9) * sw);
    for (let k = 0; x < WW; k++) {
      const w = Math.max(3, Math.round(sw * (0.7 + 0.6 * rnd(c, k)))), s = STONES[Math.floor(rnd(c, k, 1) * STONES.length)], x0 = Math.max(x, 0), x1 = Math.min(x + w, WW);
      at(s, 1, x0, y, x1 - x0, h); at(s, 1.15, x0, y, x1 - x0, 1); if (x >= 0) at(s, 1.15, x0, y, 1, h);
      at(s, 0.75, x0, y + h - 1, x1 - x0, 1); if (x + w <= WW) at(s, 0.75, x1 - 1, y, 1, h);
      x += w;
    }
    y += h;
  });
  [[4, 7], [10, 4], [15, 7], [20, 11], [7, 11]].forEach(([x, j]) => { at(0x3f7d3a, 1, x, j - 1, 2, 1); at(0x6fb552, 1, x + 1, j - 2); });
  [[3, 9], [8, 13], [12, 10], [17, 14], [21, 12], [6, 14]].forEach(([x, j]) => at(0xfffaf0, 1, x, j));
}));
const FACE = toon(0xffffff, { map: face(false), emissive: 0xffffff, emissiveMap: face(true) });
const person = (g: THREE.Group, x: number, y: number, z: number, c: number, lean = 0) => {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.x = lean; g.add(p);
  box(p, 0.07, 0.11, 0.05, c); box(p, 0.05, 0.045, 0.05, 0xf5b88c, 0, 0.11); box(p, 0.08, 0.015, 0.075, INK, 0, 0.15); box(p, 0.05, 0.03, 0.05, INK, 0, 0.165);
};

export default {
  key: 'Jerusalem',
  lamps: [{ at: [0, 0.95, 0.75], color: 0xffc870, power: 4, reach: 6.5, final: true }],
  props: [
    final((g) => {
      const [CX, CZ, PY] = [0, -0.2, 0.236];
      const A = (12 / 44) * (1 + Math.SQRT2), C8 = Math.cos(Math.PI / 8), Y0 = PY + 0.09, DY = Y0 + 0.63;
      const PLAZA = 0xd5c9ab, DECK = 0xe6dabb, TRIM = 0xf4eedb, MARBLE = 0xf0e9d4, BLUE = 0x2b68d4, LEAD = 0x8e97ab, LEAD2 = 0xa9b1c4, DGOLD = 0xf0a020, GLASS = 0x1a2250, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;
      const CYPRESS = [0x1f5a3a, 0x2a6e45, 0x35804f], OLIVE = [0x6f8f5a, 0x8aa86c, 0xa3bf86];
      const FACE = [
        'eaaeaeaaeaae', 'eeaeaaeeaeea',
        'LuaaLaauaaLu', 'uLOOuOOLOOuL', 'LueOLeOueOLu', 'uLeOueOLeOuL', 'LuaaLaauaaLu',
        'xxxxxxxxxxxx', 'xxbaxbaxbaxx', 'xxbaxbaxbaxx', 'aaaaaaaaaaaa',
      ];
      const PORTAL = ['..xxx..', '.xOOOx.', 'xxOOOxx', 'xOOOOOx', 'xOOYOOx', 'xOOOOOx', 'xOOOOOx'];
      const OCT = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, Math.PI / 8), ROUND = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, Math.PI / 16);
      const ARCH = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(-0.22, 0).lineTo(-0.22, 0.26).quadraticCurveTo(-0.16, 0.42, 0, 0.58).quadraticCurveTo(0.16, 0.42, 0.22, 0.26).lineTo(0.22, 0).lineTo(0.14, 0).lineTo(0.14, 0.26).quadraticCurveTo(0.1, 0.36, 0, 0.47).quadraticCurveTo(-0.1, 0.36, -0.14, 0.26).lineTo(-0.14, 0), { depth: 0.08, bevelEnabled: false });
      const MOON = new THREE.TorusGeometry(0.1, 0.024, 4, 10, 4.7);
      const at = (a: number, r: number, t = 0) => [CX + Math.sin(a) * r + Math.cos(a) * t, CZ + Math.cos(a) * r - Math.sin(a) * t];
      const oct = (a: number, h: number, c: number, y: number) => { part(g, OCT, h, mat(c), CX, y, CZ).scale.set(a / C8, h, a / C8); };
      const disc = (r: number, h: number, c: number | THREE.Material, y: number, x = CX, z = CZ) => { part(g, ROUND, h, typeof c === 'number' ? mat(c) : c, x, y, z).scale.set(r, h, r); };
      const porch = (a: number) => { const [x, z] = at(a, A + 0.06), [px, pz] = at(a, A + 0.162); stone(g, 0.318, 0.318, 0.2, MARBLE, x, Y0, z).rotation.y = a; box(g, 0.41, 0.04, 0.28, LEAD, x, Y0 + 0.318, z).rotation.y = a; decal(g, PORTAL, px, Y0, pz).rotation.y = a; };
      stone(g, 2.4, 0.1, 1.9, PLAZA);
      stone(g, 2.2, 0.136, 1.6, DECK, 0, 0.1, -0.1);
      [0, 1, 2].forEach((k) => stone(g, 0.64, 0.0455 * (k + 1), 0.083, DECK, CX, 0.1, 0.9075 - 0.083 * k));
      oct(A + 0.09, 0.045, PLAZA, PY); oct(A + 0.045, 0.045, 0xe6dcc3, PY + 0.045);
      oct(A, 0.182, MARBLE, Y0); oct(A, 0.318, BLUE, Y0 + 0.182); oct(A + 0.04, 0.045, TRIM, Y0 + 0.5);
      [0, 1, -1, 2, -2].forEach((k) => { const a = (k * Math.PI) / 4, [x, z] = at(a, A + 0.015); decal(g, FACE, x, Y0, z).rotation.y = a; });
      for (let k = 0; k < 8; k++) for (const t of [-0.19, 0, 0.19]) { const a = (k * Math.PI) / 4, [x, z] = at(a, A + 0.01, t); box(g, 0.09, 0.08, 0.05, TRIM, x, Y0 + 0.545, z).rotation.y = a; }
      oct(A - 0.04, 0.045, LEAD, Y0 + 0.545); oct(A - 0.15, 0.04, LEAD2, Y0 + 0.59);
      [0, Math.PI / 2, -Math.PI / 2].forEach(porch);
      disc(0.4, 0.3, BLUE, DY); disc(0.44, 0.03, DGOLD, DY + 0.3);
      for (let k = -4; k <= 4; k++) { const a = (k * Math.PI) / 8, [x, z] = at(a, 0.397); box(g, 0.06, 0.14, 0.03, GLASS, x, DY + 0.08, z, glass(GLASS, 0xffd9a0, 0.9)).rotation.y = a; }
      Array.from({ length: 14 }, (_, i) => 0.42 * Math.sqrt(1 - ((i + 0.5) / 14) ** 2.4)).forEach((r, i) => disc(r, 0.04, lamplit(i & 1 ? 0xf6c534 : GOLD, 0xffcf60, 0.55), DY + 0.33 + i * 0.04));
      box(g, 0.03, 0.14, 0.03, GOLD, CX, DY + 0.87, CZ); disc(0.045, 0.05, GOLD, DY + 0.97); part(g, MOON, 0, mat(0xfff6b0), CX, DY + 1.12, CZ).rotation.z = Math.PI / 2 + (2 * Math.PI - 4.7) / 2;
      for (const s of [-1, 1]) part(g, ARCH, 0, mat(TRIM), s * 0.88, PY, 0.58);
      const [DX, DZ] = [0.92, 0.26];
      disc(0.16, 0.04, TRIM, PY, DX, DZ); disc(0.15, 0.03, TRIM, PY + 0.2, DX, DZ);
      for (let k = 0; k < 8; k++) box(g, 0.03, 0.16, 0.03, TRIM, DX + Math.sin((k * Math.PI) / 4) * 0.13, PY + 0.04, DZ + Math.cos((k * Math.PI) / 4) * 0.13);
      [0.15, 0.135, 0.105, 0.06].forEach((r, i) => disc(r, 0.04, i & 1 ? LEAD2 : LEAD, PY + 0.23 + i * 0.04, DX, DZ)); box(g, 0.02, 0.07, 0.02, GOLD, DX, PY + 0.39, DZ);
      const cypress = (x: number, z: number, h: number) => [0.08, 0.1, 0.1, 0.085, 0.06, 0.03].forEach((r, i) => cyl(g, (r * h) / 0.9, h / 6, CYPRESS[i % 3], x, PY + (i * h) / 6, z));
      cypress(-0.95, -0.5, 1); cypress(-0.97, 0.12, 0.75); cypress(1, -0.55, 0.9);
      const olive = (x: number, z: number) => { box(g, 0.05, 0.16, 0.05, WOOD, x, 0.1, z); [[0.15, 0.11], [0.12, 0.09], [0.08, 0.08]].forEach(([r, h], i) => cyl(g, r, h, OLIVE[i], x, 0.2 + i * 0.08, z)); };
      olive(-1.06, 0.84); olive(1.06, 0.84);
      const pilgrim = (x: number, z: number, c: number) => { box(g, 0.07, 0.11, 0.06, c, x, PY, z); box(g, 0.05, 0.05, 0.05, 0xf5b88c, x, PY + 0.11, z); box(g, 0.056, 0.02, 0.056, c, x, PY + 0.15, z); };
      pilgrim(-0.45, 0.55, 0x3b5dc9); pilgrim(0.5, 0.5, 0xf4f6fa);
      const dove = (x: number, z: number) => { box(g, 0.07, 0.04, 0.04, WHITE, x, PY, z); box(g, 0.03, 0.03, 0.03, WHITE, x + 0.045, PY + 0.03, z); };
      dove(-0.6, 0.62); dove(0.62, 0.56); dove(0.2, 0.66);
    }),
  ],
  levels: [
    [
      final((g) => {
        const [X, Z, Y, W, H] = [0.575, 1.08, 0.1, WW / DENSITY, WH / DENSITY];
        const PAVE = 0xd0c2a0, HONEY = 0xd4b57a, COPING = 0xe6cf9c, BULB = 0xfff6b0, BLUE = 0x3b5dc9, WHITE = 0xf4f6fa;
        stone(g, 1.12, 0.1, 0.75, PAVE, 0.56, 0, 1.325);
        const side = mat(HONEY);
        box(g, W, H, 0.14, HONEY, X, Y, Z, [side, side, side, side, FACE, side]); box(g, W + 0.02, 0.02, 0.17, COPING, X, Y + H, Z);
        ([[0.15, 1.2, INK], [0.28, 1.22, WHITE, -0.1], [0.41, 1.2, INK], [0.53, 1.21, INK, -0.12], [0.64, 1.2, WHITE], [0.88, 1.2, BLUE], [1, 1.21, WHITE], [0.22, 1.38, INK], [0.47, 1.4, INK], [0.9, 1.4, BLUE], [1.04, 1.37, INK]] as [number, number, number, number?][])
          .forEach(([x, z, c, lean]) => person(g, x, Y, z, c, lean));
        for (const z of [1.25, 1.43, 1.61]) box(g, 0.02, 0.17, 0.02, IRON, 0.75, Y, z); box(g, 0.02, 0.02, 0.4, IRON, 0.75, Y + 0.17, 1.43); box(g, 0.015, 0.015, 0.4, IRON, 0.75, Y + 0.08, 1.43);
        for (const x of [0.1, 1.06]) { box(g, 0.025, 0.6, 0.025, IRON, x, Y, 1.62); box(g, 0.1, 0.04, 0.06, INK, x, Y + 0.6, 1.62); box(g, 0.08, 0.02, 0.03, BULB, x, Y + 0.58, 1.6); }
      }),
    ],
    [
      final((g) => {
        const [TX, FX, Z, Y, RX, RZ, KX, KZ] = [-0.99, -0.55, 1.36, 0.1, -0.68, 1, -0.33, 1.06];
        const STONE = 0xe9e1cd, TRIM = 0xf3ecdb, LEAD = 0x8e97ab, LEAD2 = 0xa9b1c4, PAVE = 0xd0c2a0, GLASS = 0x1a2250, BULB = 0xfff6b0;
        const win = glass(GLASS, 0xffd9a0, 0.9);
        const PORTALS = ['..xxxx....xxxx..', ...Array(6).fill('.xOOOOx..xOOOOx.')];
        const ROUND = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, Math.PI / 16);
        const disc = (r: number, h: number, c: number, x: number, y: number, z: number) => { part(g, ROUND, h, mat(c), x, y, z).scale.set(r, h, r); };
        const cross = (x: number, y: number, z: number) => { box(g, 0.02, 0.12, 0.02, GOLD, x, y, z); box(g, 0.07, 0.02, 0.02, GOLD, x, y + 0.07, z); };
        const dome = (x: number, z: number, y: number, R: number, n: number, k: number) => {
          for (let i = 0; i < n; i++) disc(R * Math.sqrt(1 - ((i + 0.5) / n) ** 2.4), k, i & 1 ? LEAD2 : LEAD, x, y + i * k, z);
          disc(R * 0.22, 0.07, TRIM, x, y + n * k, z); cross(x, y + n * k + 0.07, z);
        };
        const ring = (x: number, z: number, y: number, r: number, n: number, w: number, h: number) => { for (let k = 0; k < n; k++) { const a = (k * 2 * Math.PI) / n; box(g, w, h, 0.025, GLASS, x + Math.sin(a) * r, y, z + Math.cos(a) * r, win).rotation.y = a; } };
        stone(g, 1.12, 0.1, 0.75, PAVE, -0.56, 0, 1.325);
        stone(g, 0.727, 0.62, 0.3, STONE, FX, Y, Z); box(g, 0.77, 0.035, 0.34, TRIM, FX, Y + 0.585, Z); box(g, 0.69, 0.02, 0.26, LEAD2, FX, Y + 0.62, Z); box(g, 0.75, 0.022, 0.02, TRIM, FX, Y + 0.33, Z + 0.16);
        decal(g, PORTALS, FX, Y, Z + 0.16);
        for (const s of [-1, 1]) { const x = FX + s * 0.182; box(g, 0.115, 0.2, 0.02, TRIM, x, Y + 0.37, Z + 0.155); box(g, 0.08, 0.12, 0.02, GLASS, x, Y + 0.4, Z + 0.165, win); box(g, 0.05, 0.03, 0.02, GLASS, x, Y + 0.52, Z + 0.165, win); }
        stone(g, 0.23, 0.7, 0.23, STONE, TX, Y, Z); box(g, 0.26, 0.025, 0.26, TRIM, TX, Y + 0.7, Z); stone(g, 0.21, 0.2, 0.21, STONE, TX, Y + 0.725, Z); box(g, 0.26, 0.03, 0.26, TRIM, TX, Y + 0.925, Z);
        for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, [sx, sz] = [Math.sin(a), Math.cos(a)]; box(g, 0.09, 0.12, 0.02, GLASS, TX + sx * 0.11, Y + 0.76, Z + sz * 0.11, win).rotation.y = a; box(g, 0.03, 0.14, 0.02, GLASS, TX + sx * 0.115, Y + 0.35, Z + sz * 0.115, win).rotation.y = a; }
        hip(g, 0.25, 0.25, 0.16, Y + 0.955, LEAD, TX, Z); cross(TX, Y + 1.115, Z);
        disc(0.26, 0.6, STONE, RX, Y, RZ); disc(0.28, 0.03, TRIM, RX, Y + 0.6, RZ); disc(0.23, 0.13, STONE, RX, Y + 0.63, RZ); ring(RX, RZ, Y + 0.66, 0.23, 12, 0.04, 0.07); dome(RX, RZ, Y + 0.76, 0.23, 9, 0.037);
        disc(0.16, 0.5, STONE, KX, Y, KZ); disc(0.175, 0.025, TRIM, KX, Y + 0.5, KZ); disc(0.14, 0.09, STONE, KX, Y + 0.525, KZ); ring(KX, KZ, Y + 0.54, 0.14, 8, 0.035, 0.05); dome(KX, KZ, Y + 0.615, 0.14, 6, 0.03);
        person(g, -0.86, Y, 1.62, INK); person(g, -0.55, Y, 1.64, 0x3b5dc9); person(g, -0.28, Y, 1.62, 0xf4f6fa);
        for (const x of [-1.06, -0.08]) { box(g, 0.02, 0.2, 0.02, IRON, x, Y, 1.64); box(g, 0.05, 0.05, 0.05, BULB, x, Y + 0.2, 1.64); }
      }),
    ],
  ],
} satisfies ModelDef;
