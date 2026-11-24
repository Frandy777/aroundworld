import * as THREE from 'three';
import { box, box as solid, cyl, decal, final, glass, lamplit, memo, part, rnd, sprite, stone, GOLD, INK, IRON, OFFICE, type ModelDef } from '../../builder';
import { canvas, hex, shade } from '../../art';
import { nightlit } from '../../light';
import { DENSITY, pixelTexture, toon } from '../../scene';

const FWD = 0.7, BANK = 0.24, Z = -0.8, GRANITE = 0xcfc8b6, STEEL = 0xe4eaf4, LIP = 0xf1eee4;
const px = (n: number) => n / DENSITY;
const steel = toon(STEEL);
const around = (g: THREE.Group, x: number, z: number) => [0, 1, 2, 3].map((k) => { const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = (k * Math.PI) / 2; g.add(p); return p; });
const wall = (w: number, h: number) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y > 0 && y < h - 1 && Math.min(x, w - 1 - x) % 4 === 3 ? (y % 4 ? 'O' : 'e') : 'x')).join(''));
const wallLamps = (w: number, h: number) => wall(w, h).map((row) => row.replace(/./g, (c) => (c === 'O' ? 'Y' : '.')));
const arch = (w: number, h: number, bw: number, lamps = false) => {
  const k = (bw + 1) / 2, n = Math.floor((w - 1) / (bw + 1)), c = (j: number) => (w - 1) / 2 + (bw + 1) * (j - (n - 1) / 2);
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const d = y - (h - 1 - k), win = d >= 0 && d < k && [...Array(n).keys()].some((j) => Math.abs(x - c(j)) <= d);
    const rim = Math.round(Math.min(h - 2, Math.ceil(w / 4)) * (1 - Math.sqrt(1 - ((2 * x + 1 - w) / w) ** 2)));
    return lamps ? (win ? 'Y' : '.') : win ? 'O' : y < rim || y === h - 1 ? 'b' : y === rim ? 'w' : 'a';
  }).join(''));
};
const bay = (w: number, h: number, lamps = false) => wall(w, h).map((row, y) => [...row].map((c, x) => {
  const d = Math.hypot(x + 0.5 - w / 2, Math.max(0, w / 2 - y - 0.5));
  return lamps ? (c === 'O' && d <= w / 2 - 2 ? 'Y' : '.') : d > w / 2 ? 'b' : d > w / 2 - 1 ? 'w' : d > w / 2 - 2 ? 'a' : c;
}).join(''));
const crown = memo((rows: string[], lamps: string[]) => toon(0xffffff, { map: sprite(rows), emissive: 0xffffff, emissiveMap: sprite(lamps) }));
const windows = memo((rows: string[], lamps: string[]) => toon(0xffffff, { map: sprite(rows), emissive: 0xffffff, emissiveMap: sprite(lamps) }));
const W = 19, NH = 110, NW = W + 2, MID = (NW - 1) / 2, PANE = ['#c4d7ee', '#a9c7e8', '#86aad3', '#6f93c0'], COOL = [0xa8ccff, 0x6fa3ff, 0x6fa3ff, 0xd6e6ff];
const clad = (night: boolean) => pixelTexture(canvas(8 * NW, NH, (g) => {
  const at = (c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); }, up = (y: number) => 1 - (y + 0.5) / NH;
  for (let i = 0; i < 8; i++) {
    const o = i * NW;
    for (let y = 0; y < NH; y++) at(night ? shade(0x2f56c0, 0.1 + 0.5 * up(y)) : PANE[(y + NH) % 4], o, y, NW);
    if (!night) { for (const x of [MID - 8, MID, MID + 8]) at('#cfe0f3', o + x, 0, 1, NH); continue; }
    for (let j = 0; 4 * j < NH; j++) {
      const t = (4 * j + 2) / NH, p = t > 0.82 ? 0.95 : (0.45 + 0.4 * t) * (0.4 + rnd(i, j, 7)), y = NH - 3 - 4 * j;
      for (let x = 1, len = 1; x < NW - 1; x += len + 1) {
        len = Math.min(1 + Math.floor(rnd(i, j, x) * 4), NW - 1 - x);
        if (rnd(i, j, x, 1) < p) { const c = rnd(i, j, x, 2) < t ? COOL : OFFICE, tone = c[Math.floor(rnd(i, j, x, 3) * c.length)]; at(hex(tone), o + x, y, len); at(shade(tone, 0.8), o + x, y + 1, len, 2); }
      }
    }
    for (let y = 0; y < NH; y++) { const e = Math.floor((W / 2) * (i % 2 ? up(y) / Math.SQRT2 : 1 - up(y))); for (const x of [MID - e, MID + e]) at('#9cc4ff', o + x, y); }
  }
}));
const GLASS = toon(0xffffff, { map: clad(false), emissive: 0xffffff, emissiveMap: clad(true) });
const led = nightlit(toon(STEEL), 0x9cc4ff, 0.6), mast = lamplit(LIP, 0xa8ccff, 0.8);
const shaft = memo((a: number, h: number) => {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), pos: number[] = [], uv: number[] = [], g = new THREE.BufferGeometry();
  let k = 0;
  const b = [V(a, 0, a), V(a, 0, -a), V(-a, 0, -a), V(-a, 0, a)], t = [V(a, h, 0), V(0, h, -a), V(-a, h, 0), V(0, h, a)];
  for (let i = 0; i < 4; i++) for (const f of [[b[i], b[(i + 1) % 4], t[i]], [b[(i + 1) % 4], t[i], t[(i + 1) % 4]]]) {
    const n = f[1].clone().sub(f[0]).cross(f[2].clone().sub(f[0])), c = f[0].clone().add(f[1]).add(f[2]);
    if (n.dot(V(c.x, 0, c.z)) < 0) { f.reverse(); n.negate(); }
    const u = V(n.z, 0, -n.x).normalize();
    for (const p of f) { pos.push(p.x, p.y, p.z); uv.push((k * NW + NW / 2 + (p.x * u.x + p.z * u.z) * DENSITY) / (8 * NW), p.y / h); }
    k++;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
});

export default {
  key: 'New York',
  props: [
    final((r) => {
      const g = new THREE.Group(); g.position.z = FWD; r.add(g);
      const [SX, SZ, FY, P] = [0, -0.38, 0.46, 2.04];
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, GRASS = 0x4f9d4f, WALL = 0xcfc8b6, PATH = 0xdba596, FORT = 0xb4ab95, GR = 0xcbc3ae, GRL = 0xded8c6, GRD = 0xa9a08a, DARK = 0x3f392e;
      const WOOD = 0x6e3a12, WHITE = 0xf4f6fa, NAVY = 0x1a2250, ORANGE = 0xf26b1d;
      const PAT = 0x5cc6a6, PATL = 0x8fe4cc, PATD = 0x419e83, PATDD = 0x2d7662, DGOLD = 0xe0a020;
      const VERDIGRIS = [PAT, PATL, PATD, PATDD], box: typeof solid = (g, w, h, d, c, x, y, z, m) => solid(g, w, h, d, c, x, y, z, m ?? (VERDIGRIS.includes(c as number) ? lamplit(c as number, c as number, 0.5) : undefined));
      const rod = (x: number, y: number, len: number, a: number, w: number, c: number, z = SZ, d = w) => { box(g, w, len, d, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, z).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; };
      const Y = (h: number) => P + h;
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);
      const isle = (r: number, h: number, c: number, y: number) => { cyl(g, r, h, c, SX, y, SZ + 0.08).scale.set(1.2, 1, 1); };
      isle(0.95, 0.02, FOAM, 0.1); isle(0.9, 0.14, WALL, 0.1); isle(0.84, 0.03, PATH, 0.24); isle(0.78, 0.03, GRASS, 0.27);
      const [N, D] = [11, 0.25];
      for (let k = 0; k < N; k++) { const a = (k * 2 * Math.PI) / N; stone(g, D * Math.SQRT2, 0.22, D * Math.SQRT2, FORT, SX + (0.8 - D) * Math.sin(a), 0.24, SZ + (0.8 - D) * Math.cos(a)).rotation.y = a + Math.PI / 4; }
      cyl(g, 0.55, 0.22, FORT, SX, 0.24, SZ);
      const ped = (m: typeof stone, w: number, h: number, y: number, c: number, d = w) => m(g, w, h, d, c, SX, y, SZ);
      ped(stone, 1.06, 0.07, FY, GRL); ped(stone, 1, 0.07, FY + 0.07, GRL);
      ped(stone, 0.92, 0.32, 0.6, GR); ped(box, 0.99, 0.05, 0.92, GRL);
      box(g, 0.16, 0.22, 0.02, DARK, SX, 0.62, SZ + 0.47); box(g, 0.22, 0.03, 0.03, GRL, SX, 0.84, SZ + 0.47);
      ped(stone, 0.84, 0.22, 0.97, GR); ped(box, 0.9, 0.05, 1.19, GRL);
      ped(box, 0.8, 0.46, 1.24, DARK);
      for (const s of [-1, 1]) stone(g, 0.12, 0.46, 0.84, GRD, SX + s * 0.34, 1.24, SZ);
      for (const x of [-0.24, -0.08, 0.08, 0.24]) box(g, 0.07, 0.46, 0.07, GRL, SX + x, 1.24, SZ + 0.41);
      ped(box, 0.98, 0.07, 1.7, GRL); ped(box, 1.06, 0.05, 1.77, GR);
      box(g, 1.04, 0.1, 0.04, GRL, SX, 1.82, SZ + 0.51);
      for (const s of [-1, 1]) { box(g, 0.04, 0.1, 1, GRL, SX + s * 0.51, 1.82, SZ); box(g, 0.07, 0.14, 0.07, GRL, SX + s * 0.51, 1.82, SZ + 0.51); }
      ped(stone, 0.8, 0.16, 1.82, GR); ped(box, 0.76, 0.06, 1.98, PAT);
      box(g, 0.14, 0.05, 0.2, PATD, SX + 0.1, P, SZ + 0.12); box(g, 0.14, 0.07, 0.2, PATD, SX - 0.12, P, SZ - 0.1);
      box(g, 0.1, 0.02, 0.05, IRON, SX - 0.04, P, SZ + 0.24); box(g, 0.06, 0.02, 0.04, INK, SX + 0.04, P, SZ + 0.27);
      box(g, 0.66, 0.1, 0.42, PATD, SX, P, SZ); box(g, 0.58, 0.9, 0.34, PATD, SX, Y(0.1), SZ);
      [[-0.29, 0.1, PAT, 0], [-0.19, 0.13, PATL, 0.03], [-0.06, 0.13, PAT, 0.05], [0.07, 0.12, PATD, 0.03], [0.19, 0.1, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.46, 0.04, c, SX + x + w / 2, Y(0.1), SZ + 0.17 + z));
      [[-0.27, 0.12, PATL, 0.01], [-0.15, 0.14, PAT, 0.04], [-0.01, 0.14, PATD, 0.03], [0.13, 0.12, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.4, 0.04, c, SX + x + w / 2, Y(0.56), SZ + 0.17 + z));
      box(g, 0.6, 0.3, 0.32, PAT, SX, Y(1), SZ); box(g, 0.52, 0.2, 0.3, PAT, SX - 0.03, Y(1.3), SZ); box(g, 0.36, 0.12, 0.28, PATL, SX - 0.02, Y(1.5), SZ);
      rod(SX + 0.3, Y(0.55), 0.95, 0.58, 0.1, PATL, SZ + 0.2, 0.08); rod(SX + 0.14, Y(0.4), 0.8, 0.58, 0.07, PATD, SZ + 0.2, 0.06);
      box(g, 0.2, 0.36, 0.28, PAT, SX - 0.25, Y(1.4), SZ); box(g, 0.08, 0.5, 0.2, PATL, SX - 0.3, Y(1), SZ + 0.04);
      const HX = SX - 0.015;
      box(g, 0.1, 0.16, 0.1, PATL, HX, Y(1.56), SZ);
      box(g, 0.18, 0.2, 0.15, PATL, HX, Y(1.7), SZ); box(g, 0.22, 0.26, 0.1, PATD, HX, Y(1.66), SZ - 0.09);
      for (const s of [-1, 1]) box(g, 0.05, 0.22, 0.07, PATD, HX + s * 0.12, Y(1.5), SZ);
      box(g, 0.25, 0.09, 0.19, PATD, HX, Y(1.9), SZ - 0.01);
      [-0.06, 0, 0.06].forEach((x) => box(g, 0.03, 0.05, 0.012, PATDD, HX + x, Y(1.92), SZ + 0.086));
      box(g, 0.14, 0.025, 0.012, PATDD, HX, Y(1.82), SZ + 0.076); box(g, 0.035, 0.08, 0.03, PAT, HX, Y(1.74), SZ + 0.085); box(g, 0.07, 0.015, 0.012, PATDD, HX, Y(1.72), SZ + 0.076);
      for (const s of [-1, 1]) box(g, 0.03, 0.025, 0.012, PATDD, HX + s * 0.04, Y(1.78), SZ + 0.076);
      [90, 60, 30, 0, -30, -60, -90].forEach((d) => { const a = (d * Math.PI) / 180; rod(HX - 0.075 * Math.sin(a), Y(1.93) + 0.075 * Math.cos(a), 0.14, a, 0.05, PATL); });
      const [hx] = rod(SX - 0.26, Y(1.65), 0.55, 0.05, 0.1, PAT, SZ + 0.01, 0.12);
      box(g, 0.13, 0.2, 0.12, PATL, hx, Y(2.12), SZ + 0.02); box(g, 0.07, 0.4, 0.07, PATD, hx, Y(2.1), SZ); box(g, 0.1, 0.035, 0.1, PATDD, hx, Y(2.34), SZ);
      cyl(g, 0.075, 0.04, PATDD, hx, Y(2.4), SZ); cyl(g, 0.115, 0.035, PATD, hx, Y(2.44), SZ); cyl(g, 0.105, 0.05, PATL, hx, Y(2.475), SZ);
      [[0.12, 0.06, DGOLD], [0.14, 0.07, GOLD], [0.1, 0.07, GOLD], [0.06, 0.05, 0xfff6b0]].reduce((y, [w, h, c], i) => { box(g, w, h, w, c, hx + i * 0.01, y, SZ); return y + h; }, Y(2.525));
      rod(SX + 0.27, Y(0.95), 0.62, 0.25, 0.15, PAT, SZ + 0.03, 0.2); box(g, 0.14, 0.1, 0.18, PATD, SX + 0.29, Y(0.9), SZ + 0.04);
      box(g, 0.22, 0.4, 0.05, PATD, SX + 0.4, Y(0.98), SZ + 0.2).rotation.z = -0.4; box(g, 0.16, 0.32, 0.03, PATL, SX + 0.4, Y(1.02), SZ + 0.225).rotation.z = -0.4;
      box(g, 0.08, 0.1, 0.08, PATL, SX + 0.47, Y(1.05), SZ + 0.2);
      const fx = 0.72;
      box(g, 0.7, 0.1, 0.22, ORANGE, fx, 0.1, 0.74); box(g, 0.72, 0.03, 0.225, INK, fx, 0.1, 0.74); box(g, 0.1, 0.1, 0.16, ORANGE, fx + 0.38, 0.1, 0.74);
      box(g, 0.58, 0.1, 0.19, WHITE, fx - 0.03, 0.2, 0.74); box(g, 0.52, 0.04, 0.02, NAVY, fx - 0.03, 0.23, 0.84, glass(NAVY));
      box(g, 0.42, 0.09, 0.16, WHITE, fx - 0.05, 0.3, 0.74); box(g, 0.36, 0.035, 0.02, NAVY, fx - 0.05, 0.33, 0.82, glass(NAVY)); box(g, 0.46, 0.025, 0.18, ORANGE, fx - 0.05, 0.39, 0.74);
      box(g, 0.16, 0.09, 0.12, WHITE, fx + 0.2, 0.3, 0.74); box(g, 0.12, 0.04, 0.02, NAVY, fx + 0.2, 0.33, 0.8, glass(NAVY));
      box(g, 0.1, 0.22, 0.1, ORANGE, fx - 0.18, 0.415, 0.74); box(g, 0.105, 0.03, 0.105, INK, fx - 0.18, 0.635, 0.74);
      box(g, 0.76, 0.012, 0.03, FOAM, fx, 0.1, 0.86); box(g, 0.08, 0.012, 0.22, FOAM, fx + 0.45, 0.1, 0.74);
      [[-1, -0.2], [1, -0.2], [-0.86, 0.22]].forEach(([x, z]) => { box(g, 0.05, 0.2, 0.05, WOOD, x, 0.27, z); cyl(g, 0.15, 0.12, 0x2f7a4a, x, 0.42, z); cyl(g, 0.12, 0.11, 0x3f9a5c, x, 0.52, z); cyl(g, 0.07, 0.09, 0x4fb06a, x, 0.61, z); });
      box(g, 0.03, 0.9, 0.03, 0xdddddd, 0.62, 0.3, 0.3); box(g, 0.05, 0.05, 0.05, GOLD, 0.62, 1.2, 0.3); decal(g, ['uuurrrr', 'uuuwwww', 'rrrrrrr', 'wwwwwww'], 0.8, 1, 0.31);
      [[-0.9, 0.78], [-0.4, 0.9], [0.1, 0.93]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));
    }),
  ],
  levels: [
    [
      final((g) => {
        const X = -0.6, CREAM = 0xe9e2cc, AH = 20;
        const sides = around(g, X, Z), [front, ...others] = sides;
        let y = BANK;
        const face = (w: number, rows: string[], lamps?: string[], m = crown) => { const d = decal(front, rows, 0, y, px(w) / 2 + 0.02); if (lamps) d.material = m(rows, lamps); others.forEach((p) => p.add(d.clone())); };
        stone(g, 1.2, BANK, 1.1, GRANITE, X, 0, Z);
        for (const [w, h, lip] of [[23, 12, 1], [19, 50, 1], [15, 30, 0]]) {
          box(g, px(w), px(h), px(w), CREAM, X, y, Z); face(w, wall(w, h), wallLamps(w, h), windows);
          y += px(h); if (lip) { box(g, px(w + 2), px(1), px(w + 2), LIP, X, y, Z); y += px(1); }
        }
        sides.forEach((p) => box(p, px(2), px(2), px(3), STEEL, px(8.5), y - px(2), px(8.5), steel).rotation.y = Math.PI / 4);
        box(g, px(15), px(AH), px(15), STEEL, X, y, Z, steel); face(15, bay(15, AH), bay(15, AH, true)); y += px(AH);
        for (const [w, h, bw] of [[13, 6, 5], [11, 5, 3], [9, 5, 3], [7, 4, 3], [5, 4, 3], [3, 3, 1]]) { box(g, px(w), px(h), px(w), STEEL, X, y, Z, steel); face(w, arch(w, h, bw), arch(w, h, bw, true)); y += px(h); }
        box(g, px(1), px(16), px(1), STEEL, X, y, Z, steel);
      }),
    ],
    [
      final((g) => {
        const X = 0.6, A = px(W) / 2, H = px(NH), SLATE = 0x56688a;
        let y = BANK;
        stone(g, 1.2, BANK, 1.1, GRANITE, X, 0, Z);
        box(g, 2 * A, px(15), 2 * A, SLATE, X, y, Z, glass(SLATE)); y += px(15); box(g, 2 * A + px(2), px(1), 2 * A + px(2), LIP, X, y, Z); y += px(1);
        part(g, shaft(A, H), 0, GLASS, X, y, Z); y += H;
        box(g, A * Math.SQRT2 + px(1), px(1), A * Math.SQRT2 + px(1), STEEL, X, y, Z, steel).rotation.y = Math.PI / 4; y += px(1);
        cyl(g, 0.16, 0.1, STEEL, X, y, Z).material = led; y += 0.1;
        box(g, px(3), 0.35, px(3), LIP, X, y, Z, mast); box(g, px(1), 1, px(1), LIP, X, y + 0.35, Z, mast); box(g, px(2), px(2), px(2), 0xff3b3b, X, y + 1.35, Z);
      }),
    ],
  ],
} satisfies ModelDef;
