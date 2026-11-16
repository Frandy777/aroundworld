import * as THREE from 'three';
import { bake, box, cyl, final, glass, mat, part, INK, IRON, LAVA, type ModelDef } from '../../builder';
import { glow } from '../../light';

type V3 = [number, number, number];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const STEEL = 0x7b86a0, DARK = 0x2a2d3e, SKID = 0x3a3f5a, RED = 0xd9423e, WHITE = 0xf4f6fa, BLUE = 0x3b5dc9, YEL = 0xe0a020, CONC = 0xb4bccf, PIPE = 0x4a5170, LIGHT = 0xcfd6e6;

const FORE = 0.42, REAR = 0.36, POST = 0.78, PITMAN = 0.4, MID = 0.56, STROKE = 4;
const AXLE: [number, number] = [-0.4, 0.38], PIN = 0.1;
const WELL = FORE + 0.0125;
const linkage = (phi: number) => {
  const px = AXLE[0] + PIN * Math.cos(phi), py = AXLE[1] + PIN * Math.sin(phi), D = Math.hypot(px, py - POST);
  const th = Math.atan2(py - POST, px) + Math.acos((PITMAN * PITMAN - REAR * REAR - D * D) / (2 * REAR * D));
  return { px, py, th, bx: -REAR * Math.cos(th), by: POST - REAR * Math.sin(th) };
};
const HEAD = (() => {
  const s = new THREE.Shape(), a = 0.62;
  s.absarc(0, 0, FORE, -a, a, false); s.absarc(0, 0, FORE - 0.12, a, -a, true);
  return new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.07);
})();
const body = (parent: THREE.Group, x: number, y: number, build: (b: THREE.Group) => void) => {
  const b = new THREE.Group(); b.position.set(x, y, 0);
  build(b); b.traverse((o) => (o.castShadow = false)); bake(b);
  parent.add(b);
  return b;
};

const BAR = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const flame = (parent: THREE.Group, x: number, y: number, z: number) => {
  const f = new THREE.Group(), blaze = [0xfff6b0, LAVA, 0xff3b3b].map((c) => mat(c));
  const bar = (c: number) => { const m = new THREE.Mesh(BAR, blaze[c]); f.add(m); return m; };
  const core = [2, 1, 0].map(bar), tongues = Array.from({ length: 8 }, (_, i) => bar(i % 3 ? 1 : 2));
  tongues.forEach((m, i) => {
    const side = i & 1 ? 1 : -1;
    m.position.set(side * (0.03 + 0.01 * (i % 3)), 0.03 + 0.06 * (i % 4), 0); m.rotation.z = -side * (0.12 + 0.1 * (i % 4));
  });
  f.position.set(x, y, z); parent.add(f);
  f.userData.tick = (t: number) => {
    f.rotation.z = -(0.2 + 0.06 * Math.sin(t * 1.9) + 0.04 * Math.sin(t * 5.3));
    core.forEach((m, i) => m.scale.set([0.19, 0.13, 0.07][i], [0.36, 0.5, 0.34][i] * (0.84 + 0.1 * Math.sin(t * (9 + 3 * i) + i) + 0.06 * Math.sin(t * (23 + 7 * i))), 0.14 + 0.03 * i));
    tongues.forEach((m, i) => m.scale.set(0.045, (0.24 + 0.06 * ((i * 5) % 4)) * Math.sin(Math.PI * ((t / (0.9 + 0.07 * i) + i * 0.37) % 1)) ** 1.5, 0.08));
  };
  f.userData.tick(0);
};

function oil(g: THREE.Group) {
  const [dx, dz] = [-0.68, -0.58], [ox, oz] = [0.34, 0.47], TZ = -0.7, HZ = -0.2, GY = 1.36, FX = 0.99, PY = 0.275;
  const xw = ox + WELL;
  const LED = glow(new THREE.MeshBasicMaterial({ color: 0x35e07a }));
  const strut = (p: THREE.Group, c: number, t: number, a: V3, b: V3) => {
    const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), m = box(p, t, d.length(), t, c);
    m.position.set(...a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  };
  const run = (c: number, r: number, [x0, y0, z0]: V3, [x1, y1, z1]: V3) => {
    const n = Math.abs(x1 - x0) + Math.abs(y1 - y0) + Math.abs(z1 - z0), m = cyl(g, r, n, c, (x0 + x1) / 2, (y0 + y1) / 2 - n / 2, (z0 + z1) / 2);
    if (x0 !== x1) m.rotation.z = Math.PI / 2; else if (z0 !== z1) m.rotation.x = Math.PI / 2;
  };
  const line = (c: number, r: number, ...p: V3[]) => p.forEach((q, i) => {
    if (i) run(c, r, p[i - 1], q);
    if (i && i < p.length - 1) box(g, 2 * r + 0.02, 2 * r + 0.02, 2 * r + 0.02, LIGHT, q[0], q[1] - r - 0.01, q[2]);
  });
  const valve = (x: number, z: number) => {
    box(g, 0.11, 0.09, 0.11, STEEL, x, PY - 0.045, z); box(g, 0.03, 0.09, 0.03, IRON, x, PY + 0.045, z); cyl(g, 0.06, 0.02, RED, x, PY + 0.13, z);
  };
  const tank = (x: number, h: number) => {
    cyl(g, 0.29, 0.05, CONC, x, 0.08, TZ); cyl(g, 0.25, h, WHITE, x, 0.13, TZ); cyl(g, 0.255, 0.12, RED, x, 0.13 + h * 0.4, TZ); cyl(g, 0.26, 0.04, LIGHT, x, 0.09 + h, TZ);
    cyl(g, 0.2, 0.05, 0x9aa5bd, x, 0.13 + h, TZ); cyl(g, 0.1, 0.05, 0x9aa5bd, x, 0.18 + h, TZ); cyl(g, 0.04, 0.06, DARK, x, 0.23 + h, TZ);
    strut(g, DARK, 0.045, [x + 0.2, 0.13, TZ + 0.17], [x - 0.14, 0.11 + h, TZ + 0.23]); box(g, 0.14, 0.03, 0.1, DARK, x - 0.14, 0.09 + h, TZ + 0.2);
  };

  box(g, 2.2, 0.08, 1.9, 0xb9b2a0, 0, 0, -0.05);
  for (const x of [-1, 1]) for (const z of [-1, 1]) strut(g, STEEL, 0.07, [dx + 0.36 * x, 0.08, dz + 0.36 * z], [dx + 0.08 * x, 3.58, dz + 0.08 * z]);
  for (let i = 0; i < 8; i++) {
    const [a, b, y, s] = [0.36 - i * 0.04, 0.32 - i * 0.04, 0.08 + i * 0.5, i & 1 ? -1 : 1], L = 2 * a + 0.07;
    for (const [w, d, x, z] of [[L, 0.05, 0, a], [0.05, L, -a, 0], [0.05, L, a, 0]]) box(g, w, 0.05, d, STEEL, dx + x, y - 0.025, dz + z);
    if (i < 7) for (const [x0, z0, x1, z1] of [[-s * a, a, s * b, b], [a, -s * a, b, s * b], [-a, -s * a, -b, s * b]]) strut(g, STEEL, 0.04, [dx + x0, y, dz + z0], [dx + x1, y + 0.5, dz + z1]);
  }
  box(g, 0.66, 0.06, 0.66, 0x8a8fa3, dx, 0.4, dz);
  box(g, 0.07, 3.5, 0.07, DARK, dx, 0.08, dz); box(g, 0.2, 0.2, 0.2, RED, dx, 2.2, dz);
  box(g, 0.28, 0.14, 0.28, DARK, dx, 3.58, dz); box(g, 0.1, 0.1, 0.1, 0xff3b3b, dx, 3.72, dz);
  box(g, 0.22, 0.26, 0.26, 0xe8e8e8, -0.5, 0.08, -0.1); box(g, 0.28, 0.05, 0.32, RED, -0.5, 0.34, -0.1); box(g, 0.08, 0.1, 0.02, 0x7db6ff, -0.5, 0.2, 0.04, glass(0x7db6ff));

  tank(0.02, 0.9); tank(0.58, 0.74);
  line(PIPE, 0.045, [xw, PY, oz - 0.06], [xw, PY, HZ], [0.02, PY, HZ], [0.02, PY, TZ + 0.25]); line(PIPE, 0.045, [0.58, PY, HZ], [0.58, PY, TZ + 0.25]);
  box(g, 0.11, 0.11, 0.11, LIGHT, 0.58, PY - 0.055, HZ);
  for (const [x, z] of [[0.02, -0.32], [0.58, -0.32], [0.3, HZ], [xw, 0.1]]) valve(x, z);
  for (const [x, z] of [[0.15, HZ], [0.45, HZ], [xw, 0.0], [xw, 0.28]]) box(g, 0.1, 0.15, 0.1, CONC, x, 0.08, z);
  line(YEL, 0.04, [0.02, 1.13, TZ], [0.02, GY, TZ], [FX - 0.05, GY, TZ]); line(YEL, 0.04, [0.58, 0.97, TZ], [0.58, GY, TZ]);
  box(g, 0.1, 0.1, 0.1, LIGHT, 0.58, GY - 0.05, TZ); cyl(g, 0.07, 0.03, LIGHT, FX, GY - 0.015, TZ);

  box(g, 0.24, 0.12, 0.24, 0x8a8fa3, FX, 0.08, TZ); cyl(g, 0.05, 2.38, IRON, FX, 0.2, TZ);
  for (const y of [0.8, 1.7]) cyl(g, 0.07, 0.04, STEEL, FX, y, TZ);
  cyl(g, 0.13, 0.03, STEEL, FX, 2.3, TZ); cyl(g, 0.075, 0.2, DARK, FX, 2.55, TZ); cyl(g, 0.09, 0.04, STEEL, FX, 2.72, TZ);
  flame(g, FX, 2.76, TZ);

  const frame = () => { const u = new THREE.Group(); u.position.set(ox, 0.08, oz); g.add(u); return u; };
  const unit = frame(), pump = frame();
  box(unit, 1.58, 0.04, 0.58, CONC, -0.21, 0, 0);
  for (const z of [-0.17, 0.17]) box(unit, 1.5, 0.05, 0.07, SKID, -0.2, 0.04, z);
  for (const u of [-0.9, -0.3, 0.1, 0.5]) box(unit, 0.07, 0.04, 0.4, SKID, u, 0.05, 0);
  box(unit, 0.3, 0.34, 0.2, BLUE, AXLE[0], 0.09, 0); box(unit, 0.18, 0.03, 0.12, 0x2d4aa8, AXLE[0], 0.43, 0);
  cyl(unit, 0.045, 0.34, STEEL, AXLE[0], AXLE[1] - 0.17, 0).rotation.x = Math.PI / 2;
  cyl(unit, 0.11, 0.34, 0x2f4fb0, -0.8, 0.05, 0).rotation.z = Math.PI / 2; cyl(unit, 0.115, 0.07, DARK, -0.935, 0.185, 0).rotation.z = Math.PI / 2;
  box(unit, 0.3, 0.03, 0.2, DARK, -0.8, 0.09, 0); box(unit, 0.08, 0.05, 0.08, STEEL, -0.8, 0.32, 0); cyl(unit, 0.03, 0.1, DARK, -0.59, 0.17, 0).rotation.z = Math.PI / 2;
  for (const z of [-0.13, 0.13]) {
    strut(unit, STEEL, 0.07, [0.2, 0.09, z], [0, POST - 0.1, z]); strut(unit, STEEL, 0.07, [-0.14, 0.09, z], [0, POST - 0.1, z]); box(unit, 0.3, 0.04, 0.05, STEEL, 0.03, 0.28, z);
  }
  box(unit, 0.14, 0.08, 0.34, SKID, 0, POST - 0.12, 0);
  cyl(unit, 0.15, 0.02, 0x14161f, WELL + 0.04, 0.04, 0.12); box(unit, 0.2, 0.03, 0.2, 0x8a8fa3, WELL, 0.04, 0); cyl(unit, 0.07, 0.08, STEEL, WELL, 0.07, 0);
  box(unit, 0.12, 0.09, 0.12, IRON, WELL, 0.15, 0); cyl(unit, 0.055, 0.02, RED, WELL, 0.185, 0.075).rotation.x = Math.PI / 2;
  cyl(unit, 0.05, 0.1, DARK, WELL, 0.24, 0); cyl(unit, 0.035, 0.03, STEEL, WELL, 0.34, 0);
  box(unit, 0.3, 0.03, 0.22, CONC, -1.22, 0, -0.1); box(unit, 0.2, 0.3, 0.14, 0x8f97ad, -1.22, 0.03, -0.1); box(unit, 0.15, 0.2, 0.02, 0xaab2c8, -1.22, 0.08, -0.03);
  box(unit, 0.24, 0.03, 0.18, DARK, -1.22, 0.33, -0.1); box(unit, 0.06, 0.04, 0.01, YEL, -1.25, 0.24, -0.015);

  const beam = body(pump, 0, POST, (b) => {
    box(b, 0.76, 0.08, 0.12, RED, -0.02, -0.04, 0); part(b, HEAD, 0, mat(RED), 0, 0, 0);
    box(b, 0.05, 0.05, 0.4, DARK, -REAR, -0.025, 0);
  });
  const crank = body(pump, AXLE[0], AXLE[1], (b) => {
    for (const z of [-0.125, 0.125]) { box(b, 0.34, 0.07, 0.04, DARK, 0.05, -0.035, z); box(b, 0.12, 0.16, 0.05, YEL, 0.17, -0.08, z); }
    box(b, 0.05, 0.05, 0.42, DARK, PIN - 0.025, -0.025, 0);
  });
  const pitman = body(pump, 0, 0, (b) => { for (const z of [-0.165, 0.165]) box(b, 0.045, PITMAN + 0.04, 0.04, STEEL, 0, -0.02, z); });
  const rod = body(pump, WELL, MID, (b) => { box(b, 0.06, 0.04, 0.17, DARK, 0, -0.04, 0); box(b, 0.03, 0.55, 0.03, 0xe8ecf4, 0, -0.55, 0); });
  const cable = body(pump, WELL, POST, (b) => { for (const z of [-0.058, 0.058]) box(b, 0.025, 1, 0.025, INK, 0, -1, z); });
  const led = box(pump, 0.06, 0.06, 0.02, 0x35e07a, -1.17, 0.26, -0.01, LED); led.castShadow = false;
  pump.userData.tick = (t: number) => {
    const phi = (2 * Math.PI * t) / STROKE, k = linkage(phi);
    beam.rotation.z = k.th; crank.rotation.z = phi;
    pitman.position.set(k.px, k.py, 0); pitman.rotation.z = Math.atan2(k.px - k.bx, k.by - k.py);
    rod.position.y = MID + FORE * k.th; cable.scale.y = POST - rod.position.y;
    LED.color.setHex(0x35e07a).multiplyScalar(0.12 + 0.43 * (0.5 + 0.5 * Math.cos(phi - 1.5 * Math.PI)) ** 4);
  };
  pump.userData.tick(0);

  for (const [x, z, c] of [[-0.96, 0.8, RED], [-0.74, 0.84, BLUE], [-0.86, 0.66, YEL]]) { cyl(g, 0.1, 0.24, c, x, 0.08, z); cyl(g, 0.105, 0.02, LIGHT, x, 0.3, z); }
}

export default {
  key: 'oil',
  lamps: [{ at: [0.99, 2.95, -0.65], color: 0xff8524, power: 6, reach: 6.5, final: true, flicker: true }],
  props: [
    final(oil),
  ],
} satisfies ModelDef;
