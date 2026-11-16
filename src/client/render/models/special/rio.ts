import * as THREE from 'three';
import { box, cyl, decal, final, lamplit, mat, part, stone, INK, type ModelDef } from '../../builder';

const CONCRETE = 0xded8c6, SNOW = 0xf4f6fa, BLUE = 0x2b68d4, YELLOW = 0xf4c430, GREEN = 0x3ba35a, LIME = 0x55ca75, RED = 0xe43b44, LAMP = 0xfff6b0;

export default {
  key: 'Rio',
  lamps: [{ at: [0, 2.2, 0.7], color: 0xffe8c0, power: 3.4, reach: 6.5, final: true }],
  props: [
    final((g) => {
      const [SX, SZ, H, D] = [0, -0.15, 0.115, 0.7];
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, SAND = 0xf0dca0, STAIR = 0xdcd0b0, GR = 0xcbc3ae, GRL = 0xded8c6, DARK = 0x3f392e, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;
      const SOAP = 0xf0f4ec, SOAPL = 0xfcfdf9, SOAPD = 0xcad5cc, SOAPDD = 0x96a79a;
      const flood = (c: number) => lamplit(c, 0xffe9c4, 0.16), soap = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => box(g, w, h, d, c, x, y, z, flood(c));
      const RX = [0.98, 0.93, 0.87, 0.81, 0.75, 0.69, 0.63, 0.58, 0.54, 0.5, 0.46];
      const LEAF = [0x2a7f48, 0x2f8a4e, 0x359654, 0x3ba35a, 0x42b062, 0x4abd6a, 0x55ca75], ROCK = [0xb2a994, 0xa39b88, 0x948c7a, 0x877f6f];
      const T = 0.12 + RX.length * H, P = T + 0.65, Y = (h: number) => P + h;
      const Z = (k: number) => SZ + D * RX[k] * 0.951;
      const topAt = (x: number, z: number) => 0.12 + H * (1 + Math.max(-1, ...RX.map((rx, i) => (((x - SX) / rx) ** 2 + ((z - SZ) / (rx * D)) ** 2 < 0.8 ? i : -1))));
      const DECAGON = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, Math.PI / 10);
      const slab = (rx: number, rz: number, x: number, z: number, y: number, h: number, c: number) => part(g, DECAGON, h, mat(c), x, y, z).scale.set(rx, h, rz);
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);
      slab(1.1, 1.1 * D, SX, SZ, 0.1, 0.02, FOAM); slab(1.06, 1.06 * D, SX, SZ, 0.1, 0.04, SAND); slab(0.85, 0.26, SX, SZ + 0.6, 0.1, 0.05, SAND);
      RX.forEach((rx, i) => slab(rx, rx * D, SX, SZ, 0.12 + i * H, H, i < 7 ? LEAF[i] : ROCK[i - 7]));
      RX.forEach((_, k) => box(g, 0.16, H, 0.14, STAIR, SX, 0.12 + k * H, Z(k) - 0.04));
      [[0.24, 0x2a7f48], [0.24, 0x359654], [0.22, 0xb5aa98], [0.19, 0xc4baa8], [0.15, 0xb5aa98], [0.1, 0xc4baa8], [0.05, 0xb5aa98]].forEach(([r, c], i) => slab(r, r * 0.8, 0.96, -0.66, 0.1 + i * 0.12, 0.12, c));
      box(g, 0.1, 0.06, 0.07, 0xe43b44, 0.96, 0.94, -0.66);
      const rock = (x: number, z: number, s: number) => { const y = topAt(x, z); box(g, 0.2 * s, 0.1 * s, 0.14 * s, 0xa39b88, x, y, z); box(g, 0.12 * s, 0.08 * s, 0.1 * s, 0xb2a994, x + 0.03 * s, y + 0.1 * s, z).rotation.y = 0.5; };
      rock(-0.5, SZ + 0.1, 1.2); rock(0.5, SZ + 0.08, 1); rock(-0.28, SZ + 0.2, 0.8);
      const CROWN = [[0x2f7a4a, 0x3f9a5c, 0x4fb06a], [0x277043, 0x358f55, 0x45a862], [0xe0a020, 0xf4c430, 0xffe066]];
      const tree = (x: number, z: number, s: number, c: number) => { const y = topAt(x, z); [[0.15, 0.12], [0.12, 0.11], [0.08, 0.1]].forEach(([r, h], i) => cyl(g, r * s, h * s, CROWN[c][i], x, y + (0.03 + i * 0.09) * s, z)); };
      for (let i = 0; i < 26; i++) { const a = i * 2.4, t = Math.sqrt((i + 0.5) / 26), x = SX + t * 0.92 * Math.cos(a), z = SZ + t * 0.64 * Math.sin(a); if (t > 0.6 && (Math.abs(x - SX) > 0.2 || z < SZ)) tree(x, z, 0.8 + (i % 3) * 0.12, i % 7 === 3 ? 2 : i & 1); }
      stone(g, 1, 0.08, 0.74, GRL, SX, T, SZ); box(g, 0.96, 0.08, 0.04, GR, SX, T + 0.08, SZ + 0.34);
      for (const s of [-1, 1]) box(g, 0.04, 0.08, 0.7, GR, SX + s * 0.48, T + 0.08, SZ);
      stone(g, 0.72, 0.06, 0.54, GR, SX, T + 0.08, SZ); stone(g, 0.54, 0.46, 0.4, GR, SX, T + 0.14, SZ); box(g, 0.62, 0.05, 0.48, GRL, SX, T + 0.6, SZ);
      box(g, 0.1, 0.18, 0.02, DARK, SX, T + 0.14, SZ + 0.2); box(g, 0.15, 0.03, 0.03, GRL, SX, T + 0.32, SZ + 0.2);
      [[-0.32, 0xe43b44], [-0.14, 0xffd23f], [0.15, 0x41a6f6], [0.33, 0x38b764]].forEach(([x, c]) => { box(g, 0.05, 0.08, 0.04, c, SX + x, T + 0.08, SZ + 0.26); box(g, 0.04, 0.04, 0.04, 0xf5b88c, SX + x, T + 0.16, SZ + 0.26); box(g, 0.12, 0.02, 0.025, c, SX + x, T + 0.145, SZ + 0.26); });
      soap(0.4, 0.14, 0.28, SOAPD, SX, P, SZ); soap(0.37, 0.41, 0.25, SOAP, SX, Y(0.14), SZ); soap(0.34, 0.4, 0.23, SOAP, SX, Y(0.55), SZ); soap(0.31, 0.35, 0.21, SOAP, SX, Y(0.95), SZ);
      [[-0.13, SOAPD], [-0.045, SOAPL], [0.045, SOAPD], [0.13, SOAPL]].forEach(([x, c]) => soap(0.075, 1.1, 0.03, c, SX + x, Y(0.16), SZ + 0.115));
      soap(0.35, 0.32, 0.2, SOAPL, SX, Y(1.3), SZ);
      const sleeve = (s: number) => new THREE.ExtrudeGeometry(new THREE.Shape([[0.17, 1.612], [0.694, 1.535], [0.694, 1.47], [0.56, 1.28], [0.17, 1.28]].map(([x, y]) => new THREE.Vector2(s * x, Y(y)))), { depth: 0.15, bevelEnabled: false }).translate(0, 0, -0.075);
      for (const s of [-1, 1]) {
        part(g, sleeve(s), 0, flood(SOAP), SX, 0, SZ);
        soap(0.14, 0.065, 0.085, SOAPL, SX + s * 0.75, Y(1.47), SZ); soap(0.12, 0.05, 0.075, SOAP, SX + s * 0.88, Y(1.475), SZ); soap(0.07, 0.035, 0.04, SOAPL, SX + s * 0.74, Y(1.535), SZ + 0.025);
      }
      soap(0.1, 0.1, 0.1, SOAPD, SX, Y(1.6), SZ); soap(0.18, 0.22, 0.17, SOAP, SX, Y(1.67), SZ); soap(0.2, 0.05, 0.19, SOAPD, SX, Y(1.86), SZ - 0.005);
      for (const s of [-1, 1]) soap(0.035, 0.27, 0.18, SOAPD, SX + s * 0.11, Y(1.6), SZ - 0.01);
      soap(0.14, 0.02, 0.02, SOAPDD, SX, Y(1.8), SZ + 0.09); soap(0.03, 0.08, 0.03, SOAPL, SX, Y(1.7), SZ + 0.095); soap(0.1, 0.1, 0.05, SOAPD, SX, Y(1.58), SZ + 0.08);
      const palm = (x: number, z: number, h: number) => {
        for (let i = 0; i < 3; i++) box(g, 0.08 - 0.008 * i, h / 3, 0.08 - 0.008 * i, i & 1 ? WOOD : 0x7a4a22, x + 0.025 * i, 0.15 + (i * h) / 3, z);
        for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5 + 0.3; box(g, 0.11, 0.025, 0.36, k & 1 ? 0x2fa84f : 0x4cc36b, x + 0.08 + Math.sin(a) * 0.16, 0.11 + h, z + Math.cos(a) * 0.16).rotation.set(0.45, a, 0, 'YXZ'); }
      };
      palm(-0.7, SZ + 0.62, 0.7); palm(-0.5, SZ + 0.7, 0.5);
      const BR = ['mmmmYYYmmmm', 'mmYYuuuYYmm', 'mYYuuuuuYYm', 'YYYwwwwwYYY', 'mYYuuuuuYYm', 'mmYYuuuYYmm', 'mmmmYYYmmmm'];
      box(g, 0.03, 0.8, 0.03, 0xdddddd, 0.3, 0.15, 0.52); decal(g, BR, 0.3 + 11 / 44, 0.62, 0.52);
      const [bx, bz] = [0.78, 0.82];
      box(g, 0.38, 0.06, 0.13, WHITE, bx, 0.1, bz); box(g, 0.39, 0.02, 0.135, 0x2b68d4, bx, 0.1, bz); box(g, 0.08, 0.06, 0.09, WHITE, bx + 0.22, 0.1, bz);
      box(g, 0.16, 0.05, 0.1, 0xdce4ff, bx - 0.03, 0.16, bz); box(g, 0.02, 0.5, 0.02, 0xdddddd, bx, 0.16, bz);
      decal(g, ['.....w', '....ww', '....ww', '...www', '...www', '..wwww', '..wwww', '.wwwww', '.wwwww', 'wwwwww'], bx - 3 / 22 - 0.01, 0.2, bz); decal(g, ['R...', 'RR..', 'RR..', 'RRR.', 'RRR.', 'RRRR', 'RRRR'], bx + 2 / 22 + 0.02, 0.2, bz);
      [[-0.9, 0.85], [0.3, 0.9], [1.0, 0.65]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));
    }),
  ],
  levels: [
    [
      final((g) => {
        const [MX, MZ, A, B, EY, PX, PZ] = [-0.5, 1.4, 0.62, 0.37, 0.27, 0.25, 0.115];
        const oval = (a: number, b: number) => Array.from({ length: 40 }, (_, i) => new THREE.Vector2(a * Math.cos((i * Math.PI) / 20), b * Math.sin((i * Math.PI) / 20)));
        const ring = (a0: number, b0: number, a1: number, b1: number, y: number, h: number, c: number) => {
          const s = new THREE.Shape(oval(a1, b1)); if (a0) s.holes.push(new THREE.Path(oval(a0, b0)));
          return part(g, new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2), 0, mat(c), MX, y, MZ);
        };
        ring(0, 0, A + 0.07, B + 0.04, 0, 0.04, CONCRETE);
        ring(0.57, 0.33, A, B, 0.04, 0.09, CONCRETE); ring(0.57, 0.33, A - 0.005, B - 0.005, 0.13, 0.1, INK); ring(0.57, 0.33, A + 0.01, B + 0.01, 0.23, 0.04, CONCRETE);
        for (let k = 0; k < 32; k++) { const t = (k * Math.PI) / 16; box(g, 0.045, 0.1, 0.04, SNOW, MX + A * Math.cos(t), 0.13, MZ + B * Math.sin(t)).rotation.y = Math.atan2(-B * Math.cos(t), -A * Math.sin(t)); }
        [[0.33, 0.185, 0.09, BLUE], [0.4, 0.23, 0.14, YELLOW], [0.47, 0.275, 0.19, BLUE]].forEach(([a, b, top, c]) => ring(a, b, A - 0.05, B - 0.04, 0.04, top - 0.04, c));
        for (let i = 0; i < 8; i++) { const c = i & 1 ? LIME : GREEN; box(g, PX / 4, 0.02, 2 * PZ, c, MX - PX + (i + 0.5) * (PX / 4), 0.04, MZ, lamplit(c, c, 0.45)); }
        const line = (w: number, d: number, x: number, z: number) => box(g, w, 0.008, d, SNOW, MX + x, 0.06, MZ + z);
        for (const s of [-1, 1]) { line(2 * PX, 0.025, 0, s * (PZ - 0.0125)); line(0.025, 2 * PZ, s * (PX - 0.0125), 0); line(0.1, 0.025, s * (PX - 0.05), 0.07); line(0.1, 0.025, s * (PX - 0.05), -0.07); line(0.025, 0.165, s * (PX - 0.1), 0); }
        line(0.025, 2 * PZ, 0, 0); ring(0.035, 0.035, 0.06, 0.06, 0.06, 0.008, SNOW);
        ring(0.43, 0.235, A + 0.03, B + 0.025, EY, 0.035, SNOW); ring(0.43, 0.235, 0.455, 0.26, EY + 0.035, 0.02, LAMP);
      }),
    ],
    [
      final((g) => {
        const [SX, ZF, N, RUN, RISE, CW, WALL] = [0.74, 1.82, 7, 0.117, 0.085, 0.1, 0.12];
        const TILE: Record<string, number> = { B: BLUE, Y: YELLOW, G: GREEN, R: RED, W: SNOW };
        const STEPS = ['RWRWR', 'GYBGY', 'YBWRB', 'BGYBG', 'WRBYW', 'YGRGY', 'BYGBR'];
        const WALLS = ['BGYRWBG', 'YRBGYWR'];
        const T = (RISE + 0.1) / 2, EDGE = 2.5 * CW + WALL / 2, top = (k: number) => (k + 1) * RISE + 0.1;
        for (let k = 0; k < N; k++) {
          const z = ZF - RUN * (k + 0.5), y = k * RISE;
          if (k) { box(g, 5 * CW, y, RUN, CONCRETE, SX, 0, z); for (const s of [-1, 1]) box(g, WALL, y, RUN, CONCRETE, SX + s * EDGE, 0, z); }
          [...STEPS[k]].forEach((c, i) => box(g, CW, RISE, RUN, TILE[c], SX + (i - 2) * CW, y, z));
          for (const s of [-1, 1]) [0, 1].forEach((j) => box(g, WALL, T, RUN, TILE[WALLS[s < 0 ? j : 1 - j][k]], SX + s * EDGE, y + j * T, z));
        }
        for (const s of [-1, 1]) {
          const x = SX + s * EDGE, z = ZF - RUN / 2;
          box(g, 0.02, 0.18, 0.02, INK, x, top(0), z); box(g, 0.05, 0.05, 0.05, LAMP, x, top(0) + 0.18, z);
          box(g, 0.09, 0.07, 0.09, RED, x + s * 0.12, 0, ZF - 0.07); box(g, 0.11, 0.09, 0.11, GREEN, x + s * 0.12, 0.07, ZF - 0.07); box(g, 0.07, 0.07, 0.07, LIME, x + s * 0.12, 0.16, ZF - 0.07);
        }
        [[-1, 2], [1, 4], [-1, 5], [1, 6]].forEach(([s, k]) => { const x = SX + s * EDGE, z = ZF - RUN * (k + 0.5); box(g, 0.1, 0.05, 0.1, k & 1 ? LIME : GREEN, x, top(k), z); box(g, 0.06, 0.05, 0.06, k & 1 ? GREEN : LIME, x + s * 0.02, top(k) + 0.05, z); });
      }),
    ],
  ],
} satisfies ModelDef;
