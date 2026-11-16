import * as THREE from 'three';
import { box, cyl, decal, final, glass, lamplit, lampsOf, mat, part, rnd, stone, GOLD, INK, type ModelDef } from '../../builder';
import { canvas, shade } from '../../art';
import { pixelTexture, toon } from '../../scene';

const WALL = 0xdadcd6, TRIM = 0xeeeee8, PAVE = 0xb4b2a8, GRASS = 0x3f9a5c, DEEP = 0x2a6e3e, BLOOM = [0xe43b44, 0xf08a24, 0xf4c430], CAST = 0x9b6a3c, CAST_L = 0xc08a52, CAST_D = 0x5e3d22, SKIN = 0xf5b88c, COAT = 0x3b5dc9;
const MW = 33, MH = 6, RIM = [3, 3, 4, 4, 5, 4, 5, 6, 5, 4, 4, 5, 5, 6, 6, 6, 5, 6, 6, 5, 5, 4, 4, 5, 6, 5, 5, 4, 4, 3, 3, 3, 2];
const mural = (night: boolean) => pixelTexture(canvas(MW, MH, (g) => {
  for (let x = 0; x < MW; x++) for (let y = 0; y < MH; y++) {
    const d = y - (MH - RIM[x]), c = d < 0 ? (y < 2 ? 0xe9b88f : 0xf3cfaa) : d < 1 + +(RIM[x] > 4) ? (d ? 0xdfe6f2 : 0xffffff) : [0x7a8191, 0x656c7c, 0x8a91a0][(x + y) % 3];
    g.fillStyle = shade(c, (0.9 + 0.2 * rnd(x, y, 3)) * (night ? 0.35 : 1)); g.fillRect(x, y, 1, 1);
  }
}));
const MURAL = toon(0xffffff, { map: mural(false), emissive: 0xffffff, emissiveMap: mural(true) });

export default {
  key: 'Pyongyang',
  lamps: [{ at: [-0.26, 5.7, -0.35], color: 0xff4d3b, power: 5, reach: 6.5, final: true }],
  props: [
    final((g) => {
      const [TX, TZ, SX, SZ, FY, P] = [-0.26, -0.5, 0.76, 0.1, 5.05, 0.63];
      const WATER = 0x3a86e0, FOAM = 0xdcefff, JET = 0x9fd8ff, GREY = 0xd7d4cb, LIGHT = 0xf6f4ee, LEDGE = 0xe9e6dc, CRIMSON = 0xb13e53, RED = 0xe43b44, WOOD = 0x6e3a12, DGOLD = 0xf0a020, BRONZE = 0xa8673f, BRONZE2 = 0xc4824e;
      const GLYPH: Record<number, string[]> = { 9: ['.Y..Y.Y', 'YYY.Y.Y', '.Y.YY.Y', '.Y..Y.Y', 'Y.Y.Y.Y', 'Y.Y.Y.Y'], 10: ['YYYYY', '..Y..', '.Y.Y.', 'YYYYY', '..Y..', '..Y..'] };
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.4, 0.14, 1.28, 0xd3d0c4, 0, 0.1, -0.31); box(g, 2.4, 0.03, 0.06, 0xf4eedb, 0, 0.24, 0.3); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.355);
      box(g, 1.3, 0.07, 0.9, 0xe2dfd3, TX, 0.24, TZ); box(g, 1.1, 0.07, 0.78, 0xece9de, TX, 0.31, TZ);
      stone(g, 0.94, 0.32, 0.68, 0xe4e1d6, TX, 0.38, TZ); box(g, 1.02, 0.05, 0.76, LEDGE, TX, 0.7, TZ);
      box(g, 0.58, 0.3, 0.04, 0x3a3f4e, TX, 0.41, TZ + 0.35); decal(g, ['xtaSyxktaSb', 'aSxkytxaStx', 'tyaxbSxkaty', 'Sxktaxysbxa', 'kaSxyatxStb', 'xbtyaSkxyat'], TX, 0.435, TZ + 0.375);
      for (let i = 0; i < 11; i++) {
        const w = 0.78 - 0.028 * i, y = 0.75 + i * 0.36;
        stone(g, w, 0.36, w, GREY, TX, y, TZ); stone(g, 0.62 * w, 0.32, 0.04, LIGHT, TX, y, TZ + w / 2); box(g, w + 0.1, 0.04, w + 0.1, LEDGE, TX, y + 0.32, TZ);
        if (GLYPH[i]) decal(g, GLYPH[i], TX, y + 0.045, TZ + w / 2 + 0.026, lampsOf(GLYPH[i], 'Y'));
      }
      stone(g, 0.46, 0.26, 0.46, GREY, TX, 4.71, TZ); [-0.13, 0, 0.13].forEach((x) => box(g, 0.06, 0.14, 0.02, 0x2a3050, TX + x, 4.78, TZ + 0.23, glass(0x2a3050, 0xffd9a0, 0.9))); box(g, 0.56, 0.04, 0.56, LEDGE, TX, 4.97, TZ);
      cyl(g, 0.25, 0.05, DGOLD, TX, FY, TZ); cyl(g, 0.31, 0.08, GOLD, TX, FY + 0.05, TZ);
      [0.15, 0.19, 0.21, 0.21, 0.2, 0.18, 0.155, 0.13, 0.105, 0.08, 0.057, 0.037, 0.02].forEach((r, i) => { const c = [CRIMSON, RED, RED, 0xff3b3b, RED, 0xff3b3b, 0xff3b3b][i >> 1]; cyl(g, r, 0.085, c, TX + Math.max(0, i - 3) * 0.013, FY + 0.13 + i * 0.085, TZ, c === 0xff3b3b ? undefined : glass(c)); });
      box(g, 0.8, 0.07, 0.46, 0xd6d0c0, SX, 0.24, SZ); box(g, 0.68, 0.27, 0.36, 0xe9e4d6, SX, 0.31, SZ); box(g, 0.74, 0.05, 0.4, 0xcfc8b4, SX, 0.58, SZ);
      const rod = (x: number, y: number, len: number, a: number, c: number) => { box(g, 0.045, len, 0.045, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, SZ).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; };
      const person = (x: number, s: number, a: number) => { const d = Math.sign(a); box(g, 0.13, 0.2 * s, 0.09, BRONZE, x, P, SZ); box(g, 0.18, 0.25 * s, 0.1, BRONZE, x, P + 0.2 * s, SZ); box(g, 0.1, 0.12 * s, 0.1, BRONZE2, x, P + 0.46 * s, SZ); box(g, 0.045, 0.2 * s, 0.07, BRONZE, x + d * 0.115, P + 0.22 * s, SZ); return rod(x - d * 0.09, P + 0.42 * s, 0.3, a, BRONZE); };
      const [bx, by] = person(SX - 0.2, 1, 0.3), [hx, hy] = person(SX, 1.15, -0.08), [sx, sy] = person(SX + 0.2, 0.95, -0.3);
      box(g, 0.06, 0.12, 0.06, 0x3b2418, bx - 0.015, by, SZ); box(g, 0.17, 0.08, 0.07, 0x7a4a28, hx, hy - 0.01, SZ);
      box(g, 0.13, 0.04, 0.04, 0x7a4a28, sx, sy + 0.08, SZ); box(g, 0.04, 0.1, 0.04, 0x7a4a28, sx + 0.045, sy - 0.02, SZ);
      for (const x of [-0.95, 0.95]) {
        cyl(g, 0.19, 0.012, FOAM, x, 0.1, 0.62); cyl(g, 0.12, 0.02, 0xffffff, x, 0.1, 0.62);
        [[0.14, 0.26, FOAM], [0.1, 0.24, 0xffffff], [0.07, 0.22, FOAM], [0.05, 0.2, 0xffffff]].reduce((y, [w, h, c]) => { box(g, w, h, w, c, x, y, 0.62); return y + h - 0.02; }, 0.1);
        box(g, 0.13, 0.04, 0.13, FOAM, x, 0.9, 0.62);
        [[0.09, 0.84], [0.19, 0.66]].forEach(([dx, y]) => [-1, 1].forEach((s) => box(g, 0.05, 0.07, 0.05, JET, x + s * dx, y, 0.62)));
      }
      const [rx, rz] = [-0.2, 0.55];
      box(g, 0.4, 0.07, 0.14, 0x8a5a2b, rx, 0.1, rz); [-1, 1].forEach((s) => box(g, 0.06, 0.13, 0.1, 0x8a5a2b, rx + s * 0.22, 0.1, rz));
      box(g, 0.08, 0.1, 0.07, 0xd9423e, rx - 0.02, 0.17, rz); box(g, 0.05, 0.05, 0.05, 0xf5b88c, rx - 0.02, 0.27, rz);
      [[0.45, 0.45], [-0.6, 0.5]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));
      [[-1.03, -0.7], [-1.03, -0.3]].forEach(([x, z]) => { box(g, 0.06, 0.3, 0.06, WOOD, x, 0.24, z); cyl(g, 0.2, 0.14, 0x2f7a4a, x, 0.5, z); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, z); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, z); });
    }),
  ],
  levels: [
    [
      final((g) => {
        const [Y, MZ, SZ, BZ] = [0.1, 1.04, 1.55, 1.745];
        const cast = (c: number) => lamplit(c, c, 0.2), side = mat(TRIM);
        const B = (w: number, h: number, d: number, c: number, x: number, y: number, z = SZ) => box(g, w, h, d, c, x, y, z, cast(c));
        const rod = (x: number, y: number, len: number, a: number) => { B(0.045, len, 0.06, CAST, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; };
        stone(g, 2.3, Y, 0.84, PAVE, 0, 0, 1.38);
        stone(g, 2.1, 0.32, 0.16, WALL, 0, Y, MZ); box(g, 2.14, 0.025, 0.19, TRIM, 0, Y + 0.32, MZ);
        stone(g, 1.7, 0.1, 0.12, WALL, -0.1, Y + 0.345, MZ); box(g, 1.74, 0.02, 0.15, TRIM, -0.1, Y + 0.445, MZ);
        for (const s of [-1, 1]) for (const x of [0.84, 0.93, 1.02]) box(g, 0.035, 0.32, 0.02, TRIM, s * x, Y, MZ + 0.08);
        box(g, 1.5, 0.27, 0.03, TRIM, 0, Y + 0.025, MZ + 0.095, [side, side, side, side, MURAL, side]);
        stone(g, 0.95, 0.045, 0.3, WALL, 0, Y, SZ);
        for (const s of [-1, 1]) { stone(g, 0.34, 0.09, 0.22, WALL, s * 0.23, Y + 0.045, SZ); box(g, 0.3, 0.02, 0.18, CAST_D, s * 0.23, Y + 0.135, SZ, cast(CAST_D)); }
        const [A, C, Y0] = [-0.23, 0.23, Y + 0.155];
        B(0.11, 0.07, 0.07, CAST_D, A, Y0); B(0.16, 0.3, 0.09, CAST, A, Y0 + 0.07); B(0.19, 0.17, 0.095, CAST, A, Y0 + 0.37); B(0.035, 0.36, 0.01, CAST_D, A, Y0 + 0.12, SZ + 0.05);
        B(0.045, 0.035, 0.05, CAST_L, A, Y0 + 0.54); B(0.09, 0.105, 0.085, CAST_L, A, Y0 + 0.575); B(0.095, 0.03, 0.09, CAST_D, A, Y0 + 0.65); B(0.04, 0.24, 0.06, CAST, A + 0.115, Y0 + 0.25);
        const [hx, hy] = rod(A - 0.1, Y0 + 0.5, 0.3, 0.5); B(0.055, 0.07, 0.045, CAST_L, hx, hy - 0.01).rotation.z = 0.5;
        B(0.12, 0.17, 0.08, CAST_D, C, Y0); B(0.19, 0.3, 0.1, CAST, C, Y0 + 0.14); B(0.17, 0.022, 0.105, CAST_D, C, Y0 + 0.24); B(0.21, 0.07, 0.1, CAST, C, Y0 + 0.4);
        B(0.12, 0.03, 0.11, CAST_D, C, Y0 + 0.46); B(0.09, 0.105, 0.085, CAST_L, C, Y0 + 0.49); B(0.095, 0.03, 0.09, CAST_D, C, Y0 + 0.575);
        for (const s of [-1, 1]) B(0.045, 0.27, 0.07, CAST, C + s * 0.125, Y0 + 0.17);
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) box(g, 0.5, 0.03, 0.1, k & 1 ? DEEP : GRASS, s * 0.84, Y, 1.25 + k * 0.1);
        const bed = (x: number, w: number, d: number, n: number) => {
          const [cx, cz] = [Math.round(w / 0.045), Math.round(d / 0.045)];
          box(g, w, 0.03, d, DEEP, x, Y, BZ);
          for (let l = 0; l < n; l++) for (let i = l; i < cx - l; i++) for (let j = 0; j < cz; j++) box(g, 0.045, 0.04, 0.045, BLOOM[Math.floor(rnd(i, j, l, Math.round(x * 100)) * 3)], x - w / 2 + (i + 0.5) * 0.045, Y + 0.03 + l * 0.04, BZ - d / 2 + (j + 0.5) * 0.045);
        };
        for (const s of [-1, 1]) { bed(s * 0.92, 0.3, 0.1, 2); bed(s * 0.6, 0.24, 0.1, 2); }
        bed(0, 0.7, 0.09, 1);
        for (const [x, z, c] of [[-1.02, 1.64, COAT], [0.98, 1.64, TRIM]]) { box(g, 0.06, 0.1, 0.045, c, x, Y, z); box(g, 0.045, 0.045, 0.045, SKIN, x, Y + 0.1, z); }
      }),
    ],
    [
      final((g) => {
        const [CX, CZ, Y] = [0.8, -0.97, 0.46];
        const DRUM = new THREE.CylinderGeometry(1, 1, 1, 32, 1, false, Math.PI / 32);
        const drum = (r: number, h: number, c: number, y: number) => { part(g, DRUM, h, mat(c), CX, y, CZ).scale.set(r, h, r); };
        const S = (w: number, h: number, d: number, x: number, y: number, z = 0, c = WALL) => box(g, w, h, d, c, CX + x, y, CZ + z);
        const gold = lamplit(GOLD, 0xffcf60, 0.55), T = Y + 0.31, F = T + 0.3;
        stone(g, 0.8, 0.32, 0.91, PAVE, CX, 0, -0.905); stone(g, 0.76, 0.14, 0.84, WALL, CX, 0.32, -0.92);
        drum(0.3, 0.09, INK, Y); drum(0.35, 0.15, WALL, Y + 0.09); drum(0.37, 0.03, TRIM, Y + 0.24); drum(0.3, 0.04, TRIM, Y + 0.27);
        stone(g, 0.34, 0.09, 0.07, WALL, CX, Y, CZ + 0.335); stone(g, 0.38, 0.045, 0.07, WALL, CX, Y, CZ + 0.405);
        for (let k = -6; k <= 6; k++) {
          const a = (k * Math.PI) / 16, p = new THREE.Group(), v = Math.floor(rnd(k + 9, 2) * 3);
          p.position.set(CX + Math.sin(a) * 0.355, Y + 0.13, CZ + Math.cos(a) * 0.355); p.rotation.y = a; g.add(p);
          if (v === 0) box(p, 0.05, 0.07, 0.014, GOLD, 0, 0, 0, gold);
          else if (v === 1) [0, 0.044].forEach((y) => box(p, 0.05, 0.026, 0.014, GOLD, 0, y, 0, gold));
          else { box(p, 0.02, 0.07, 0.014, GOLD, -0.015, 0, 0, gold); box(p, 0.024, 0.024, 0.014, GOLD, 0.014, 0.023, 0, gold); }
        }
        const fist = (x: number, z = 0) => { S(0.15, 0.09, 0.14, x, T, z); [0, 1, 2].forEach((i) => S(0.18, 0.07, 0.16, x + (i & 1) * 0.012, T + 0.09 + i * 0.07, z, i & 1 ? WALL : TRIM)); };
        fist(-0.21); fist(0, -0.05); fist(0.21);
        S(0.09, 0.75, 0.09, -0.21, F); S(0.34, 0.2, 0.15, -0.23, F + 0.62); S(0.34, 0.035, 0.15, -0.23, F + 0.82, 0, TRIM);
        S(0.09, 0.2, 0.09, 0, F, -0.05);
        [[0.15, 0.1], [0.13, 0.1], [0.09, 0.08], [0.05, 0.06], [0.025, 0.04]].reduce((y, [w, h]) => { S(w, h, w * 0.9, 0, y, -0.05); return y + h; }, F + 0.17);
        S(0.09, 0.66, 0.09, 0.21, F);
        let [bx, by] = [0.25, F + 0.64];
        [[0.15, 0.08], [0.13, 0.55], [0.1, 1]].forEach(([len, a]) => { S(len, 0.1, 0.08, bx - (Math.cos(a) * len) / 2, by - (Math.sin(a) * len) / 2 - 0.05, 0.05).rotation.z = a; bx -= Math.cos(a) * len; by -= Math.sin(a) * len; });
      }),
    ],
  ],
} satisfies ModelDef;
