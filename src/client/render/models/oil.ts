import * as THREE from 'three';
import { bake, box, cyl, mat, part, INK, IRON, LAVA } from '../builder';
import { glow } from '../light';

type V3 = [number, number, number];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const STEEL = 0x7b86a0, DARK = 0x2a2d3e, SKID = 0x3a3f5a, RED = 0xd9423e, WHITE = 0xf4f6fa, BLUE = 0x3b5dc9, YEL = 0xe0a020, CONC = 0xb4bccf, PIPE = 0x4a5170, LIGHT = 0xcfd6e6;

// ---- The pumping unit works in a frame of its own: u along x (the horsehead towards +u, the beam's pivot at u = 0), v up from the ground. A crank turns evenly; its pin drags the beam's rear
// end by the pitman (a rigid link), so the beam nods about its pivot, a little unevenly, as a real one does; the cable runs over the horsehead (an arc about the pivot), so the carrier bar rides FORE x the tilt ----
const FORE = 0.42, REAR = 0.36, POST = 0.78, PITMAN = 0.4, MID = 0.56, STROKE = 4; // the beam's arms before and behind the pivot, the pivot's height, the pitman's length, the carrier bar's mid height, seconds to a stroke
const AXLE: [number, number] = [-0.4, 0.38], PIN = 0.1; // the crank's axle (u, v) and the pin's radius round it
const WELL = FORE + 0.0125; // the polished rod's u: the cable leaves the horsehead there, straight down, with its inner face on the arc
const linkage = (phi: number) => { // the pin, the beam's tilt (its rear end is a pitman's length from the pin) and its rear end, at crank angle phi
  const px = AXLE[0] + PIN * Math.cos(phi), py = AXLE[1] + PIN * Math.sin(phi), D = Math.hypot(px, py - POST);
  const th = Math.atan2(py - POST, px) + Math.acos((PITMAN * PITMAN - REAR * REAR - D * D) / (2 * REAR * D));
  return { px, py, th, bx: -REAR * Math.cos(th), by: POST - REAR * Math.sin(th) };
};
const HEAD = (() => { // the horsehead: a band of that arc, 0.12 thick and 0.14 wide, facing +u
  const s = new THREE.Shape(), a = 0.62;
  s.absarc(0, 0, FORE, -a, a, false); s.absarc(0, 0, FORE - 0.12, a, -a, true);
  return new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.07);
})();
const LED = glow(new THREE.MeshBasicMaterial({ color: 0x35e07a })); // the indicator: unlit, so that it glows in the dark; its brightness is set every frame
// A rigid part that moves, built round its pivot (u = x, v = y): it casts no shadow (the sun's map is not drawn again for what moves) and is baked into a few meshes of its own
const body = (parent: THREE.Group, x: number, y: number, build: (b: THREE.Group) => void) => {
  const b = new THREE.Group(); b.position.set(x, y, 0);
  build(b); b.traverse((o) => (o.castShadow = false)); bake(b);
  parent.add(b);
  return b;
};

// ---- The flare's flame, at the nozzle: three nested bars (red, orange, white-hot; each a little deeper than the last, so that it shows in front of the one outside it) that flicker, and eight
// tongues, each a bar that lashes out of the body and draws back at its own pace and angle. All of it is unlit, and leans with the wind ----
const BAR = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // a unit bar standing on its base, scaled and tilted from there
const flame = (parent: THREE.Group, x: number, y: number, z: number) => {
  const f = new THREE.Group(), blaze = [0xfff6b0, LAVA, 0xff3b3b].map((c) => mat(c));
  const bar = (c: number) => { const m = new THREE.Mesh(BAR, blaze[c]); f.add(m); return m; };
  const core = [2, 1, 0].map(bar), tongues = Array.from({ length: 8 }, (_, i) => bar(i % 3 ? 1 : 2));
  tongues.forEach((m, i) => { // each springs from a flank of the body, leaning out
    const side = i & 1 ? 1 : -1;
    m.position.set(side * (0.03 + 0.01 * (i % 3)), 0.03 + 0.06 * (i % 4), 0); m.rotation.z = -side * (0.12 + 0.1 * (i % 4));
  });
  f.position.set(x, y, z); parent.add(f);
  f.userData.tick = (t: number) => {
    f.rotation.z = -(0.2 + 0.06 * Math.sin(t * 1.9) + 0.04 * Math.sin(t * 5.3)); // the wind, in gusts
    core.forEach((m, i) => m.scale.set([0.19, 0.13, 0.07][i], [0.36, 0.5, 0.34][i] * (0.84 + 0.1 * Math.sin(t * (9 + 3 * i) + i) + 0.06 * Math.sin(t * (23 + 7 * i))), 0.14 + 0.03 * i));
    tongues.forEach((m, i) => m.scale.set(0.045, (0.24 + 0.06 * ((i * 5) % 4)) * Math.sin(Math.PI * ((t / (0.9 + 0.07 * i) + i * 0.37) % 1)) ** 1.5, 0.08));
  };
  f.userData.tick(0);
};

// An oil company's site on a concrete pad: a derrick and its doghouse over a new well; a pumping unit at work on an old one, with a control cabinet whose faint green light blinks with every stroke; two storage
// tanks, joined by an oil header (which brings in the well's flow) and by a yellow vent line that runs on to the flare stack; barrels at the front. The pumping unit's linkage and the flame move (see `tick`).
export function oil(g: THREE.Group) {
  const [dx, dz] = [-0.68, -0.58], [ox, oz] = [0.34, 0.47], TZ = -0.7, HZ = -0.2, GY = 1.36, FX = 0.99, PY = 0.275; // the derrick, the pumping unit's pivot, the tanks' row, the header's row, the vent line's height, the flare's x, the oil pipes' axis (the wellhead's flow tee)
  const xw = ox + WELL;
  const strut = (p: THREE.Group, c: number, t: number, a: V3, b: V3) => { // a bar of section t from point a to point b
    const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), m = box(p, t, d.length(), t, c);
    m.position.set(...a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  };
  const run = (c: number, r: number, [x0, y0, z0]: V3, [x1, y1, z1]: V3) => { // a pipe of radius r between two points that differ along one axis
    const n = Math.abs(x1 - x0) + Math.abs(y1 - y0) + Math.abs(z1 - z0), m = cyl(g, r, n, c, (x0 + x1) / 2, (y0 + y1) / 2 - n / 2, (z0 + z1) / 2);
    if (x0 !== x1) m.rotation.z = Math.PI / 2; else if (z0 !== z1) m.rotation.x = Math.PI / 2;
  };
  const line = (c: number, r: number, ...p: V3[]) => p.forEach((q, i) => { // a pipe through the points, a joint block at each corner
    if (i) run(c, r, p[i - 1], q);
    if (i && i < p.length - 1) box(g, 2 * r + 0.02, 2 * r + 0.02, 2 * r + 0.02, LIGHT, q[0], q[1] - r - 0.01, q[2]);
  });
  const valve = (x: number, z: number) => { // a gate valve in an oil pipe: its body, the stem and a red handwheel (a disc, seen from above)
    box(g, 0.11, 0.09, 0.11, STEEL, x, PY - 0.045, z); box(g, 0.03, 0.09, 0.03, IRON, x, PY + 0.045, z); cyl(g, 0.06, 0.02, RED, x, PY + 0.13, z);
  };
  const tank = (x: number, h: number) => { // a storage tank on its concrete ring: red band, rim, stepped roof and vent, and the stair up its front to a landing on the roof
    cyl(g, 0.29, 0.05, CONC, x, 0.08, TZ); cyl(g, 0.25, h, WHITE, x, 0.13, TZ); cyl(g, 0.255, 0.12, RED, x, 0.13 + h * 0.4, TZ); cyl(g, 0.26, 0.04, LIGHT, x, 0.09 + h, TZ);
    cyl(g, 0.2, 0.05, 0x9aa5bd, x, 0.13 + h, TZ); cyl(g, 0.1, 0.05, 0x9aa5bd, x, 0.18 + h, TZ); cyl(g, 0.04, 0.06, DARK, x, 0.23 + h, TZ);
    strut(g, DARK, 0.045, [x + 0.2, 0.13, TZ + 0.17], [x - 0.14, 0.11 + h, TZ + 0.23]); box(g, 0.14, 0.03, 0.1, DARK, x - 0.14, 0.09 + h, TZ + 0.2);
  };

  box(g, 2.2, 0.08, 1.9, 0xb9b2a0, 0, 0, -0.05);                                                                         // site ground
  // The derrick over the new well
  for (const x of [-1, 1]) for (const z of [-1, 1]) strut(g, STEEL, 0.07, [dx + 0.36 * x, 0.08, dz + 0.36 * z], [dx + 0.08 * x, 3.58, dz + 0.08 * z]); // derrick: four legs leaning in
  for (let i = 0; i < 8; i++) {                                                                                          // a girth ring every 0.5 and, between two rings, a brace on each visible face
    const [a, b, y, s] = [0.36 - i * 0.04, 0.32 - i * 0.04, 0.08 + i * 0.5, i & 1 ? -1 : 1], L = 2 * a + 0.07;
    for (const [w, d, x, z] of [[L, 0.05, 0, a], [0.05, L, -a, 0], [0.05, L, a, 0]]) box(g, w, 0.05, d, STEEL, dx + x, y - 0.025, dz + z);
    if (i < 7) for (const [x0, z0, x1, z1] of [[-s * a, a, s * b, b], [a, -s * a, b, s * b], [-a, -s * a, -b, s * b]]) strut(g, STEEL, 0.04, [dx + x0, y, dz + z0], [dx + x1, y + 0.5, dz + z1]); // front, right, left
  }
  box(g, 0.66, 0.06, 0.66, 0x8a8fa3, dx, 0.4, dz);                                                                       // drill floor
  box(g, 0.07, 3.5, 0.07, DARK, dx, 0.08, dz); box(g, 0.2, 0.2, 0.2, RED, dx, 2.2, dz);                                   // drill pipe, travelling block
  box(g, 0.28, 0.14, 0.28, DARK, dx, 3.58, dz); box(g, 0.1, 0.1, 0.1, 0xff3b3b, dx, 3.72, dz);                            // crown block, beacon
  box(g, 0.22, 0.26, 0.26, 0xe8e8e8, -0.5, 0.08, -0.1); box(g, 0.28, 0.05, 0.32, RED, -0.5, 0.34, -0.1); box(g, 0.08, 0.1, 0.02, 0x7db6ff, -0.5, 0.2, 0.04); // doghouse: walls, roof, window

  // The tanks, the header that brings in the well's flow and feeds both, and the vent line over their roofs to the flare
  tank(0.02, 0.9); tank(0.58, 0.74);
  line(PIPE, 0.045, [xw, PY, oz - 0.06], [xw, PY, HZ], [0.02, PY, HZ], [0.02, PY, TZ + 0.25]); line(PIPE, 0.045, [0.58, PY, HZ], [0.58, PY, TZ + 0.25]); // flow line from the wellhead, the header, a branch into each tank
  box(g, 0.11, 0.11, 0.11, LIGHT, 0.58, PY - 0.055, HZ);                                                                 // the tee where the second branch leaves
  for (const [x, z] of [[0.02, -0.32], [0.58, -0.32], [0.3, HZ], [xw, 0.1]]) valve(x, z);                                // a valve in each branch, the header and the flow line
  for (const [x, z] of [[0.15, HZ], [0.45, HZ], [xw, 0.0], [xw, 0.28]]) box(g, 0.1, 0.15, 0.1, CONC, x, 0.08, z);          // sleepers under them
  line(YEL, 0.04, [0.02, 1.13, TZ], [0.02, GY, TZ], [FX - 0.05, GY, TZ]); line(YEL, 0.04, [0.58, 0.97, TZ], [0.58, GY, TZ]); // vent line: up from each roof vent, along over both, into the stack
  box(g, 0.1, 0.1, 0.1, LIGHT, 0.58, GY - 0.05, TZ); cyl(g, 0.07, 0.03, LIGHT, FX, GY - 0.015, TZ);                       // its tee over the second tank, the collar where it meets the stack

  // The flare stack, its flame leaning with the wind
  box(g, 0.24, 0.12, 0.24, 0x8a8fa3, FX, 0.08, TZ); cyl(g, 0.05, 2.38, IRON, FX, 0.2, TZ);                               // pedestal, pole
  for (const y of [0.8, 1.7]) cyl(g, 0.07, 0.04, STEEL, FX, y, TZ);                                                      // collars
  cyl(g, 0.13, 0.03, STEEL, FX, 2.3, TZ); cyl(g, 0.075, 0.2, DARK, FX, 2.55, TZ); cyl(g, 0.09, 0.04, STEEL, FX, 2.72, TZ); // top platform, nozzle, its rim
  flame(g, FX, 2.76, TZ);

  // The pumping unit (`unit`: what stands still, batched with the site) and what moves (`pump`: its own groups, see bake), both in the unit's frame
  const frame = () => { const u = new THREE.Group(); u.position.set(ox, 0.08, oz); g.add(u); return u; };
  const unit = frame(), pump = frame();
  box(unit, 1.58, 0.04, 0.58, CONC, -0.21, 0, 0);                                                                        // foundation
  for (const z of [-0.17, 0.17]) box(unit, 1.5, 0.05, 0.07, SKID, -0.2, 0.04, z);                                        // skid rails
  for (const u of [-0.9, -0.3, 0.1, 0.5]) box(unit, 0.07, 0.04, 0.4, SKID, u, 0.05, 0);                                   // ties
  box(unit, 0.3, 0.34, 0.2, BLUE, AXLE[0], 0.09, 0); box(unit, 0.18, 0.03, 0.12, 0x2d4aa8, AXLE[0], 0.43, 0);              // gearbox, its cover
  cyl(unit, 0.045, 0.34, STEEL, AXLE[0], AXLE[1] - 0.17, 0).rotation.x = Math.PI / 2;                                    // the output shaft, through to the cranks
  cyl(unit, 0.11, 0.34, 0x2f4fb0, -0.8, 0.05, 0).rotation.z = Math.PI / 2; cyl(unit, 0.115, 0.07, DARK, -0.935, 0.185, 0).rotation.z = Math.PI / 2; // motor, its fan cowl
  box(unit, 0.3, 0.03, 0.2, DARK, -0.8, 0.09, 0); box(unit, 0.08, 0.05, 0.08, STEEL, -0.8, 0.32, 0); cyl(unit, 0.03, 0.1, DARK, -0.59, 0.17, 0).rotation.z = Math.PI / 2; // its feet, terminal box, coupling to the gearbox
  for (const z of [-0.13, 0.13]) {                                                                                       // samson post: two A-frames, braced
    strut(unit, STEEL, 0.07, [0.2, 0.09, z], [0, POST - 0.1, z]); strut(unit, STEEL, 0.07, [-0.14, 0.09, z], [0, POST - 0.1, z]); box(unit, 0.3, 0.04, 0.05, STEEL, 0.03, 0.28, z);
  }
  box(unit, 0.14, 0.08, 0.34, SKID, 0, POST - 0.12, 0);                                                                  // the saddle bearing the beam rocks on
  cyl(unit, 0.15, 0.02, 0x14161f, WELL + 0.04, 0.04, 0.12); box(unit, 0.2, 0.03, 0.2, 0x8a8fa3, WELL, 0.04, 0); cyl(unit, 0.07, 0.08, STEEL, WELL, 0.07, 0); // wellhead: oil pool, flange, casing head
  box(unit, 0.12, 0.09, 0.12, IRON, WELL, 0.15, 0); cyl(unit, 0.055, 0.02, RED, WELL, 0.185, 0.075).rotation.x = Math.PI / 2;   // flow tee, its valve wheel
  cyl(unit, 0.05, 0.1, DARK, WELL, 0.24, 0); cyl(unit, 0.035, 0.03, STEEL, WELL, 0.34, 0);                                // stuffing box, gland
  box(unit, 0.3, 0.03, 0.22, CONC, -1.22, 0, -0.1); box(unit, 0.2, 0.3, 0.14, 0x8f97ad, -1.22, 0.03, -0.1); box(unit, 0.15, 0.2, 0.02, 0xaab2c8, -1.22, 0.08, -0.03); // control cabinet: plinth, body, door
  box(unit, 0.24, 0.03, 0.18, DARK, -1.22, 0.33, -0.1); box(unit, 0.06, 0.04, 0.01, YEL, -1.25, 0.24, -0.015);            // its roof, a caution plate

  const beam = body(pump, 0, POST, (b) => {
    box(b, 0.76, 0.08, 0.12, RED, -0.02, -0.04, 0); part(b, HEAD, 0, mat(RED), 0, 0, 0);                                 // the walking beam and the horsehead
    box(b, 0.05, 0.05, 0.4, DARK, -REAR, -0.025, 0);                                                                     // the equaliser bar at its rear end, where the pitman hangs
  });
  const crank = body(pump, AXLE[0], AXLE[1], (b) => {
    for (const z of [-0.125, 0.125]) { box(b, 0.34, 0.07, 0.04, DARK, 0.05, -0.035, z); box(b, 0.12, 0.16, 0.05, YEL, 0.17, -0.08, z); } // crank arms, each with its counterweight beyond the pin
    box(b, 0.05, 0.05, 0.42, DARK, PIN - 0.025, -0.025, 0);                                                              // the pin
  });
  const pitman = body(pump, 0, 0, (b) => { for (const z of [-0.165, 0.165]) box(b, 0.045, PITMAN + 0.04, 0.04, STEEL, 0, -0.02, z); }); // the two pitman arms, standing from the pin
  const rod = body(pump, WELL, MID, (b) => { box(b, 0.06, 0.04, 0.17, DARK, 0, -0.04, 0); box(b, 0.03, 0.55, 0.03, 0xe8ecf4, 0, -0.55, 0); }); // carrier bar, polished rod
  const cable = body(pump, WELL, POST, (b) => { for (const z of [-0.058, 0.058]) box(b, 0.025, 1, 0.025, INK, 0, -1, z); }); // the two cables from the horsehead: a unit long, stretched to length each frame
  const led = box(pump, 0.06, 0.06, 0.02, 0x35e07a, -1.17, 0.26, -0.01, LED); led.castShadow = false;                    // the indicator, on the cabinet door
  pump.userData.tick = (t: number) => {
    const phi = (2 * Math.PI * t) / STROKE, k = linkage(phi);
    beam.rotation.z = k.th; crank.rotation.z = phi;
    pitman.position.set(k.px, k.py, 0); pitman.rotation.z = Math.atan2(k.px - k.bx, k.by - k.py);
    rod.position.y = MID + FORE * k.th; cable.scale.y = POST - rod.position.y;
    LED.color.setHex(0x35e07a).multiplyScalar(0.12 + 0.43 * (0.5 + 0.5 * Math.cos(phi - 1.5 * Math.PI)) ** 4);            // faint, and up with the horsehead's top of stroke
  };
  pump.userData.tick(0);

  for (const [x, z, c] of [[-0.96, 0.8, RED], [-0.74, 0.84, BLUE], [-0.86, 0.66, YEL]]) { cyl(g, 0.1, 0.24, c, x, 0.08, z); cyl(g, 0.105, 0.02, LIGHT, x, 0.3, z); } // barrels, each with its lid rim
}
