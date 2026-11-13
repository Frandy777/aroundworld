import * as THREE from 'three';
import { box, cyl, final, part, rnd, sprite, stone, GOLD, type ModelDef } from '../../builder';
import { canvas, shade } from '../../art';
import { switchOf } from '../../light';
import { lodMap, pixelTexture, texels, toon } from '../../scene';

// The Sphere of Lv 2: the ball's radius, the radius it has where the top of its base meets it (the ball is drawn whole and sunk into the base, so this says how much of it is out: the nearer to its own radius, the more is buried), and the pole of its rings (see `led`): at the lower left edge of the side that the
// default camera sees, as in the pictures of the real one, so that the rings sweep up across the part of the ball that shows over the sign
const R = 0.74, FOOT = 0.7, DEG = Math.PI / 180, [PA, PE] = [-55 * DEG, -5 * DEG], POLE = [Math.sin(PA) * Math.cos(PE), Math.sin(PE), Math.cos(PA) * Math.cos(PE)];
// Its screen shows rings flowing round a pole, the picture it is known by: each ring starts dark and brightens across its width, now and then ends in a bright line, and has a darkness and a peak of its own, the whole swayed a little by a slow flow.
// The skin is a map of the globe (u round it, v from pole to pole) with its poles on the ball's left and right, so that the side the camera sees is the middle of the map, where the texels are square. Every texel is coloured for the point of the globe that it
// covers, so the rings keep their shape whatever the stretch of the map, which is sized to the world's texels (a mid level twice that, a far one four times) and holds as many rings as its texels can draw. The picture is grey: its colours are the owner's
// (see `shine`). It is drawn twice: the day's, dull as a screen in the sun, and the night's, which is the emissive map (see `nightlit`): the dark starts of the rings go dim and the lines are left to bloom
const led = (L: number, night: boolean) => {
  const W = texels(2 * Math.PI * R, L), H = texels(Math.PI * R, L), N = 3 << L;                                                                         // texels round the globe and from pole to pole; the rings from the pole to the far side of the globe
  return pixelTexture(canvas(W, H, (g) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const th = ((y + 0.5) / H) * Math.PI, ph = ((x + 0.5) / W) * 2 * Math.PI, d = [-Math.cos(th), -Math.cos(ph) * Math.sin(th), Math.sin(ph) * Math.sin(th)];  // the point of the globe that this texel covers (the globe is turned on its side: its poles run along x)
      const w = ((Math.acos(Math.max(-1, Math.min(1, d[0] * POLE[0] + d[1] * POLE[1] + d[2] * POLE[2]))) + 0.07 * Math.sin(3 * d[1] + 2 * d[0] + 1.3) + 0.05 * Math.sin(5 * d[2] - 3 * d[0])) * N) / Math.PI; // how many rings it is from the pole, swayed by the flow
      const k = Math.floor(w), p = w - k, lo = 0.3 + 0.15 * rnd(k, 2), hi = 0.65 + 0.35 * rnd(k, 4);                                                       // which ring it is in, how far across it (0 to 1), how dark the ring starts and how bright it gets
      const v = (p > 0.86 && rnd(k, 3) < 0.4 ? 1 : lo + (hi - lo) * p ** 0.7) * (0.9 + 0.1 * Math.sin(4 * d[1] - 3 * d[2] + 5 * k));                          // the ring brightening across (fast at first), a bright line at the end of some; brighter and dimmer as it runs round
      g.fillStyle = shade(0xffffff, (night ? Math.round(6 * v) / 6 : 0.45 + 0.55 * Math.round(6 * v) / 6) * (L > 1 ? 0.96 + 0.08 * rnd(x, y, 7) : 1));      // six steps of grey, the day's lifted, and a grain of lamps at the finest level
      g.fillRect(x, y, 1, 1);
    }
  }));
};
const SKIN = lodMap(lodMap(toon(0xffffff, { emissive: 0xffffff }, [0.6, 0.5, 0, 0]), (L) => led(L, false)), (L) => led(L, true), 'emissiveMap'); // the screen's material: the day's picture is its colour, the night's its lamps (as the glass of a tower, see `prismMat`); a soft sheen, with no relief to read off the picture
const shine = (c: number | null) => { switchOf(SKIN).value = +(c !== null); SKIN.color.set(c ?? 0x707890).multiplyScalar(1.5); SKIN.emissive.set(c ?? 0).multiplyScalar(1.5); }; // c: the owner's colour while the Sphere stands, null while it is for sale or mortgaged: its screen is a dull grey and its lamps out (the lamps past 1 bloom in the owner's colour)

export default {
  key: 'Las Vegas',
  lamps: [{ at: [-0.3, 1.5, 0.45], color: 0xffae52, power: 5.5, reach: 6, final: true }], // the Fabulous Las Vegas sign & neon
  props: [ // Welcome to Fabulous Las Vegas: the diamond sign on its median, seven silver-dollar coins spelling WELCOME across its top, a star between the two poles that carry it, palms and boulders round its foot; the boulevard in front with a taxi, on the plaza that the upgrades build on (the Strat behind the sign on the right, the Sphere behind it in the middle)
    final((g) => {
      const [SX, SZ, SY] = [-0.34, 0.2, 0.99];                                                                                                                  // the sign's centre line, its depth, the foot of its board
      const PLAZA = 0xb9b3a2, KERB = 0xe6e9f0, ASPHALT = 0x3d4254, GRAVEL = 0xb8825c, ROCK = 0xc99a74, POLE = 0x4a9ac8, STAR = 0xe8502a, WOOD = 0x8a5a2b;  // paints
      const SIGN = [                                                                                                                                            // the sign's face, 37 x 24: seven coins across the top, WELCOME TO FABULOUS, LAS VEGAS and NEVADA inside a border of bulbs
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
      const LENS = [3, 11, 21, 29, 37, 37, 37, 29, 21, 11, 3];                                                                                                  // the width of the board in texels, two rows to a step from its top: the diamond's outline behind rows 2 to 23 of its face
      stone(g, 2.4, 0.1, 1.9, PLAZA); box(g, 2.4, 0.03, 0.4, ASPHALT, 0, 0.1, 0.75);                                                                            // the paved plaza, the boulevard along its front
      [-1, -0.55, -0.1, 0.35, 0.8].forEach((x) => box(g, 0.24, 0.01, 0.04, GOLD, x, 0.13, 0.75));                                                               // its dashed yellow centre line
      stone(g, 1.8, 0.07, 0.74, KERB, SX + 0.04, 0.1, 0.2); box(g, 1.68, 0.03, 0.62, GRAVEL, SX + 0.04, 0.17, 0.2);                                             // the median the sign stands on: its kerb, the gravel bed
      LENS.forEach((w, i) => box(g, w / 22, 2 / 22, 0.1, 0xffffff, SX, SY + (20 - 2 * i) / 22, SZ));                                                            // the board's thickness: a white slab behind every two rows of its outline
      part(g, new THREE.PlaneGeometry(37 / 22, 24 / 22), 24 / 22, new THREE.MeshBasicMaterial({ map: sprite(SIGN), alphaTest: 0.5 }), SX, SY, SZ + 0.06).castShadow = false;  // its face, unlit: the sign is lit from inside
      for (const x of [-0.52, -0.16]) box(g, 0.08, 2.32, 0.05, POLE, SX + x, 0.17, SZ - 0.06);                                                                  // the two pale blue poles, off to the left of the board's middle
      box(g, 0.44, 0.07, 0.05, POLE, SX - 0.34, 2.42, SZ - 0.06);                                                                                               // the crossbar joining them above the board
      const arm = (w: number, h: number, a: number) => { box(g, w, h, 0.05, STAR, SX - 0.34, 2.17 - h / 2, SZ + 0.02).rotation.z = a; };                                                // a bar through the star's centre, tipped over by a
      arm(0.6, 0.08, 0); arm(0.08, 0.6, 0); arm(0.42, 0.07, Math.PI / 4); arm(0.42, 0.07, -Math.PI / 4);                                                        // the eight-pointed star between the poles: a flat bar, an upright one, two diagonals
      [[0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]].forEach(([x, dy]) => box(g, 0.06, 0.06, 0.06, 0xfff6b0, SX - 0.34 + x, 2.14 + dy, SZ + 0.02));                 // its yellow neon tips
      const palm = (x: number, z: number, h: number, n = 6) => {                                                                                                                        // a date palm h tall with n arching fronds
        for (let i = 0; i < 4; i++) box(g, 0.08 - 0.006 * i, h / 4, 0.08 - 0.006 * i, i & 1 ? WOOD : 0x7a4a22, x + 0.015 * i, 0.2 + (i * h) / 4, z);            // the trunk: four banded sections, tapering and leaning a little
        box(g, 0.12, 0.08, 0.12, 0x5a3a1a, x + 0.06, 0.16 + h, z);                                                                                              // the knot of the crown
        for (let k = 0; k < n; k++) {                                                                                                                           // each frond
          const a = (k * 2 * Math.PI) / n + 0.3; let [px, py, pz] = [x + 0.06, 0.2 + h, z];                                                                     // its bearing, where it has got to
          [[0.2, -0.3], [0.26, 0.9]].forEach(([L, p], j) => {                                                                                                   // two stretches: first rising a little, then drooping by p
            const [dx, dy, dz] = [Math.sin(a) * Math.cos(p) * L, -Math.sin(p) * L, Math.cos(a) * Math.cos(p) * L];                                              // the way the stretch runs
            const f = box(g, 0.09, 0.025, L, (k + j) & 1 ? 0x2fa84f : 0x4cc36b, px + dx / 2, py + dy / 2 - 0.0125, pz + dz / 2);                                // a blade of leaf, light and dark in turn
            f.rotation.order = 'YXZ'; f.rotation.set(p, a, 0);                                                                                                  // pitched down by p, then turned to its bearing
            px += dx; py += dy; pz += dz;                                                                                                                       // the next stretch starts where this one ends
          });
        }
      };
      palm(0.15, -0.05, 1.9); palm(-1.02, 0.5, 0.7, 5); palm(0.5, 0.5, 0.7, 5);                                                                                 // a tall palm rising behind the sign, a small one at either front corner of the median
      const rock = (x: number, z: number, s: number) => { box(g, 0.22 * s, 0.1 * s, 0.16 * s, ROCK, x, 0.2, z); box(g, 0.14 * s, 0.08 * s, 0.11 * s, 0xb5835e, x + 0.03 * s, 0.2 + 0.1 * s, z).rotation.y = 0.5; box(g, 0.07 * s, 0.05 * s, 0.07 * s, 0xd8b08c, x - 0.03 * s, 0.2 + 0.18 * s, z).rotation.y = -0.4; };  // a boulder s big: a block, a smaller turned one and a chip piled on it
      rock(-0.78, 0.46, 1.2); rock(0.2, 0.5, 1); rock(-0.5, 0, 0.8);                                                                                            // three on the gravel
      const [cx, cz] = [0.6, 0.82];                                                                                                                             // the taxi's centre
      box(g, 0.44, 0.09, 0.2, 0xf2c230, cx, 0.13, cz); box(g, 0.24, 0.09, 0.18, 0xf2c230, cx - 0.02, 0.22, cz); box(g, 0.2, 0.05, 0.19, 0x1a2250, cx - 0.02, 0.24, cz);  // the taxi: its yellow body and cabin, the dark glass round it
      box(g, 0.08, 0.03, 0.06, 0xffffff, cx - 0.02, 0.31, cz); [-0.14, 0.14].forEach((dx) => [-0.1, 0.1].forEach((dz) => box(g, 0.08, 0.07, 0.03, 0x23263a, cx + dx, 0.1, cz + dz)));  // its roof light, its four wheels
    }),
  ],
  levels: [ // the sign stands in front at every level; each upgrade adds a landmark of the Strip behind it: the Stratosphere on the plaza on the right, the Sphere in the middle
    [ // Lv 1, the Stratosphere behind the sign on the right: a concrete tripod under a two-tier glass pod with neon bracing and a red-lit mast
      final((g) => {
        const [TX, TZ] = [0.8, -0.5];                                                                                                                           // the tower's centre line
        const PAVE = 0xcfc8b6, KERB = 0xe6e9f0, CREAM = 0xf0e6bd, CREAM2 = 0xdccfa0, GLASS = 0x34426e, GLASS2 = 0x4a5c92, DOME = 0x6b7391, WHITE = 0xf4f6fa;  // paints
        cyl(g, 0.42, 0.05, KERB, TX, 0.1, TZ); cyl(g, 0.34, 0.05, PAVE, TX, 0.15, TZ);                                                                            // the tower's round plinth, in two steps
        cyl(g, 0.12, 3.1, CREAM, TX, 0.14, TZ);                                                                                                                   // the concrete shaft
        for (const a of [Math.PI, (Math.PI * 5) / 3, Math.PI / 3]) {                                                                                              // the three legs, 120 degrees apart: one behind the shaft, two in front
          const fin = (y: number, h: number, L: number) => { const r = 0.08 + L / 2; box(g, 0.08, h, L, CREAM2, TX + r * Math.sin(a), y, TZ + r * Math.cos(a)).rotation.y = a; };         // a slab of a leg, L long, standing off the shaft along this leg's bearing
          for (let i = 0; i < 6; i++) fin(0.14 + i * 0.2, 0.2, 0.34 - 0.04 * i);                                                                                  // the leg, stepping in until it meets the shaft
          for (let i = 0; i < 4; i++) fin(2.8 + i * 0.12, 0.12, 0.16 + 0.07 * i);                                                                                 // the tulip flaring out under the pod
        }
        let y = 3.3;                                                                                                                                              // the height built so far: the foot of the pod
        cyl(g, 0.34, 0.06, 0xe8e4d4, TX, y, TZ); y += 0.06;                                                                                                       // the concrete collar
        [0.28, 0.3, 0.32].forEach((r, i) => cyl(g, r, 0.1, GLASS, TX, y + i * 0.1, TZ));                                                                          // the lower tier of dark glass, widening
        [[-0.2, 0xfff6b0, 0.24], [0, 0x5dfff0, 0.31], [0.2, 0xff5de0, 0.24]].forEach(([x, c, z]) => [-1, 1].forEach((s) => { box(g, 0.03, 0.34, 0.03, c, TX + x, y - 0.02, TZ + z).rotation.z = s * 0.55; }));  // three Xs of neon bracing across its front, following the curve of the drum
        y += 0.3; cyl(g, 0.4, 0.06, WHITE, TX, y, TZ); y += 0.06;                                                                                                 // the white belt between the tiers
        [0.36, 0.39, 0.42, 0.44].forEach((r, i) => cyl(g, r, 0.08, i & 1 ? GLASS2 : GLASS, TX, y + i * 0.08, TZ)); y += 0.32;                                     // the upper tier, flaring wider still
        cyl(g, 0.45, 0.04, WHITE, TX, y, TZ); y += 0.04;                                                                                                          // the roof deck round the dome
        [0.3, 0.26, 0.2, 0.1].forEach((r, i) => cyl(g, r, 0.07, DOME, TX, y + i * 0.07, TZ)); y += 0.28;                                                          // the dome
        for (const x of [-0.04, 0.04]) box(g, 0.035, 0.95, 0.035, 0xff3b3b, TX + x, y, TZ);                                                                       // the mast: two red-lit uprights
        box(g, 0.03, 0.95, 0.03, WHITE, TX, y, TZ); box(g, 0.1, 0.1, 0.1, 0xff3b3b, TX, y + 0.95, TZ); cyl(g, 0.1, 0.05, 0xfff6b0, TX, y + 0.5, TZ);              // a white core between them, the red lamp on its tip, the Big Shot's ring of lights
      }),
    ],
    [ // Lv 2, the Sphere behind the sign: a ball sunk deep in a round base as wide as itself, its screen a flow of rings round a pole, in the colour of its owner (after dusk it shines)
      final((g) => {
        const X = -0.36, Z = -0.66, TOP = 0.5, PAVE = 0xcfc8b6, KERB = 0xe6e9f0;                                                                                // the Sphere's centre line and depth, between the sign and the Strat; the top of its base; paints: the stone of the base and its pale foot
        cyl(g, FOOT + 0.03, 0.12, KERB, X, 0, Z); cyl(g, FOOT + 0.03, TOP - 0.12, PAVE, X, 0.12, Z);                                                            // its base: a drum with a pale foot, a little wider than the ball where it goes in, so that the lower part of the ball is hidden inside it
        part(g, new THREE.SphereGeometry(R, 28, 18).rotateZ(Math.PI / 2), 0, SKIN, X, TOP + Math.sqrt(R * R - FOOT * FOOT), Z);                                 // the ball, on its side for its map (see `led`): the foot of it is inside the base, out of sight
      }),
    ],
  ],
  owner: shine,                                                                                                                                                 // the board tells the Sphere who owns the lot
} satisfies ModelDef;
