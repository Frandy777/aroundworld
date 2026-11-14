import * as THREE from 'three';
import { bake, box, cyl, hip, mat, part, GOLD, INK, IRON, LAVA } from './builder';
import { hd } from './light';
import { movers } from './scene';

// Life on the water, kept clear of the board: an islet in each corner room of the loop (a climate each: palms, a lighthouse, an ice floe, a pagoda) and a bigger one on each side (a volcano,
// a village), three ships on lanes round the board and one round the drum (the sea draws their wakes, see world), and a dolphin that now and then leaps by the drum. On the far islets the windmill's sails turn and the volcano smokes. All of it is low and
// slow, so the board and the globe stay what the eye goes to, and nothing stands tall enough to hide a tile.
const SEA = -0.8; // the water's height
const WHITE = 0xf4f6fa, RED = 0xd9423e, BLUE = 0x2447a8, NAVY = 0x1a2250, WOOD = 0x6e3a12, CREAM = 0xf0e6c8, LEAF = [0x2f7a4a, 0x3f9a5c, 0x4fb06a];

// ---- Islets [x, z, radius]: one in the middle of each corner room (18 x 24 units of water), and a bigger one out on each side, where a wide window shows more sea than board.
// The sea washes against them like against the slabs, see world ----
export const ISLETS: [number, number, number][] = [[-33, -30, 4], [33, -30, 4], [-33, 30, 4], [33, 30, 4], [-82, -8, 7], [82, 10, 7]];
const disc = (g: THREE.Group, r: number, y0: number, y1: number, color: number, x = 0, z = 0) => part(g, new THREE.CylinderGeometry(r, r, y1 - y0, 64), y1 - y0, mat(color), x, y0, z); // a round slab from y0 up to y1, as finely cut as the drum (fewer sides leave dark slivers where the sun grazes the wall)
const palm = (g: THREE.Group, x: number, z: number, h: number, lean: number) => { // four leaning sections of trunk under a crown of eight drooping fronds, standing on the grass (y = -0.1)
  for (let i = 0; i < 4; i++) box(g, 0.24 - i * 0.03, h / 4, 0.24 - i * 0.03, WOOD, x + lean * i * 0.12, -0.1 + (i * h) / 4, z);
  const cx = x + lean * 0.42, cy = h - 0.1;
  box(g, 0.4, 0.22, 0.4, LEAF[0], cx, cy - 0.1, z);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, s = k & 1 ? 0.75 : 1; // the diagonal fronds are shorter
    for (const [d, dy, l, c] of [[0.5, 0, 0.7, LEAF[1]], [1, -0.12, 0.5, LEAF[2]]]) box(g, l * s, 0.08, 0.28, c, cx + Math.cos(a) * d * s, cy + dy, z + Math.sin(a) * d * s).rotation.y = -a;
  }
};
const penguin = (g: THREE.Group, x: number, z: number) => { // facing the camera: black back and flippers, a white front, an orange beak
  box(g, 0.3, 0.5, 0.24, INK, x, -0.1, z); box(g, 0.2, 0.34, 0.03, WHITE, x, -0.06, z + 0.13); box(g, 0.1, 0.05, 0.08, 0xff8a1f, x, 0.26, z + 0.15);
  for (const s of [-1, 1]) box(g, 0.06, 0.28, 0.14, INK, x + s * 0.18, 0, z);
};
const BUILD: ((g: THREE.Group, r: number) => void)[] = [
  (g, r) => { // palms: a beach, a grass top, three palms, two rocks
    disc(g, r, -1.1, -0.4, 0xe8d28c); disc(g, r - 1.1, -0.4, -0.1, 0x58b86a, 0.3);
    [[0.9, 0.2, 2.6, 1], [-1, -0.7, 2.2, -1], [0.1, -1.3, 2, 1]].forEach(([x, z, h, lean]) => palm(g, x, z, h, lean));
    box(g, 0.8, 0.4, 0.6, 0x8a857a, 2.6, -0.4, 2.2); box(g, 0.5, 0.3, 0.45, 0x6b6d72, -2.7, -0.4, 1.9);
  },
  (g, r) => { // lighthouse: a rock with a grassy shore, a tower tapering in white and red bands, a glowing lantern (unlit) under a red cap, its door and three boulders on the shore
    disc(g, r, -1.1, -0.4, 0x8a857a); disc(g, r - 0.4, -0.4, -0.2, 0x5f9a5e); disc(g, r - 1.2, -0.2, 0.5, 0x6b6d72, 0.3);
    let y = 0.5;
    [[1.3, WHITE], [1.15, RED], [1, WHITE], [0.85, RED]].forEach(([w, c]) => { box(g, w, 0.6, w, c, 0.3, y); y += 0.6; });
    box(g, 1.1, 0.1, 1.1, INK, 0.3, y); box(g, 0.7, 0.55, 0.7, 0xfff6b0, 0.3, y + 0.1); hip(g, 1.05, 1.05, 0.45, y + 0.65, RED, 0.3); box(g, 0.08, 0.3, 0.08, GOLD, 0.3, y + 1.05);
    box(g, 0.24, 0.4, 0.04, WOOD, 0.3, 0.5, 0.67);
    box(g, 0.9, 0.35, 0.7, 0x6b6d72, -3.1, -0.2, 0.8); box(g, 0.5, 0.3, 0.5, 0x8a857a, 2.9, -0.2, 1.9); box(g, 0.6, 0.4, 0.5, 0x6b6d72, 0.8, -0.2, 3);
  },
  (g, r) => { // ice floe: ice under snow, two blocks of ice, an igloo and three penguins
    disc(g, r, -1.1, -0.4, 0xb9dcee); disc(g, r - 0.8, -0.4, -0.1, 0xe8f6ff, 0.2);
    box(g, 1.1, 1.1, 0.9, 0xbfe4f4, -1.4, -0.1, -1); box(g, 0.6, 1.9, 0.6, 0xd6eef9, -1.2, -0.1, -1.5);
    [0.9, 0.7, 0.5, 0.3].forEach((c, i) => cyl(g, c, 0.22, WHITE, 1.2, -0.1 + i * 0.22, -0.8)); box(g, 0.34, 0.3, 0.1, INK, 1.2, -0.1, 0.1);
    [[0.2, 1], [1, 1.4], [-0.5, 1.6]].forEach(([x, z]) => penguin(g, x, z));
  },
  (g, r) => { // pagoda: a stone islet with a garden, a pagoda of three tiers (cream walls under red hip roofs, each tier sunk into the roof below), a torii gate to the side (two posts, two beams, a black cap) and a pine
    disc(g, r, -1.1, -0.4, 0x9aa5bd); disc(g, r - 0.9, -0.4, -0.1, 0x6fae6a);
    box(g, 2.2, 0.2, 2.2, 0xb4bccf, 0, -0.1);
    let y = 0.1;
    [1.5, 1.2, 0.9].forEach((w) => { box(g, w, 0.7, w, CREAM, 0, y); hip(g, w + 0.6, w + 0.6, 0.45, y + 0.7, RED); y += 0.88; });
    box(g, 0.08, 0.7, 0.08, GOLD, 0, y + 0.1);
    for (const s of [-1, 1]) box(g, 0.12, 1.4, 0.12, RED, 1.9 + s * 0.6, -0.1, 1.5);
    box(g, 1.7, 0.12, 0.16, RED, 1.9, 1.15, 1.5); box(g, 1.4, 0.1, 0.12, RED, 1.9, 0.85, 1.5); box(g, 2, 0.1, 0.22, INK, 1.9, 1.27, 1.5);
    box(g, 0.14, 0.5, 0.14, WOOD, -2, -0.1, -0.9); [0.55, 0.42, 0.28].forEach((c, i) => cyl(g, c, 0.28, LEAF[i], -2, 0.4 + i * 0.26, -0.9));
  },
  (g, r) => { // volcano: dark sand and grass round one smooth cone of dark rock that steepens as it climbs (turned from FLANK, the side from the foot to the lip, then down into the crater), a pool of lava (unlit) in the crater with a hot core, three streams of lava down the side, two palms (the smoke over it is made apart, see Moving)
    const FLANK: [number, number][] = [[4.3, -0.1], [3.6, 0.5], [3, 1.25], [2.45, 2.1], [1.95, 3], [1.55, 3.9], [1.45, 4.02]]; // [radius, height]
    disc(g, r, -1.1, -0.4, 0x6e6a72); disc(g, r - 1, -0.4, -0.1, 0x4f8a52);
    part(g, new THREE.LatheGeometry([...FLANK, [1.1, 4.02], [0.95, 3.4], [0, 3.4]].map(([x, y]) => new THREE.Vector2(x, y)), 64), 0, mat(0x5b5562), 0, 0, 0);
    disc(g, 1.05, 3.4, 3.46, LAVA); disc(g, 0.55, 3.46, 3.5, 0xfff6b0);
    [[-0.85, 5, 0.1], [-2.45, 4, -0.1], [1.7, 3, 0.1]].forEach(([a, n, z]) => { // a stream from the lip down each of three sides: its bearing, its plates, how far it wanders to either side
      const s = new THREE.Group();
      for (let i = 0; i < n; i++) { // plates laid along the side just off the rock, wider and knocked to the other side of the one above as they go down; the last has cooled to red
        const [ru, yu] = FLANK[6 - i], [rl, yl] = FLANK[5 - i], th = Math.atan2(yu - yl, rl - ru); // th: how steep this stretch of the side is
        box(s, Math.hypot(rl - ru, yu - yl) + 0.05, 0.05, 0.28 + 0.07 * i, i < n - 1 ? LAVA : 0xff3b3b, (ru + rl) / 2 + 0.07 * Math.sin(th), (yu + yl) / 2 + 0.07 * Math.cos(th) - 0.025, i & 1 ? -z : z).rotation.z = -th;
      }
      s.rotation.y = a;
      g.add(s);
    });
    palm(g, 4.4, 1.6, 2.4, 1); palm(g, -4.2, 2.4, 2.1, -1);
  },
  (g, r) => { // village: a windmill with a hub on the front (its sails are made apart, see Moving), two houses with doors, a pier and two palms
    disc(g, r, -1.1, -0.4, 0xe8d28c); disc(g, r - 1, -0.4, -0.1, 0x7cc15a);
    [1.9, 1.7, 1.5, 1.3].forEach((w, i) => box(g, w, 0.8, w, i & 1 ? WHITE : CREAM, -1.5, -0.1 + i * 0.8, -0.5));
    hip(g, 1.7, 1.7, 0.8, 3.1, RED, -1.5, -0.5);
    box(g, 0.3, 0.3, 0.5, IRON, -1.5, 2.35, 0.3);
    [[2.2, -0.2, 1.5, 1.2, CREAM, BLUE], [1.8, 2.2, 1.2, 1.1, 0xf4d7a8, RED]].forEach(([x, z, w, d, wall, roof]) => { box(g, w, 0.9, d, wall, x, -0.1, z); hip(g, w + 0.4, d + 0.4, 0.7, 0.8, roof, x, z); box(g, 0.3, 0.5, 0.04, WOOD, x, -0.1, z + d / 2 + 0.02); });
    box(g, 0.6, 0.12, 3.6, 0x8a5a2b, -3, -0.48, 5.4);
    palm(g, 3.8, -3, 2.4, 1); palm(g, -4.4, 2.2, 2.1, -1);
  },
];
const isles = new THREE.Group();
ISLETS.forEach(([x, z, r], i) => { const g = new THREE.Group(); g.position.set(x, 0, z); BUILD[i](g, r); isles.add(g); });
bake(isles);

// ---- Lanes: closed loops, a square of half-side h with corners of radius r (r = h is a circle), walked clockwise as seen from above: [x, z, heading x, heading z] at distance s along it ----
const lane = (h: number, r: number) => {
  const side = 2 * (h - r), leg = side + (Math.PI * r) / 2;
  return (s: number): [number, number, number, number] => {
    s = ((s % (4 * leg)) + 4 * leg) % (4 * leg);
    let k = Math.floor(s / leg), u = s - k * leg, x = u - h + r, z = -h, dx = 1, dz = 0; // along the north side, heading east
    if (u > side) { const a = (u - side) / r; [x, z, dx, dz] = [h - r + r * Math.sin(a), -(h - r) - r * Math.cos(a), Math.cos(a), Math.sin(a)]; } // round the corner, into the east side
    for (; k > 0; k--) [x, z, dx, dz] = [-z, x, -dz, dx]; // the other three sides are this one turned a quarter at a time
    return [x, z, dx, dz];
  };
};
const ring = (h: number) => lane(h, h - 44); // round the board (its slabs reach 48): straight along each side, turning at the corners

// ---- Ships: built round the waterline (y = 0) with the bow to +x. What moves casts a shadow in HD-2D only (the restrained look does not draw the sun's map again for it: see `movers`), and is baked into a few meshes like the models on the tiles ----
const moving = (build: (g: THREE.Group) => void) => {
  const g = new THREE.Group();
  build(g);
  bake(g);
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = hd.on; movers.push(o); } }); // after the bake, which tells meshes apart by their shadow flags: all alike here
  return g;
};
const afloat = (build: (g: THREE.Group) => void, k = 1) => {
  const g = moving(build);
  g.rotation.order = 'YZX'; // the heading first, then pitch and roll along its own length
  g.scale.setScalar(k);
  return g;
};
const cargo = (g: THREE.Group) => { // a container ship: a bow in three steps, four bays of boxes, the white bridge and the funnel aft
  const BOX = [0x42b0d5, RED, 0xe0a020, WHITE, 0x3fa65a], HULL = 0x1a2c5a;
  [[4.2, 1.3, -0.4], [0.4, 1, 1.9], [0.3, 0.62, 2.25], [0.15, 0.28, 2.475]].forEach(([l, w, x]) => { box(g, l, 0.8, w, HULL, x, -0.3); box(g, l + 0.04, 0.17, w + 0.04, 0xb02a2a, x, -0.05); }); // the hull with a red band above the waterline
  box(g, 4.1, 0.05, 1.2, 0x6d7388, -0.4, 0.5);
  [[-1, 3], [-0.2, 3], [0.6, 3], [1.3, 2]].forEach(([x, n], k) => { for (let i = 0; i < n; i++) for (const s of [-1, 1]) box(g, 0.7, 0.34, 0.5, BOX[(k + i * 2 + (s > 0 ? 1 : 0)) % 5], x, 0.55 + i * 0.34, s * 0.29); });
  box(g, 0.8, 0.85, 1.1, WHITE, -2, 0.55); box(g, 0.04, 0.12, 0.9, HULL, -1.58, 1); for (const s of [-1, 1]) box(g, 0.6, 0.12, 0.04, HULL, -2, 1, s * 0.56); // the bridge and its windows
  box(g, 0.9, 0.08, 1.2, 0x6d7388, -2, 1.4); box(g, 0.3, 0.5, 0.36, RED, -2.15, 1.48); box(g, 0.32, 0.08, 0.38, INK, -2.15, 1.98); box(g, 0.05, 0.45, 0.05, IRON, -1.8, 1.48); // roof, funnel and its cap, mast
};
const sloop = (stripe: number, sail: number) => (g: THREE.Group) => { // a white hull with a coloured stripe, a cabin, and a mast under a stepped mainsail and jib
  box(g, 2, 0.45, 0.8, WHITE, -0.2, -0.25); box(g, 0.35, 0.45, 0.54, WHITE, 0.975, -0.25); box(g, 0.2, 0.45, 0.26, WHITE, 1.25, -0.25); box(g, 0.2, 0.45, 0.62, WHITE, -1.3, -0.25); // hull, bow in two steps, stern
  box(g, 2.04, 0.1, 0.84, stripe, -0.2, 0); box(g, 1.9, 0.04, 0.7, 0xb88a4a, -0.2, 0.2); box(g, 0.7, 0.2, 0.46, CREAM, -0.45, 0.24); box(g, 0.5, 0.06, 0.48, NAVY, -0.45, 0.32);
  box(g, 0.06, 2.6, 0.06, 0xcfd6e6, 0.15, 0.24); box(g, 1.3, 0.05, 0.06, WOOD, -0.5, 0.5); box(g, 0.24, 0.1, 0.03, RED, 0.28, 2.7); // mast, boom, pennant
  [1.2, 0.98, 0.76, 0.54, 0.32].forEach((l, i) => box(g, l, 0.42, 0.05, sail, 0.1 - l / 2, 0.55 + i * 0.42)); // mainsail, abaft the mast
  [1, 0.76, 0.52, 0.28].forEach((l, i) => box(g, l, 0.5, 0.04, sail, 0.2 + l / 2, 0.45 + i * 0.5)); // jib, between the mast and the forestay
};
const trawler = (g: THREE.Group) => { // a blue hull with a white rail, a wheelhouse under a red roof, a mast with a boom that holds two nets out, crates on the foredeck
  [[1.6, 0.8, -0.2], [0.3, 0.6, 0.75], [0.2, 0.3, 1], [0.2, 0.66, -1.1]].forEach(([l, w, x]) => box(g, l, 0.6, w, 0x2d6fb0, x, -0.3));
  box(g, 1.64, 0.08, 0.84, RED, -0.2, 0); box(g, 1.64, 0.08, 0.84, WHITE, -0.2, 0.3);
  box(g, 0.6, 0.5, 0.56, WHITE, -0.55, 0.38); box(g, 0.7, 0.07, 0.66, RED, -0.55, 0.88); box(g, 0.04, 0.14, 0.4, NAVY, -0.24, 0.62); for (const s of [-1, 1]) box(g, 0.4, 0.14, 0.04, NAVY, -0.55, 0.62, s * 0.29);
  box(g, 0.05, 1.3, 0.05, IRON, 0.35, 0.38); box(g, 0.05, 0.05, 1.5, IRON, 0.35, 1); box(g, 0.1, 0.1, 0.1, 0xfff6b0, 0.35, 1.68); for (const s of [-1, 1]) box(g, 0.03, 0.6, 0.3, 0x7a8aa0, 0.35, 0.4, s * 0.6);
  box(g, 0.3, 0.22, 0.3, 0xe0a020, 0.55, 0.38, 0.14); box(g, 0.3, 0.22, 0.3, RED, 0.5, 0.38, -0.2);
};
// Each ship on its lane: where it is (distance along, in units) and its speed (negative: the other way round); `stern` is how far behind its middle the wake starts. Lanes a few units apart, so none meets another.
const fleet = [
  { g: afloat(cargo), lane: ring(58.5), s: 50, v: 1.1, stern: 2.5 },
  { g: afloat(trawler), lane: ring(56), s: 170, v: 1.5, stern: 1.2 },
  { g: afloat(sloop(BLUE, 0xf6f0dc)), lane: ring(61), s: 300, v: -1.7, stern: 1.4 },
  { g: afloat(sloop(RED, RED), 0.8), lane: lane(12.5, 12.5), s: 10, v: -1.2, stern: 1.1 }, // the small one sails round the drum
];
export const WAKES = fleet.map(() => new THREE.Vector4()); // for the sea: each ship's stern, and its heading
export const SPLASH = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1)]; // for the sea: where the dolphin left and re-entered the water, and how far its ring has spread (0 .. 1, else none)

// ---- The dolphin: it leaps along a circle round the drum, between the drum and the small ship's lane, and a ring of foam spreads from where it left the water and where it comes back ----
const dolphin = afloat((g) => { // nose to +x
  const GREY = 0x6d8fb5;
  [[0.3, 0.12, 0.12, 1.05], [0.4, 0.26, 0.24, 0.75], [0.8, 0.36, 0.32, 0.2], [0.5, 0.28, 0.22, -0.4], [0.34, 0.18, 0.14, -0.78]].forEach(([l, h, w, x]) => box(g, l, h, w, GREY, x, -h / 2)); // snout, head, body, rear, tail
  box(g, 0.9, 0.1, 0.34, 0xe4eef6, 0.1, -0.2); box(g, 0.12, 0.04, 0.5, GREY, -1, 0); box(g, 0.22, 0.14, 0.04, GREY, 0, 0.18); box(g, 0.14, 0.1, 0.04, GREY, -0.06, 0.32); // pale belly, flukes, dorsal fin in two steps
  for (const s of [-1, 1]) { box(g, 0.24, 0.04, 0.14, GREY, 0.5, -0.2, s * 0.22); box(g, 0.05, 0.05, 0.02, INK, 0.8, 0.04, s * 0.125); } // flippers, eyes
});
dolphin.visible = false;
const HOP = 1.4, HALF = 2.6, PEAK = 2.6; // seconds in the air, half the length of a leap, how high it rises (units)
const from = new THREE.Vector2(), to = new THREE.Vector2();
let age = 99, wait = 5; // seconds since the last leap began, until the next one

// ---- Moving: what turns and drifts on the far islets, kept out of the islets' bake. The windmill's sails take about 12 s a turn; the volcano's smoke is six puffs, each born small in the crater, swelling
// as it climbs the wind and gone at the top, turning as it goes (a 5 s life, each at its own point of it) ----
const [vx, vz] = ISLETS[4], [mx, mz] = ISLETS[5];
const sails = moving((g) => { box(g, 3.6, 0.2, 0.08, WOOD, 0, -0.1); box(g, 0.2, 3.6, 0.08, WOOD, 0, -1.8); }); // a cross about its middle
sails.position.set(mx - 1.5, 2.5, mz + 0.5); // on the front of the tower, over its hub
const smoke = [0xa9a6bd, 0x948fab, 0xb8b6ca, 0x827e99, 0xa9a6bd, 0x9d9ab2].map((c) => moving((g) => box(g, 1, 1, 1, c, 0, -0.5)));

export const scenery = new THREE.Group().add(isles, sails, ...smoke, dolphin, ...fleet.map((b) => b.g));

export function updateScenery(t: number, dt: number) {
  sails.rotation.z = t * 0.5;
  smoke.forEach((g, i) => {
    const p = (t * 0.2 + i / smoke.length) % 1; // how far along its life
    g.position.set(vx + 1.6 * p, 3.6 + 4.8 * p, vz);
    g.rotation.y = i + t * 0.3;
    g.scale.setScalar((0.6 + 1.2 * p) * Math.min(1, 5 * p, 5 * (1 - p)));
  });
  fleet.forEach((b, i) => {
    b.s += b.v * dt;
    const [x, z, dx, dz] = b.lane(b.s), k = Math.sign(b.v), fx = dx * k, fz = dz * k; // f: the way it is heading
    b.g.position.set(x, SEA + 0.15 + Math.sin(t * 1.3 + i * 2) * 0.04, z); // riding a little high: the hulls' undersides stay below the water
    b.g.rotation.set(Math.sin(t * 0.9 + i) * 0.03, Math.atan2(-fz, fx), Math.sin(t * 1.1 + i * 3) * 0.02); // roll, heading, pitch
    WAKES[i].set(x - fx * b.stern, z - fz * b.stern, fx, fz);
  });
  age += dt;
  if ((wait -= dt) < 0) { // a new leap, either way round the drum
    const th = Math.random() * 2 * Math.PI, r = 9.2 + Math.random() * 1.2, k = Math.random() < 0.5 ? 1 : -1, tx = -k * Math.sin(th) * HALF, tz = k * Math.cos(th) * HALF;
    from.set(r * Math.cos(th) - tx, r * Math.sin(th) - tz); to.set(r * Math.cos(th) + tx, r * Math.sin(th) + tz);
    age = 0; wait = 10 + Math.random() * 8;
  }
  const u = age / HOP, dx = to.x - from.x, dz = to.y - from.y;
  dolphin.visible = u < 1;
  if (u < 1) { // a parabola, starting and ending under the surface, nose up on the way out and down on the way in
    dolphin.position.set(from.x + dx * u, SEA - 0.6 + 4 * PEAK * u * (1 - u), from.y + dz * u);
    dolphin.rotation.set(0, Math.atan2(-dz, dx), Math.atan2(4 * PEAK * (1 - 2 * u), Math.hypot(dx, dz)));
  }
  SPLASH[0].set(from.x, from.y, (age - 0.15) / 1.2); SPLASH[1].set(to.x, to.y, (age - 1.25) / 1.2);
}
