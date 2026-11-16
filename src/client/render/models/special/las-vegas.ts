import * as THREE from 'three';
import { box, cyl, final, glass, part, rnd, sprite, stone, GOLD, type ModelDef } from '../../builder';
import { canvas, shade } from '../../art';
import { glow, switchOf } from '../../light';
import { lodMap, pixelTexture, texels, toon } from '../../scene';

const R = 0.74, FOOT = 0.7, DEG = Math.PI / 180, [PA, PE] = [-55 * DEG, -5 * DEG], POLE = [Math.sin(PA) * Math.cos(PE), Math.sin(PE), Math.cos(PA) * Math.cos(PE)];
const led = (L: number, night: boolean) => {
  const W = texels(2 * Math.PI * R, L), H = texels(Math.PI * R, L), N = 3 << L;
  return pixelTexture(canvas(W, H, (g) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const th = ((y + 0.5) / H) * Math.PI, ph = ((x + 0.5) / W) * 2 * Math.PI, d = [-Math.cos(th), -Math.cos(ph) * Math.sin(th), Math.sin(ph) * Math.sin(th)];
      const w = ((Math.acos(Math.max(-1, Math.min(1, d[0] * POLE[0] + d[1] * POLE[1] + d[2] * POLE[2]))) + 0.07 * Math.sin(3 * d[1] + 2 * d[0] + 1.3) + 0.05 * Math.sin(5 * d[2] - 3 * d[0])) * N) / Math.PI;
      const k = Math.floor(w), p = w - k, lo = 0.3 + 0.15 * rnd(k, 2), hi = 0.65 + 0.35 * rnd(k, 4);
      const v = (p > 0.86 && rnd(k, 3) < 0.4 ? 1 : lo + (hi - lo) * p ** 0.7) * (0.9 + 0.1 * Math.sin(4 * d[1] - 3 * d[2] + 5 * k));
      g.fillStyle = shade(0xffffff, (night ? Math.round(6 * v) / 6 : 0.45 + 0.55 * Math.round(6 * v) / 6) * (L > 1 ? 0.96 + 0.08 * rnd(x, y, 7) : 1));
      g.fillRect(x, y, 1, 1);
    }
  }));
};
const SKIN = lodMap(lodMap(toon(0xffffff, { emissive: 0xffffff }, [0.6, 0.5, 0, 0]), (L) => led(L, false)), (L) => led(L, true), 'emissiveMap');
const shine = (c: number | null) => { switchOf(SKIN).value = +(c !== null); SKIN.color.set(c ?? 0x707890).multiplyScalar(1.5); SKIN.emissive.set(c ?? 0).multiplyScalar(1.5); };

export default {
  key: 'Las Vegas',
  lamps: [{ at: [-0.3, 1.5, 0.45], color: 0xffae52, power: 5.5, reach: 6, final: true }],
  props: [
    final((g) => {
      const [SX, SZ, SY] = [-0.34, 0.2, 0.99];
      const PLAZA = 0xb9b3a2, KERB = 0xe6e9f0, ASPHALT = 0x3d4254, GRAVEL = 0xb8825c, ROCK = 0xc99a74, POLE = 0x4a9ac8, STAR = 0xe8502a, WOOD = 0x8a5a2b;
      const SIGN = [
        '............bbb..bbb..bbb............',
        '.......bbb.bRwwbbRRRbbRRRb.bbb.......',
        '..bbb.bRRRbbRwwbbRwwbbRwRbbRRRb.bbb..',
        '.bRwRbbRRwbbRRRbbRRRbbRRRbbRRRbbRRRb.',
        '.bRRRbbRRRb.bbbwwbbbwwbbb.bRwRbbRRwb.',
        '.bRRRb.bbbyYYwwwwwwwwwwwyYYbbb.bRRRb.',
        '..bbb...yYwwwwwwwwwwwwwwwwwYy...bbb..',
        '......YYuwuwwuwwwuuwwuuwwuuwwyY......',
        '....YywwuuwuuwuuuwwwuwwuwwwuuwwYY....',
        '..yYwwwwuwwwwwwwwwwuwwwwuwwwwwwwwYy..',
        'YYRwwwwRwwwRRwwwRwRwRRRwwRRwwRwwwRRyY',
        'YwRwwwRwRwRwwwwwRwRwRwwwRwwwRwRwRwwwy',
        'YwRwwwRRRwwRwwwwRwRwRRwwRwRwRRRwwRwwY',
        'ywRwwwRwRwwwRwwwRwRwRwwwRwRwRwRwwwRwY',
        'YwRRRwRwRwRRwwwwwRwwRRRwwRRwRwRwRRwwy',
        'YYwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwyY',
        '..YywwwuuuwuuuwuwuwwuwwuuwwwuwwwwYY..',
        '....yYwuwuwuuwwuwuwuuuwuwuwuuuwYy....',
        '......YuwuwuuuwwuwwuwuwuuwwuwuY......',
        '........YywwwwwwwwwwwwwwwwwYY........',
        '..........yYYwwwwwwwwwwwyYY..........',
        '.............yYwwwwwwwYy.............',
        '...............YYwwwyY...............',
        '.................YyY.................',
      ];
      const LENS = [3, 11, 21, 29, 37, 37, 37, 29, 21, 11, 3];
      stone(g, 2.4, 0.1, 1.9, PLAZA); box(g, 2.4, 0.03, 0.4, ASPHALT, 0, 0.1, 0.75);
      [-1, -0.55, -0.1, 0.35, 0.8].forEach((x) => box(g, 0.24, 0.01, 0.04, GOLD, x, 0.13, 0.75));
      stone(g, 1.8, 0.07, 0.74, KERB, SX + 0.04, 0.1, 0.2); box(g, 1.68, 0.03, 0.62, GRAVEL, SX + 0.04, 0.17, 0.2);
      LENS.forEach((w, i) => box(g, w / 22, 2 / 22, 0.1, 0xffffff, SX, SY + (20 - 2 * i) / 22, SZ));
      part(g, new THREE.PlaneGeometry(37 / 22, 24 / 22), 24 / 22, glow(new THREE.MeshBasicMaterial({ map: sprite(SIGN), alphaTest: 0.5 }), 1.2), SX, SY, SZ + 0.06).castShadow = false;
      for (const x of [-0.52, -0.16]) box(g, 0.08, 2.32, 0.05, POLE, SX + x, 0.17, SZ - 0.06);
      box(g, 0.44, 0.07, 0.05, POLE, SX - 0.34, 2.42, SZ - 0.06);
      const arm = (w: number, h: number, a: number) => { box(g, w, h, 0.05, STAR, SX - 0.34, 2.17 - h / 2, SZ + 0.02).rotation.z = a; };
      arm(0.6, 0.08, 0); arm(0.08, 0.6, 0); arm(0.42, 0.07, Math.PI / 4); arm(0.42, 0.07, -Math.PI / 4);
      [[0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]].forEach(([x, dy]) => box(g, 0.06, 0.06, 0.06, 0xfff6b0, SX - 0.34 + x, 2.14 + dy, SZ + 0.02));
      const palm = (x: number, z: number, h: number, n = 6) => {
        for (let i = 0; i < 4; i++) box(g, 0.08 - 0.006 * i, h / 4, 0.08 - 0.006 * i, i & 1 ? WOOD : 0x7a4a22, x + 0.015 * i, 0.2 + (i * h) / 4, z);
        box(g, 0.12, 0.08, 0.12, 0x5a3a1a, x + 0.06, 0.16 + h, z);
        for (let k = 0; k < n; k++) {
          const a = (k * 2 * Math.PI) / n + 0.3; let [px, py, pz] = [x + 0.06, 0.2 + h, z];
          [[0.2, -0.3], [0.26, 0.9]].forEach(([L, p], j) => {
            const [dx, dy, dz] = [Math.sin(a) * Math.cos(p) * L, -Math.sin(p) * L, Math.cos(a) * Math.cos(p) * L];
            const f = box(g, 0.09, 0.025, L, (k + j) & 1 ? 0x2fa84f : 0x4cc36b, px + dx / 2, py + dy / 2 - 0.0125, pz + dz / 2);
            f.rotation.order = 'YXZ'; f.rotation.set(p, a, 0);
            px += dx; py += dy; pz += dz;
          });
        }
      };
      palm(0.15, -0.05, 1.9); palm(-1.02, 0.5, 0.7, 5); palm(0.5, 0.5, 0.7, 5);
      const rock = (x: number, z: number, s: number) => { box(g, 0.22 * s, 0.1 * s, 0.16 * s, ROCK, x, 0.2, z); box(g, 0.14 * s, 0.08 * s, 0.11 * s, 0xb5835e, x + 0.03 * s, 0.2 + 0.1 * s, z).rotation.y = 0.5; box(g, 0.07 * s, 0.05 * s, 0.07 * s, 0xd8b08c, x - 0.03 * s, 0.2 + 0.18 * s, z).rotation.y = -0.4; };
      rock(-0.78, 0.46, 1.2); rock(0.2, 0.5, 1); rock(-0.5, 0, 0.8);
      const [cx, cz] = [0.6, 0.82];
      box(g, 0.44, 0.09, 0.2, 0xf2c230, cx, 0.13, cz); box(g, 0.24, 0.09, 0.18, 0xf2c230, cx - 0.02, 0.22, cz); box(g, 0.2, 0.05, 0.19, 0x1a2250, cx - 0.02, 0.24, cz, glass(0x1a2250));
      box(g, 0.08, 0.03, 0.06, 0xffffff, cx - 0.02, 0.31, cz); [-0.14, 0.14].forEach((dx) => [-0.1, 0.1].forEach((dz) => box(g, 0.08, 0.07, 0.03, 0x23263a, cx + dx, 0.1, cz + dz)));
    }),
  ],
  levels: [
    [
      final((g) => {
        const [TX, TZ] = [0.8, -0.5];
        const PAVE = 0xcfc8b6, KERB = 0xe6e9f0, CREAM = 0xf0e6bd, CREAM2 = 0xdccfa0, GLASS = 0x34426e, GLASS2 = 0x4a5c92, DOME = 0x6b7391, WHITE = 0xf4f6fa;
        cyl(g, 0.42, 0.05, KERB, TX, 0.1, TZ); cyl(g, 0.34, 0.05, PAVE, TX, 0.15, TZ);
        cyl(g, 0.12, 3.1, CREAM, TX, 0.14, TZ);
        for (const a of [Math.PI, (Math.PI * 5) / 3, Math.PI / 3]) {
          const fin = (y: number, h: number, L: number) => { const r = 0.08 + L / 2; box(g, 0.08, h, L, CREAM2, TX + r * Math.sin(a), y, TZ + r * Math.cos(a)).rotation.y = a; };
          for (let i = 0; i < 6; i++) fin(0.14 + i * 0.2, 0.2, 0.34 - 0.04 * i);
          for (let i = 0; i < 4; i++) fin(2.8 + i * 0.12, 0.12, 0.16 + 0.07 * i);
        }
        let y = 3.3;
        cyl(g, 0.34, 0.06, 0xe8e4d4, TX, y, TZ); y += 0.06;
        [0.28, 0.3, 0.32].forEach((r, i) => cyl(g, r, 0.1, GLASS, TX, y + i * 0.1, TZ, glass(GLASS)));
        [[-0.2, 0xfff6b0, 0.24], [0, 0x5dfff0, 0.31], [0.2, 0xff5de0, 0.24]].forEach(([x, c, z]) => [-1, 1].forEach((s) => { box(g, 0.03, 0.34, 0.03, c, TX + x, y - 0.02, TZ + z).rotation.z = s * 0.55; }));
        y += 0.3; cyl(g, 0.4, 0.06, WHITE, TX, y, TZ); y += 0.06;
        [0.36, 0.39, 0.42, 0.44].forEach((r, i) => { const c = i & 1 ? GLASS2 : GLASS; cyl(g, r, 0.08, c, TX, y + i * 0.08, TZ, glass(c)); }); y += 0.32;
        cyl(g, 0.45, 0.04, WHITE, TX, y, TZ); y += 0.04;
        [0.3, 0.26, 0.2, 0.1].forEach((r, i) => cyl(g, r, 0.07, DOME, TX, y + i * 0.07, TZ)); y += 0.28;
        for (const x of [-0.04, 0.04]) box(g, 0.035, 0.95, 0.035, 0xff3b3b, TX + x, y, TZ);
        box(g, 0.03, 0.95, 0.03, WHITE, TX, y, TZ); box(g, 0.1, 0.1, 0.1, 0xff3b3b, TX, y + 0.95, TZ); cyl(g, 0.1, 0.05, 0xfff6b0, TX, y + 0.5, TZ);
      }),
    ],
    [
      final((g) => {
        const X = -0.36, Z = -0.66, TOP = 0.5, PAVE = 0xcfc8b6, KERB = 0xe6e9f0;
        cyl(g, FOOT + 0.03, 0.12, KERB, X, 0, Z); cyl(g, FOOT + 0.03, TOP - 0.12, PAVE, X, 0.12, Z);
        part(g, new THREE.SphereGeometry(R, 28, 18).rotateZ(Math.PI / 2), 0, SKIN, X, TOP + Math.sqrt(R * R - FOOT * FOOT), Z);
      }),
    ],
  ],
  owner: shine,
} satisfies ModelDef;
