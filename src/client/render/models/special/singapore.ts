import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { block, box, cyl, final, memo, stone, INK, type ModelDef } from '../../builder';
import { glassy, glow, nightlit, switchOf } from '../../light';
import { toon } from '../../scene';

const WARM = 0xffd9a0;
const LIT = new Set<THREE.Material>(), beacon = glow(new THREE.MeshBasicMaterial({ color: INK }));
let own: number | null = null;
const lit = memo((c: number, k: number, light: number = WARM, pane: boolean = false) => { const m = nightlit(toon(c), light, k); LIT.add(m); switchOf(m).value = +(own !== null); return pane ? glassy(m) : m; });
const shine = (c: number | null) => { own = c; LIT.forEach((m) => (switchOf(m).value = +(c !== null))); beacon.color.set(c ?? INK); };

export default {
  key: 'Singapore',
  lamps: [{ at: [0, 0.8, 0.85], color: WARM, power: 3.6, reach: 6.5, final: true, owned: true }],
  props: [
    final((g) => {
      const BASE = 0.46, H = 1.8, ZC = -0.26, OFF = 0.4, LEAN = 0.11, TOP = BASE + H, DY = TOP + 0.08, LX = -0.08, TW = 0.88, TD = 0.8;
      const WATER = 0x3a86e0, PLAZA = 0xd8d2c0, WHITE = 0xf4f6fa, GLASS = 0x8fa4cc, HULL = 0x8d97ab, POOL = 0x4da3ff, AQUA = 0x6cc8ff, LEAF = 0x3f9a5c, LEAF2 = 0x2f7a4a, BULB = 0xfff6b0, WOOD = 0x6e3a12, CREAM = 0xf0e8d4;
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.4, 0.06, 1.5, PLAZA, 0, 0.1, -0.2); box(g, 2.4, 0.03, 0.05, 0xe6e9f0, 0, 0.16, 0.5);
      box(g, 2.3, 0.3, 1.38, 0xdfe3ec, 0, 0.16, ZC); for (const s of [-1, 1]) box(g, 0.75, 0.08, 0.03, 0x3f6fd0, LX + s * 0.62, 0.3, ZC + 0.7, lit(0x3f6fd0, 0.5, WARM, true));
      [LX - 0.75, LX, LX + 0.75].forEach((x, k) => [1, -1].forEach((s) => {
        const p = new THREE.Group(); p.position.set(x, BASE, ZC + s * OFF); p.rotation.x = -s * LEAN; p.scale.set(TW, 1, TD); g.add(p);
        [block(p, 1, 1, 'glass glass', GLASS, 0, 0, 0, true, 10 * (k + 1)).material].flat().forEach((m) => m.userData.maps && (LIT.add(m), switchOf(m).value = +(own !== null)));
      }));
      box(g, 0.1, 0.1, 0.5, WHITE, -1.15, TOP - 0.02, ZC); box(g, 2.06, 0.1, 0.9, WHITE, -0.07, TOP - 0.02, ZC);
      box(g, 0.12, 0.1, 0.72, WHITE, 1.02, TOP - 0.02, ZC); box(g, 0.09, 0.1, 0.5, WHITE, 1.125, TOP - 0.02, ZC); box(g, 0.08, 0.1, 0.26, WHITE, 1.21, TOP - 0.02, ZC);
      box(g, 2.06, 0.07, 0.62, HULL, 0.03, TOP - 0.09, ZC); box(g, 1.7, 0.06, 0.4, HULL, 0.05, TOP - 0.15, ZC); box(g, 0.12, 0.07, 0.34, HULL, 1.12, TOP - 0.09, ZC);
      box(g, 0.9, 0.05, 0.18, POOL, 0.45, DY - 0.02, ZC + 0.35, lit(POOL, 0.8, AQUA));
      box(g, 0.85, 0.03, 0.3, 0x7bbf6a, -0.625, DY - 0.02, ZC - 0.04);
      for (let i = 0; i < 9; i++) box(g, 0.1, i & 1 ? 0.14 : 0.1, 0.1, i & 1 ? LEAF2 : LEAF, -1 + i * 0.22, DY - 0.02, ZC - 0.36);
      box(g, 0.16, 0.08, 0.22, 0xe6e9f0, 1, DY - 0.02, ZC);
      for (const x of [-1.16, 1.21]) { box(g, 0.025, 0.2, 0.025, INK, x, DY - 0.02, ZC); box(g, 0.06, 0.06, 0.06, INK, x, DY + 0.18, ZC, beacon); }
      box(g, 0.46, 0.22, 0.03, 0xe8edf6, LX, 0.16, ZC + 0.7); box(g, 0.38, 0.18, 0.04, 0x1d2c4d, LX, 0.16, ZC + 0.705, lit(0x1d2c4d, 0.85, WARM, true)); box(g, 0.025, 0.18, 0.045, 0xe8edf6, LX, 0.16, ZC + 0.71);
      const mx = -0.78, mz = 0.7;
      box(g, 0.8, 0.06, 0.48, PLAZA, mx, 0.1, mz); cyl(g, 0.2, 0.14, CREAM, mx, 0.16, mz).material = lit(CREAM, 0.4);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, r = 0.17 + 0.21 * Math.sin(0.45), p = box(g, 0.12, 0.42, 0.05, CREAM, mx + r * Math.sin(a), 0.3 + 0.21 * (Math.cos(0.45) - 1), mz + r * Math.cos(a));
        p.rotation.order = 'YXZ'; p.rotation.set(0.45, a, 0);
      }
      const bx = -0.05;
      box(g, 0.5, 0.07, 0.16, WOOD, bx, 0.1, 0.78); box(g, 0.32, 0.03, 0.2, 0xd9423e, bx, 0.22, 0.78); box(g, 0.02, 0.12, 0.02, WOOD, bx - 0.12, 0.17, 0.78); box(g, 0.02, 0.12, 0.02, WOOD, bx + 0.12, 0.17, 0.78);
      for (const x of [-1.1, -0.35, 0.35, 1.1]) { box(g, 0.02, 0.2, 0.02, INK, x, 0.16, 0.48); box(g, 0.05, 0.05, 0.05, BULB, x, 0.36, 0.48); }
      shine(own);
    }),
  ],
  levels: [
    [
      final((g) => {
        const WHITE = 0xffffff, SHADE = 0xd5deee, FOAM = 0xeaf6ff, WATER = 0x4da3ff, LAPIS = 0x2f5fc0, SKY = 0x7fb3ff, MAW = 0x3b1020, NOSE = 0x596176, PAVE = 0xd6cdbd, CZ = 1.43, S = 1.18;
        const lamp = (o: THREE.Mesh, c: number) => (o.material = lit(c, 0.16, 0xffe9c4), o);
        stone(g, 1.4, 0.12, 0.84, PAVE, -0.5, 0, CZ); box(g, 1.28, 0.08, 0.72, WATER, -0.5, 0.12, CZ);
        const m = new THREE.Group(); m.position.set(-0.14, 0.12, CZ - 0.06); m.rotation.y = 0.3 - Math.PI / 2; m.scale.setScalar(S); g.add(m);
        const cw = (p: THREE.Group, r: number, h: number, c: number, x: number, y: number, z: number) => lamp(cyl(p, r, h, c, x, y, z), c);
        const wb = (p: THREE.Group, w: number, h: number, d: number, c: number, x: number, y: number, z: number) => lamp(box(p, w, h, d, c, x, y, z), c);
        cyl(m, 0.3, 0.09, LAPIS, 0, 0, 0); cyl(m, 0.26, 0.04, SKY, 0, 0.09, 0); cyl(m, 0.21, 0.035, LAPIS, 0, 0.13, 0);
        for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; box(m, 0.09, 0.055 + 0.025 * (k & 1), 0.08, k & 1 ? SKY : LAPIS, 0.29 * Math.sin(a), 0.025, 0.29 * Math.cos(a)).rotation.y = a; }
        const profile = [0.21, 0.205, 0.195, 0.185, 0.175, 0.165, 0.158, 0.15, 0.145];
        profile.forEach((r, i) => cw(m, r, 0.09, WHITE, 0, 0.16 + i * 0.075, 0));
        const scale = (p: THREE.Group, r: number, c: number, y: number, z: number) => { const o = cw(p, r, 0.018, c, 0, y - 0.009, z); o.scale.y = 0.72; o.rotation.x = Math.PI / 2; };
        for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) {
          const r = profile[i] + 0.003, a = -1.4 + j * (2.8 / 6) + (i & 1 ? 0.1 : 0), p = new THREE.Group();
          p.position.set(r * Math.sin(a), 0.235 + i * 0.075, -r * Math.cos(a)); p.rotation.y = Math.PI - a; m.add(p);
          scale(p, 0.049, SHADE, 0, 0.004); scale(p, 0.047, WHITE, 0.004, 0.015);
        }
        cw(m, 0.15, 0.15, WHITE, 0, 0.76, 0.015);
        const paw = new THREE.Group(); paw.position.set(-0.065, 0.53, 0.145); paw.rotation.x = -0.16; m.add(paw); wb(paw, 0.075, 0.29, 0.075, WHITE, 0, 0, 0); wb(paw, 0.105, 0.075, 0.09, WHITE, 0, 0.27, 0.015);
        [0.35, 0.62, 0.9, 1.18, 1.45].forEach((a, i) => {
          const p = new THREE.Group(), w = [0.065, 0.08, 0.095, 0.08, 0.065][i], h = [0.27, 0.34, 0.38, 0.34, 0.27][i]; p.position.set(0, 0.18, 0.14); p.rotation.x = a; m.add(p);
          wb(p, w, h, 0.035, SHADE, 0, 0, 0); wb(p, w - 0.014, h - 0.025, 0.04, WHITE, 0, 0.015, 0.012);
        });
        cw(m, 0.2, 0.34, SHADE, 0, 0.73, -0.07).scale.z = 0.8;
        [[0.36, 0.4, 0.61, -0.18, 0.18], [0.32, 0.27, 0.9, -0.145, 0.12], [0.24, 0.16, 1.07, -0.1, 0]].forEach(([w, h, y, z, t]) => {
          const p = new THREE.Group(); p.position.set(0, y, z); p.rotation.x = t; m.add(p); wb(p, w, h, 0.12, WHITE, 0, 0, 0);
          for (const x of [-w * 0.28, 0, w * 0.28]) wb(p, 0.014, h - 0.06, 0.014, SHADE, x, 0.03, -0.067);
        });
        const hd = new THREE.Group(); hd.position.set(0, 1.02, 0.045); hd.rotation.x = -0.12; hd.scale.setScalar(1.15); m.add(hd);
        cw(hd, 0.2, 0.25, SHADE, 0, -0.12, -0.12).scale.z = 0.75;
        const ruff = cw(hd, 0.26, 0.12, WHITE, 0, -0.06, -0.11); ruff.rotation.x = Math.PI / 2;
        for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; wb(hd, 0.018, 0.09, 0.015, SHADE, 0.225 * Math.sin(a), 0.225 * Math.cos(a) - 0.02, -0.043).rotation.z = -a; }
        cw(hd, 0.18, 0.26, WHITE, 0, -0.11, -0.035); cw(hd, 0.14, 0.06, WHITE, 0, 0.15, -0.035); wb(hd, 0.24, 0.08, 0.18, WHITE, 0, 0.12, -0.025);
        wb(hd, 0.22, 0.13, 0.18, WHITE, 0, -0.01, 0.11);
        for (const s of [-1, 1]) {
          wb(hd, 0.12, 0.1, 0.11, WHITE, s * 0.055, -0.085, 0.22);
          wb(hd, 0.055, 0.05, 0.04, WHITE, s * 0.12, 0.14, -0.015).rotation.z = s * 0.35; wb(hd, 0.025, 0.025, 0.015, SHADE, s * 0.12, 0.155, 0.008);
          box(hd, 0.027, 0.038, 0.04, INK, s * 0.14, 0.045, 0.085); box(hd, 0.009, 0.012, 0.01, WHITE, s * 0.14 - 0.006, 0.068, 0.108);
          wb(hd, 0.085, 0.035, 0.05, WHITE, s * 0.12, 0.09, 0.075).rotation.z = -s * 0.28;
          for (let i = 0; i < 3; i++) { wb(hd, 0.07, 0.16, 0.1, WHITE, s * (0.16 + i * 0.01), -0.18 + i * 0.1, -0.07 - i * 0.025).rotation.z = s * (0.12 + i * 0.1); box(hd, 0.012, 0.012, 0.012, SHADE, s * (0.035 + i * 0.022), -0.06 - (i & 1) * 0.025, 0.273); }
          wb(hd, 0.025, 0.07, 0.025, WHITE, s * 0.058, -0.19, 0.25); wb(hd, 0.025, 0.035, 0.025, WHITE, s * 0.055, -0.24, 0.24);
        }
        box(hd, 0.105, 0.055, 0.045, NOSE, 0, -0.035, 0.29); box(hd, 0.016, 0.055, 0.018, NOSE, 0, -0.09, 0.278);
        wb(hd, 0.18, 0.13, 0.15, MAW, 0, -0.19, 0.17); box(hd, 0.16, 0.12, 0.025, MAW, 0, -0.19, 0.25); box(hd, 0.075, 0.02, 0.04, 0xa95462, 0, -0.25, 0.24);
        wb(hd, 0.19, 0.05, 0.19, WHITE, 0, -0.275, 0.16); wb(hd, 0.15, 0.055, 0.09, WHITE, 0, -0.3, 0.2);
        const L = 0.38, spray = lit(FOAM, 0.35, 0xbfe4ff), y = (s: number) => 0.88 + 0.08 * s - 5.75 * s * s;
        const core = lit(0x94c8ff, 0.12, 0xbfe4ff), zc = 0.4 + L;
        for (let i = 0; i < 10; i++) { const s0 = (L * i) / 10, s1 = (L * (i + 1)) / 10, w = 0.05 + 0.04 * (i / 9), o = box(m, w, w, Math.hypot(L / 10, y(s1) - y(s0)) + 0.01, FOAM, 0, (y(s0) + y(s1)) / 2 - w / 2, 0.4 + (s0 + s1) / 2); o.rotation.x = Math.atan2(y(s0) - y(s1), L / 10); o.material = core; }
        const flow = new THREE.Mesh(mergeGeometries(Array(22).fill(new THREE.BoxGeometry().toNonIndexed())), spray), [pos, nor] = ['position', 'normal'].map((k) => flow.geometry.getAttribute(k) as THREE.BufferAttribute), [p0, n0] = [pos, nor].map((a) => a.array.slice());
        const pose = new THREE.Object3D(), vt = new THREE.Vector3();
        const put = (i: number, px: number, py: number, pz: number, pitch: number, w: number, h: number, d: number) => {
          pose.position.set(px, py, pz); pose.rotation.x = pitch; pose.scale.set(w, h, d); pose.updateMatrix();
          for (let k = 36 * i; k < 36 * i + 36; k++) { vt.fromArray(p0, 3 * k).applyMatrix4(pose.matrix).toArray(pos.array, 3 * k); vt.fromArray(n0, 3 * k).applyQuaternion(pose.quaternion).toArray(nor.array, 3 * k); }
        };
        flow.frustumCulled = false; flow.receiveShadow = true; flow.geometry.userData.own = true; m.add(flow);
        flow.userData.tick = (t: number) => {
          let n = 0;
          for (let i = 0; i < 7; i++) { const p = (t / 0.9 + i / 7) % 1, s = L * p, w = (0.065 + 0.05 * p) * (1 + 0.2 * Math.sin(5 * i)) * Math.min(1, 6 * p, 6 - 6 * p); put(n++, 0, y(s), 0.4 + s, Math.atan(11.5 * s - 0.08), w, w, 0.05); }
          for (let j = 0; j < 6; j++) { const q = (t / (0.7 + 0.06 * j) + 0.37 * j) % 1, r = (0.06 + 0.03 * (j % 3)) * q, e = 0.06 * Math.sqrt(Math.sin(Math.PI * q)); put(n++, r * Math.sin(2.4 * j), 0.09 + 0.72 * q * (1 - q), zc + 0.6 * r * Math.cos(2.4 * j), 0, e, e, e); }
          put(n++, 0, 0.1, zc, 0, 0.13 + 0.03 * Math.sin(8 * t), 0.04, 0.13 + 0.03 * Math.sin(8 * t));
          for (let k = 0; k < 2; k++) { const q = (t / 1.4 + k / 2) % 1, r = 0.025 + 0.055 * q, e = 0.005 + 0.02 * (1 - q); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(n++, dx * r, 0.09, zc + dz * r, 0, dx ? e : 2 * r + e, 0.02, dx ? 2 * r + e : e); }
          pos.needsUpdate = nor.needsUpdate = true;
        };
        flow.userData.tick(0);
      }),
    ],
    [
      final((g) => {
        const LAWN = 0x6fb55f, LEAF = 0x3f9a5c, LEAF2 = 0x2f7a4a, PINK = 0xd0368a, ROSE = 0xff8fd6, VIOLET = 0x8a46d0, LILAC = 0xcdb4ff, LIME = 0xb4e83c, GOLD = 0xf2c46d, BLUE = 0x6a78c8, PAVE = 0xd6cdbd, PALE = 0xe4eaf5, SKY = 0xcfeaf6, MINT = 0xc4ebd6;
        stone(g, 0.9, 0.12, 1.2, PAVE, 0.75, 0, 1.2); box(g, 0.8, 0.04, 1.1, LAWN, 0.75, 0.12, 1.2);
        const on = (o: THREE.Mesh, c: number, k: number, light: number) => (o.material = lit(c, k, light), o);
        const tree = (x: number, z: number, h: number, r: number, rib: number, rim: number, glow: number, rimGlow: number) => {
          const F = 0.1 + 0.9 * r, d = 0.4 * r + 0.02, yn = h - F, ct = 0.65 * F, N = 12;
          on(cyl(g, 0.09, 0.12, LEAF2, x, 0.16, z), LEAF2, 0.3, 0x5fe08a); on(cyl(g, 0.06, yn - 0.34, LEAF2, x, 0.28, z), LEAF2, 0.3, 0x5fe08a);
          for (let k = 0; k < 12; k++) on(box(g, 0.06, 0.09, 0.06, k & 1 ? LEAF : LEAF2, x + 0.068 * Math.sin(2.4 * k), 0.3 + ((yn - 0.44) * k) / 11, z + 0.068 * Math.cos(2.4 * k)), k & 1 ? LEAF : LEAF2, 0.35, 0x7fe0a0);
          for (let k = 0; k < 6; k++) on(box(g, 0.03, 0.03, 0.03, GOLD, x + 0.15 * Math.sin((k * Math.PI) / 3), 0.16, z + 0.15 * Math.cos((k * Math.PI) / 3)), GOLD, 1, 0xffd9a0);
          on(cyl(g, 0.06, 0.06, BLUE, x, yn - 0.06, z), BLUE, 0.9, 0x5aa8ff);
          for (let i = 0; i < 3; i++) on(cyl(g, 0.075 + ((d - 0.075) * i) / 2, ct / 3, GOLD, x, yn + (i * ct) / 3, z), GOLD, 0.9, 0xffa94d);
          on(cyl(g, d + 0.012, 0.02, LIME, x, yn + ct, z), LIME, 0.9, 0xb8ff40); on(cyl(g, d - 0.045, 0.015, GOLD, x, yn + ct + 0.02, z), GOLD, 0.9, 0xffa94d);
          const bend = [[0.08, 0.08], [d + 0.03, ct], [r, F], [r + 0.05, F + 0.035]];
          for (let k = 0; k < N; k++) {
            const p = new THREE.Group(); p.position.set(x, yn, z); p.rotation.y = (k * 2 * Math.PI) / N - Math.PI / 2; g.add(p);
            for (const j of [0, 1, 2]) { const [r0, y0] = bend[j], [r1, y1] = bend[j + 1], q = new THREE.Group(); q.position.set(r0, y0, 0); q.rotation.z = -Math.atan2(r1 - r0, y1 - y0); p.add(q); on(box(q, 0.045, Math.hypot(r1 - r0, y1 - y0), 0.045, rib), rib, 0.7, glow); }
          }
          for (const [rr, yy, c, l] of [[d + 0.03, ct, rib, glow], [(d + 0.03 + r) / 2, (ct + F) / 2, rib, glow], [r, F, rim, rimGlow]]) for (let k = 0; k < N; k++) { const a = ((k + 0.5) * 2 * Math.PI) / N, e = rr * Math.cos(Math.PI / N); on(box(g, 2 * rr * Math.sin(Math.PI / N), 0.04, 0.045, c, x + e * Math.sin(a), yn + yy - 0.02, z + e * Math.cos(a)), c, c === rim ? 0.8 : 0.7, l).rotation.y = a; }
        };
        tree(0.55, 0.9, 1.6, 0.3, PINK, ROSE, 0xff4fd8, 0xff9aea); tree(0.9, 1.1, 1.15, 0.24, VIOLET, LILAC, 0xa56bff, 0xcdb0ff); tree(1.02, 0.7, 1.25, 0.17, PINK, ROSE, 0xff4fd8, 0xff9aea);
        on(box(g, 0.51, 0.04, 0.07, 0xe6e9f0, 0.785, 0.72, 0.8), 0xe6e9f0, 0.3, 0xffd9a0).rotation.y = 0.402; on(box(g, 0.49, 0.012, 0.04, GOLD, 0.785, 0.76, 0.8), GOLD, 0.9, 0xffa94d).rotation.y = 0.402;
        const dome = (x: number, z: number, r: number, h: number, n: number, c: number) => {
          cyl(g, r + 0.03, 0.04, PALE, x, 0.16, z);
          for (let i = 0; i < n; i++) cyl(g, r * Math.sqrt(1 - ((i + 0.5) / n) ** 2.2), h / n, c, x, 0.2 + (i * h) / n, z).material = lit(c, 0.5, WARM, true);
        };
        dome(0.52, 1.52, 0.28, 0.26, 5, SKY); dome(0.98, 1.5, 0.18, 0.4, 7, MINT);
      }),
    ],
  ],
  owner: shine,
} satisfies ModelDef;
