import * as THREE from 'three';
import { box, box as solid, cyl, decal, final, glass, lamplit, memo, metal, part, rnd, sprite, stone, GOLD, INK, IRON, OFFICE, type ModelDef } from '../../builder';
import { canvas, hex, shade } from '../../art';
import { nightlit } from '../../light';
import { DENSITY, pixelTexture, toon } from '../../scene';

// What the skyline behind the statue shares (see `levels`): how far forward on its plot the island stands to leave it room, the height of the quay the towers stand on (the island's own seawall), the line of their centres on it and its granite
const FWD = 0.7, BANK = 0.24, Z = -0.8, GRANITE = 0xcfc8b6, STEEL = 0xe4eaf4, LIP = 0xf1eee4;
const px = (n: number) => n / DENSITY;                                                                                                                          // n texels in world units: the towers are drawn on the pixel grid, so that their sprites and their boxes agree
const steel = metal(STEEL, [0.35, 1, 0.4, 0]);                                                                                                                  // stainless steel, which throws the HD-2D light back (the crown of the Chrysler, the roof of One World Trade)
const around = (g: THREE.Group, x: number, z: number) => [0, 1, 2, 3].map((k) => { const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = (k * Math.PI) / 2; g.add(p); return p; }); // a tower's four sides: a frame for each, turned so that its side is the front (+z), to draw what the tower has on every side once
// A wall of the Chrysler Building as a sprite, w texels wide and h tall: strips of dark window a texel wide between white piers three wide (counted from the nearer edge, so that a wall is the same on both sides of its middle), a floor line across them every four rows
const wall = (w: number, h: number) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y > 0 && y < h - 1 && Math.min(x, w - 1 - x) % 4 === 3 ? (y % 4 ? 'O' : 'e') : 'x')).join(''));
const wallLamps = (w: number, h: number) => wall(w, h).map((row) => row.replace(/./g, (c) => (c === 'O' ? 'Y' : '.')));                                      // what of a wall is lit by night: the glass of its windows (not the floor lines between them)
// One arch of its crown as a sprite, w texels wide and h tall: a lit rim that bends down at both ends (the arch) over ribs of steel, the shade of the corners above it and of the foot, and between the ribs the dark triangles of the windows, bw texels
// wide at the foot, as tall as they are half as wide, a rib's texel between two of them; by night (`lamps`) the windows alone, lit
const arch = (w: number, h: number, bw: number, lamps = false) => {
  const k = (bw + 1) / 2, n = Math.floor((w - 1) / (bw + 1)), c = (j: number) => (w - 1) / 2 + (bw + 1) * (j - (n - 1) / 2);                                    // a window's height, how many there are, the middle of the one at j
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const d = y - (h - 1 - k), win = d >= 0 && d < k && [...Array(n).keys()].some((j) => Math.abs(x - c(j)) <= d);                                              // d: the row of a window, from its point
    const rim = Math.round(Math.min(h - 2, Math.ceil(w / 4)) * (1 - Math.sqrt(1 - ((2 * x + 1 - w) / w) ** 2)));                                                // the row of the rim at x: a quarter circle down to each end
    return lamps ? (win ? 'Y' : '.') : win ? 'O' : y < rim || y === h - 1 ? 'b' : y === rim ? 'w' : 'a';
  }).join(''));
};
// The tall arch its crown stands on, as a sprite, w texels wide and h tall: the tower's own wall (see `wall`) inside a rim of steel two texels thick, a semicircle over legs that run straight down to the foot, its outer edge lit, the shade of the corners above it;
// by night (`lamps`) the windows alone, lit
const bay = (w: number, h: number, lamps = false) => wall(w, h).map((row, y) => [...row].map((c, x) => {
  const d = Math.hypot(x + 0.5 - w / 2, Math.max(0, w / 2 - y - 0.5));                                                                                          // how far it is from the middle of the arch's curve (below the springing line, from its axis)
  return lamps ? (c === 'O' && d <= w / 2 - 2 ? 'Y' : '.') : d > w / 2 ? 'b' : d > w / 2 - 1 ? 'w' : d > w / 2 - 2 ? 'a' : c;
}).join(''));
const crown = memo((rows: string[], lamps: string[]) => toon(0xffffff, { map: sprite(rows), emissive: 0xffffff, emissiveMap: sprite(lamps) }, [0.4, 1, 0.3, 0.5])); // an arch's material: the steel by day and, after dusk, the lamps of its windows (the emissive map alone says what is lit, see `nightlit`)
const windows = memo((rows: string[], lamps: string[]) => toon(0xffffff, { map: sprite(rows), emissive: 0xffffff, emissiveMap: sprite(lamps) }));                    // a wall's material: the same without the steel's sheen, so that the brick keeps its day look
// What One World Trade Center is clad in: glass in floors of four rows (a light spandrel, the sky in the first pane under it, shade below, counted from the foot) with a lighter mullion every eight columns, drawn for each of the shaft's eight faces in turn, side by side (see `shaft`): a panel
// NW texels wide, the face W across at its foot with a column to spare at each side, and NH tall, which is the shaft's height. The night's drawing (the emissive map: what is lit) is a deep blue that fades towards the foot, a strip of lamps in every floor, the offices' warm ones low down and
// cooler, fuller floors higher up (the top ones are nearly all lit), and a pale line down each edge of a face, as the tower is outlined in light. A floor is lit a stretch at a time, never as one sheet (see `curtain`), from a hash of its place, so no two faces are alike
const W = 19, NH = 110, NW = W + 2, MID = (NW - 1) / 2, PANE = ['#c4d7ee', '#a9c7e8', '#86aad3', '#6f93c0'], COOL = [0xa8ccff, 0x6fa3ff, 0x6fa3ff, 0xd6e6ff];   // a face's width at its foot, the shaft's height, a panel's width and its middle column, the glass's four rows, the lamps of a cool floor: pale blue, blue (twice as often), ice
const clad = (night: boolean) => pixelTexture(canvas(8 * NW, NH, (g) => {
  const at = (c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); }, up = (y: number) => 1 - (y + 0.5) / NH;           // y counts down from the roof; up: how far up the shaft it is, 0 at the foot
  for (let i = 0; i < 8; i++) {                                                                                                                                 // face i: the upright ones are even, the leaning ones odd
    const o = i * NW;
    for (let y = 0; y < NH; y++) at(night ? shade(0x2f56c0, 0.1 + 0.5 * up(y)) : PANE[(y + NH) % 4], o, y, NW);                                                 // the night's blue, or the panes of the floors
    if (!night) { for (const x of [MID - 8, MID, MID + 8]) at('#cfe0f3', o + x, 0, 1, NH); continue; }                                                          // the mullions, one down the middle of the face
    for (let j = 0; 4 * j < NH; j++) {                                                                                                                          // the floors from the foot: three rows of glass over a spandrel
      const t = (4 * j + 2) / NH, p = t > 0.82 ? 0.95 : (0.45 + 0.4 * t) * (0.4 + rnd(i, j, 7)), y = NH - 3 - 4 * j;                                            // how far up it is, how likely a stretch of it is lit, the top of its glass
      for (let x = 1, len = 1; x < NW - 1; x += len + 1) {
        len = Math.min(1 + Math.floor(rnd(i, j, x) * 4), NW - 1 - x);
        if (rnd(i, j, x, 1) < p) { const c = rnd(i, j, x, 2) < t ? COOL : OFFICE, tone = c[Math.floor(rnd(i, j, x, 3) * c.length)]; at(hex(tone), o + x, y, len); at(shade(tone, 0.8), o + x, y + 1, len, 2); } // a lighter row over two darker ones, like any lit window
      }
    }
    for (let y = 0; y < NH; y++) { const e = Math.floor((W / 2) * (i % 2 ? up(y) / Math.SQRT2 : 1 - up(y))); for (const x of [MID - e, MID + e]) at('#9cc4ff', o + x, y); } // its two edges: an upright face narrows to a point, a leaning one widens from one
  }
}));
const GLASS = toon(0xffffff, { map: clad(false), emissive: 0xffffff, emissiveMap: clad(true) }, [0.5, 1, 0, 0.1]);
const led = nightlit(toon(STEEL, {}, [0.35, 1, 0.4, 0]), 0x9cc4ff, 0.6), mast = lamplit(LIP, 0xa8ccff, 0.8);                                                    // the steel of the drum and the cream of the mast, which shine pale blue after dusk (the top of the tower is lit)
// The shaft of One World Trade Center: a square antiprism h tall, a square base (half-width a) under a square turned an eighth of a turn above it, whose corners stand over the middles of the base's sides. Between them are eight triangles: four standing upright on the base's
// sides, point up, and four leaning in from the roof's edges over the base's corners, point down. Each is laid flat on a panel of the glass of its own (u along its level edge from the panel's middle, v up from its foot), so that a texel of the glass is a world texel
const shaft = memo((a: number, h: number) => {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), pos: number[] = [], uv: number[] = [], g = new THREE.BufferGeometry();
  let k = 0;                                                                                                                                                    // the face being laid out, which is also its panel of the glass
  const b = [V(a, 0, a), V(a, 0, -a), V(-a, 0, -a), V(-a, 0, a)], t = [V(a, h, 0), V(0, h, -a), V(-a, h, 0), V(0, h, a)];                                       // the base's corners and the roof's
  for (let i = 0; i < 4; i++) for (const f of [[b[i], b[(i + 1) % 4], t[i]], [b[(i + 1) % 4], t[i], t[(i + 1) % 4]]]) {                                         // the upright triangle on side i, the leaning one over the corner after it
    const n = f[1].clone().sub(f[0]).cross(f[2].clone().sub(f[0])), c = f[0].clone().add(f[1]).add(f[2]);
    if (n.dot(V(c.x, 0, c.z)) < 0) { f.reverse(); n.negate(); }                                                                                                 // wound outward
    const u = V(n.z, 0, -n.x).normalize();                                                                                                                      // level along the face
    for (const p of f) { pos.push(p.x, p.y, p.z); uv.push((k * NW + NW / 2 + (p.x * u.x + p.z * u.z) * DENSITY) / (8 * NW), p.y / h); }                         // along the panel from its middle, up it from its foot
    k++;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
});

export default {
  key: 'New York',
  lamps: [{ at: [0, 1.3, 1.15], color: 0xffc878, power: 3.2, reach: 6.5, final: true }], // the floodlights of Liberty Island, in front of the statue's pedestal
  props: [ // Statue of Liberty: a verdigris copper figure on a granite pedestal inside the eleven-pointed star of Fort Wood on Liberty Island, torch raised in one hand and the tablet in the other under a crown of seven rays; trees and the Stars and Stripes on the lawn, a Staten Island ferry in the harbour; the island stands forward on its plot, which leaves the back for the skyline of the upgrades
    final((r) => {
      const g = new THREE.Group(); g.position.z = FWD; r.add(g);                                                                                                // the island stands FWD forward on its plot, which leaves its back for the two towers that rise behind it
      const [SX, SZ, FY, P] = [0, -0.38, 0.46, 2.04];                                                                                                           // the monument's centre line, the top of Fort Wood, the top of the pedestal (the plinth she stands on)
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, GRASS = 0x4f9d4f, WALL = 0xcfc8b6, PATH = 0xdba596, FORT = 0xb4ab95, GR = 0xcbc3ae, GRL = 0xded8c6, GRD = 0xa9a08a, DARK = 0x3f392e;  // paints: sea, foam, lawn, seawall, the pink promenade, fort stone, granite in three tones, the loggia's shade
      const WOOD = 0x6e3a12, WHITE = 0xf4f6fa, NAVY = 0x1a2250, ORANGE = 0xf26b1d;                                                                              // trunks, the ferry's white paint, its windows, its orange
      const PAT = 0x5cc6a6, PATL = 0x8fe4cc, PATD = 0x419e83, PATDD = 0x2d7662, DGOLD = 0xe0a020;                                                               // the statue's verdigris in four tones, the flame's darker gold
      const VERDIGRIS = [PAT, PATL, PATD, PATDD], box: typeof solid = (g, w, h, d, c, x, y, z, m) => solid(g, w, h, d, c, x, y, z, m ?? (VERDIGRIS.includes(c as number) ? lamplit(c as number, c as number, 0.5) : undefined)); // from here on her verdigris is floodlit by night, as the Merlion is (see singapore.ts)
      const rod = (x: number, y: number, len: number, a: number, w: number, c: number, z = SZ, d = w) => { box(g, w, len, d, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, z).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; };  // a bar standing on (x, y), len long, tipped over by a (to the viewer's left when positive); returns its tip
      const Y = (h: number) => P + h;                                                                                                                                   // a height above the plinth
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);                                                                           // the harbour, its shallows
      const isle = (r: number, h: number, c: number, y: number) => { cyl(g, r, h, c, SX, y, SZ + 0.08).scale.set(1.2, 1, 1); };                                                                 // a round slab of the island, wider than it is deep
      isle(0.95, 0.02, FOAM, 0.1); isle(0.9, 0.14, WALL, 0.1); isle(0.84, 0.03, PATH, 0.24); isle(0.78, 0.03, GRASS, 0.27);                                     // foam round the shore, the seawall, the pink promenade along it, the lawn
      const [N, D] = [11, 0.25];                                                                                                                                // Fort Wood's eleven bastions, each a diamond with this half-diagonal
      for (let k = 0; k < N; k++) { const a = (k * 2 * Math.PI) / N; stone(g, D * Math.SQRT2, 0.22, D * Math.SQRT2, FORT, SX + (0.8 - D) * Math.sin(a), 0.24, SZ + (0.8 - D) * Math.cos(a)).rotation.y = a + Math.PI / 4; }  // the star: a pointed bastion every 33 degrees
      cyl(g, 0.55, 0.22, FORT, SX, 0.24, SZ);                                                                                                                   // the keep inside it
      const ped = (m: typeof stone, w: number, h: number, y: number, c: number, d = w) => m(g, w, h, d, c, SX, y, SZ);                                                                                        // a course of the pedestal, on the monument's axis
      ped(stone, 1.06, 0.07, FY, GRL); ped(stone, 1, 0.07, FY + 0.07, GRL);                                                                                     // the stepped base
      ped(stone, 0.92, 0.32, 0.6, GR); ped(box, 0.99, 0.05, 0.92, GRL);                                                                                         // the lower plinth in rusticated granite, its cornice
      box(g, 0.16, 0.22, 0.02, DARK, SX, 0.62, SZ + 0.47); box(g, 0.22, 0.03, 0.03, GRL, SX, 0.84, SZ + 0.47);                                                  // the doorway and its lintel
      ped(stone, 0.84, 0.22, 0.97, GR); ped(box, 0.9, 0.05, 1.19, GRL);                                                                                         // the dado, a string course
      ped(box, 0.8, 0.46, 1.24, DARK);                                                                                                                          // the loggia: its dark back wall
      for (const s of [-1, 1]) stone(g, 0.12, 0.46, 0.84, GRD, SX + s * 0.34, 1.24, SZ);                                                                        // a rusticated pier at either end
      for (const x of [-0.24, -0.08, 0.08, 0.24]) box(g, 0.07, 0.46, 0.07, GRL, SX + x, 1.24, SZ + 0.41);                                                       // four columns across its front
      ped(box, 0.98, 0.07, 1.7, GRL); ped(box, 1.06, 0.05, 1.77, GR);                                                                                           // the cornice, the balcony slab
      box(g, 1.04, 0.1, 0.04, GRL, SX, 1.82, SZ + 0.51);                                                                                                        // the balustrade along the front
      for (const s of [-1, 1]) { box(g, 0.04, 0.1, 1, GRL, SX + s * 0.51, 1.82, SZ); box(g, 0.07, 0.14, 0.07, GRL, SX + s * 0.51, 1.82, SZ + 0.51); }           // along both sides, a post at each front corner
      ped(stone, 0.8, 0.16, 1.82, GR); ped(box, 0.76, 0.06, 1.98, PAT);                                                                                         // the plinth she stands on, its copper plate
      box(g, 0.14, 0.05, 0.2, PATD, SX + 0.1, P, SZ + 0.12); box(g, 0.14, 0.07, 0.2, PATD, SX - 0.12, P, SZ - 0.1);                                             // her feet, the right one raised behind
      box(g, 0.1, 0.02, 0.05, IRON, SX - 0.04, P, SZ + 0.24); box(g, 0.06, 0.02, 0.04, INK, SX + 0.04, P, SZ + 0.27);                                           // the broken chain at her feet
      box(g, 0.66, 0.1, 0.42, PATD, SX, P, SZ); box(g, 0.58, 0.9, 0.34, PATD, SX, Y(0.1), SZ);                                                                  // the hem of her robe, the skirt
      [[-0.29, 0.1, PAT, 0], [-0.19, 0.13, PATL, 0.03], [-0.06, 0.13, PAT, 0.05], [0.07, 0.12, PATD, 0.03], [0.19, 0.1, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.46, 0.04, c, SX + x + w / 2, Y(0.1), SZ + 0.17 + z));  // folds down the skirt
      [[-0.27, 0.12, PATL, 0.01], [-0.15, 0.14, PAT, 0.04], [-0.01, 0.14, PATD, 0.03], [0.13, 0.12, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.4, 0.04, c, SX + x + w / 2, Y(0.56), SZ + 0.17 + z));  // and over the hips
      box(g, 0.6, 0.3, 0.32, PAT, SX, Y(1), SZ); box(g, 0.52, 0.2, 0.3, PAT, SX - 0.03, Y(1.3), SZ); box(g, 0.36, 0.12, 0.28, PATL, SX - 0.02, Y(1.5), SZ);     // the bodice, narrowing to the shoulders
      rod(SX + 0.3, Y(0.55), 0.95, 0.58, 0.1, PATL, SZ + 0.2, 0.08); rod(SX + 0.14, Y(0.4), 0.8, 0.58, 0.07, PATD, SZ + 0.2, 0.06);                             // two long folds of the cloak across her body, one light, one dark
      box(g, 0.2, 0.36, 0.28, PAT, SX - 0.25, Y(1.4), SZ); box(g, 0.08, 0.5, 0.2, PATL, SX - 0.3, Y(1), SZ + 0.04);                                             // the shoulder under the raised arm, the sleeve's fold hanging down its outside
      const HX = SX - 0.015;                                                                                                                                    // the head's centre line
      box(g, 0.1, 0.16, 0.1, PATL, HX, Y(1.56), SZ);                                                                                                            // the neck
      box(g, 0.18, 0.2, 0.15, PATL, HX, Y(1.7), SZ); box(g, 0.22, 0.26, 0.1, PATD, HX, Y(1.66), SZ - 0.09);                                                     // the face, the hair behind it
      for (const s of [-1, 1]) box(g, 0.05, 0.22, 0.07, PATD, HX + s * 0.12, Y(1.5), SZ);                                                                       // a lock of hair down to either shoulder
      box(g, 0.25, 0.09, 0.19, PATD, HX, Y(1.9), SZ - 0.01);                                                                                                    // the diadem
      [-0.06, 0, 0.06].forEach((x) => box(g, 0.03, 0.05, 0.012, PATDD, HX + x, Y(1.92), SZ + 0.086));                                                           // its windows
      box(g, 0.14, 0.025, 0.012, PATDD, HX, Y(1.82), SZ + 0.076); box(g, 0.035, 0.08, 0.03, PAT, HX, Y(1.74), SZ + 0.085); box(g, 0.07, 0.015, 0.012, PATDD, HX, Y(1.72), SZ + 0.076);  // her stern brow, nose and mouth
      for (const s of [-1, 1]) box(g, 0.03, 0.025, 0.012, PATDD, HX + s * 0.04, Y(1.78), SZ + 0.076);                                                           // the deep-set eyes
      [90, 60, 30, 0, -30, -60, -90].forEach((d) => { const a = (d * Math.PI) / 180; rod(HX - 0.075 * Math.sin(a), Y(1.93) + 0.075 * Math.cos(a), 0.14, a, 0.05, PATL); });  // the seven rays of the crown, fanned out through half a circle
      const [hx] = rod(SX - 0.26, Y(1.65), 0.55, 0.05, 0.1, PAT, SZ + 0.01, 0.12);                                                                              // the raised arm, a hair off the vertical; hx: the torch's centre line
      box(g, 0.13, 0.2, 0.12, PATL, hx, Y(2.12), SZ + 0.02); box(g, 0.07, 0.4, 0.07, PATD, hx, Y(2.1), SZ); box(g, 0.1, 0.035, 0.1, PATDD, hx, Y(2.34), SZ);    // her hand, the torch's handle through it, a collar above the fist
      cyl(g, 0.075, 0.04, PATDD, hx, Y(2.4), SZ); cyl(g, 0.115, 0.035, PATD, hx, Y(2.44), SZ); cyl(g, 0.105, 0.05, PATL, hx, Y(2.475), SZ);                     // the gallery: its bowl, the platter, the railing
      [[0.12, 0.06, DGOLD], [0.14, 0.07, GOLD], [0.1, 0.07, GOLD], [0.06, 0.05, 0xfff6b0]].reduce((y, [w, h, c], i) => { box(g, w, h, w, c, hx + i * 0.01, y, SZ); return y + h; }, Y(2.525));  // the gilded flame, leaning a little, pale at its tip
      rod(SX + 0.27, Y(0.95), 0.62, 0.25, 0.15, PAT, SZ + 0.03, 0.2); box(g, 0.14, 0.1, 0.18, PATD, SX + 0.29, Y(0.9), SZ + 0.04);                              // the other arm, sloping out from the shoulder to the elbow, the cloth gathered there
      box(g, 0.22, 0.4, 0.05, PATD, SX + 0.4, Y(0.98), SZ + 0.2).rotation.z = -0.4; box(g, 0.16, 0.32, 0.03, PATL, SX + 0.4, Y(1.02), SZ + 0.225).rotation.z = -0.4;  // the tablet, tipped outward: its frame, its face
      box(g, 0.08, 0.1, 0.08, PATL, SX + 0.47, Y(1.05), SZ + 0.2);                                                                                              // her hand on its edge
      const fx = 0.72;                                                                                                                                          // the ferry's centre
      box(g, 0.7, 0.1, 0.22, ORANGE, fx, 0.1, 0.74); box(g, 0.72, 0.03, 0.225, INK, fx, 0.1, 0.74); box(g, 0.1, 0.1, 0.16, ORANGE, fx + 0.38, 0.1, 0.74);       // the Staten Island ferry: its orange hull, the dark waterline, the narrow bow
      box(g, 0.58, 0.1, 0.19, WHITE, fx - 0.03, 0.2, 0.74); box(g, 0.52, 0.04, 0.02, NAVY, fx - 0.03, 0.23, 0.84, glass(NAVY)); // the main deck and its windows
      box(g, 0.42, 0.09, 0.16, WHITE, fx - 0.05, 0.3, 0.74); box(g, 0.36, 0.035, 0.02, NAVY, fx - 0.05, 0.33, 0.82, glass(NAVY)); box(g, 0.46, 0.025, 0.18, ORANGE, fx - 0.05, 0.39, 0.74); // the upper deck, its windows, the orange roof
      box(g, 0.16, 0.09, 0.12, WHITE, fx + 0.2, 0.3, 0.74); box(g, 0.12, 0.04, 0.02, NAVY, fx + 0.2, 0.33, 0.8, glass(NAVY)); // the wheelhouse and its glass
      box(g, 0.1, 0.22, 0.1, ORANGE, fx - 0.18, 0.415, 0.74); box(g, 0.105, 0.03, 0.105, INK, fx - 0.18, 0.635, 0.74);                                          // the funnel, its black cap
      box(g, 0.76, 0.012, 0.03, FOAM, fx, 0.1, 0.86); box(g, 0.08, 0.012, 0.22, FOAM, fx + 0.45, 0.1, 0.74);                                                    // foam along the hull and at the bow
      [[-1, -0.2], [1, -0.2], [-0.86, 0.22]].forEach(([x, z]) => { box(g, 0.05, 0.2, 0.05, WOOD, x, 0.27, z); cyl(g, 0.15, 0.12, 0x2f7a4a, x, 0.42, z); cyl(g, 0.12, 0.11, 0x3f9a5c, x, 0.52, z); cyl(g, 0.07, 0.09, 0x4fb06a, x, 0.61, z); });  // three trees on the island: a trunk and three tiers of leaves
      box(g, 0.03, 0.9, 0.03, 0xdddddd, 0.62, 0.3, 0.3); box(g, 0.05, 0.05, 0.05, GOLD, 0.62, 1.2, 0.3); decal(g, ['uuurrrr', 'uuuwwww', 'rrrrrrr', 'wwwwwww'], 0.8, 1, 0.31);  // the Stars and Stripes on its mast: a blue canton over the stripes
      [[-0.9, 0.78], [-0.4, 0.9], [0.1, 0.93]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                                            // ripples on the harbour
    }),
  ],
  levels: [ // the statue stands at every level; each upgrade raises a skyscraper behind it, taller than she is, on a stretch of quay of its own
    [ // Lv 1, the Chrysler Building behind the statue on the left: a cream brick tower in three masses, strips of dark windows between white piers, an eagle of steel at each corner of the last, and over it the crown: a tall arch that carries the last mass's wall up inside a rim of steel, then six arches of stainless steel, each a texel narrower on every side than the one below, with a lit rim, a row of triangular windows and a shade under it, and a needle on its tip (after dusk its windows shine, those of the shaft and those of the arches)
      final((g) => {
        const X = -0.6, CREAM = 0xe9e2cc, AH = 20;                                                                                                              // the tower's centre line, its brick, the height of the crown's tall arch in texels (23 is the most that keeps the Chrysler under One World Trade's mast)
        const sides = around(g, X, Z), [front, ...others] = sides;
        let y = BANK;
        const face = (w: number, rows: string[], lamps?: string[], m = crown) => { const d = decal(front, rows, 0, y, px(w) / 2 + 0.02); if (lamps) d.material = m(rows, lamps); others.forEach((p) => p.add(d.clone())); }; // a sprite on each of the four faces of the w texels wide mass that starts at y, lit after dusk where `lamps` says, in the steel's material (`crown`) or the brick's (`windows`) (the copies share its material: one draw call)
        stone(g, 1.2, BANK, 1.1, GRANITE, X, 0, Z);                                                                                                             // its stretch of quay
        for (const [w, h, lip] of [[23, 12, 1], [19, 50, 1], [15, 30, 0]]) {                                                                                    // the shaft in three masses, w texels wide and h tall, the first two under a cornice
          box(g, px(w), px(h), px(w), CREAM, X, y, Z); face(w, wall(w, h), wallLamps(w, h), windows);
          y += px(h); if (lip) { box(g, px(w + 2), px(1), px(w + 2), LIP, X, y, Z); y += px(1); }
        }
        sides.forEach((p) => box(p, px(2), px(2), px(3), STEEL, px(8.5), y - px(2), px(8.5), steel).rotation.y = Math.PI / 4);                                  // an eagle at each corner of the last mass, its head out over the street
        box(g, px(15), px(AH), px(15), STEEL, X, y, Z, steel); face(15, bay(15, AH), bay(15, AH, true)); y += px(AH);                                           // the crown's lowest arch, taller than it is wide: the last mass's wall carried up inside a rim of steel
        for (const [w, h, bw] of [[13, 6, 5], [11, 5, 3], [9, 5, 3], [7, 4, 3], [5, 4, 3], [3, 3, 1]]) { box(g, px(w), px(h), px(w), STEEL, X, y, Z, steel); face(w, arch(w, h, bw), arch(w, h, bw, true)); y += px(h); } // the crown, an arch at a time: its mass, its face
        box(g, px(1), px(16), px(1), STEEL, X, y, Z, steel);                                                                                                    // the needle
      }),
    ],
    [ // Lv 2, One World Trade Center behind the statue on the right: a podium of dark glass under a shaft of blue glass that tapers in eight triangles, four standing on its sides and four leaning in over its corners, to a roof turned an eighth of a turn from its base, with a drum on it and a tall mast, a red light on its tip, the highest thing on the plot (after dusk the glass is lit floor by floor and along its edges, and the drum and the mast shine)
      final((g) => {
        const X = 0.6, A = px(W) / 2, H = px(NH), SLATE = 0x56688a;                                                                                             // the tower's centre line and half its width, the height of the shaft; the podium's glass
        let y = BANK;
        stone(g, 1.2, BANK, 1.1, GRANITE, X, 0, Z);                                                                                                             // its stretch of quay
        box(g, 2 * A, px(15), 2 * A, SLATE, X, y, Z, glass(SLATE)); y += px(15); box(g, 2 * A + px(2), px(1), 2 * A + px(2), LIP, X, y, Z); y += px(1); // the podium, its cornice
        part(g, shaft(A, H), 0, GLASS, X, y, Z); y += H;                                                                                                        // the shaft
        box(g, A * Math.SQRT2 + px(1), px(1), A * Math.SQRT2 + px(1), STEEL, X, y, Z, steel).rotation.y = Math.PI / 4; y += px(1);                              // the roof, turned to the shaft's top
        cyl(g, 0.16, 0.1, STEEL, X, y, Z).material = led; y += 0.1;                                                                                             // the drum on it
        box(g, px(3), 0.35, px(3), LIP, X, y, Z, mast); box(g, px(1), 1, px(1), LIP, X, y + 0.35, Z, mast); box(g, px(2), px(2), px(2), 0xff3b3b, X, y + 1.35, Z); // the mast: a thick stem, a thin tip, the red light on it
      }),
    ],
  ],
} satisfies ModelDef;
