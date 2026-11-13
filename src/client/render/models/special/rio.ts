import * as THREE from 'three';
import { box, cyl, decal, final, lamplit, mat, part, stone, INK, type ModelDef } from '../../builder';

// What the two upgrades are drawn in (see `levels`): one small palette between them, since the mountain already takes most of a model's draw-call budget (every paint is a mesh once baked, see check.mjs): the pale concrete of the stadium and the core of the steps, snow white,
// the blue, yellow and green of the Brazilian flag (the stadium's seats and the steps' tiles; a lighter green for the pitch's other stripe), a red for the tiles, and the lamp, which is unlit: it shines by day as by night
const CONCRETE = 0xded8c6, SNOW = 0xf4f6fa, BLUE = 0x2b68d4, YELLOW = 0xf4c430, GREEN = 0x3ba35a, LIME = 0x55ca75, RED = 0xe43b44, LAMP = 0xfff6b0;

export default {
  key: 'Rio',
  lamps: [{ at: [0, 2.2, 0.7], color: 0xffe8c0, power: 3.4, reach: 6.5, final: true }], // the floodlights on the Christ's mountain, in front of the pedestal
  props: [ // Christ the Redeemer: the soapstone statue, arms spread, on its chapel pedestal and viewing terrace (visitors posing arms wide) on the granite summit of Corcovado, the rainforest mountain with its stair and flowering ipês rising from Guanabara Bay; behind its shoulder the Sugarloaf and its red cable car, on the beach palms and the Brazilian flag, a sailboat in the bay
    final((g) => {
      const [SX, SZ, H, D] = [0, -0.15, 0.115, 0.7];                                                                                                            // the statue's centre line, the height of a tier of the mountain, how deep a tier is for its width
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, SAND = 0xf0dca0, STAIR = 0xdcd0b0, GR = 0xcbc3ae, GRL = 0xded8c6, DARK = 0x3f392e, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;  // paints: bay, foam, beach, the stair's stone, granite in two tones, the doorway's shade, trunks, white
      const SOAP = 0xf0f4ec, SOAPL = 0xfcfdf9, SOAPD = 0xcad5cc, SOAPDD = 0x96a79a;                                                                             // the statue's soapstone in four tones
      const flood = (c: number) => lamplit(c, 0xffe9c4, 0.16), soap = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => box(g, w, h, d, c, x, y, z, flood(c)); // its floodlight by night, as the Merlion's (see singapore.ts), and a block of it
      const RX = [0.98, 0.93, 0.87, 0.81, 0.75, 0.69, 0.63, 0.58, 0.54, 0.5, 0.46];                                                                             // the half-width of each tier of the mountain, from the shore up
      const LEAF = [0x2a7f48, 0x2f8a4e, 0x359654, 0x3ba35a, 0x42b062, 0x4abd6a, 0x55ca75], ROCK = [0xb2a994, 0xa39b88, 0x948c7a, 0x877f6f];                     // the forest's greens climbing, then the four granite tiers of the crown
      const T = 0.12 + RX.length * H, P = T + 0.65, Y = (h: number) => P + h;                                                                                           // the summit, the top of the pedestal, a height above it
      const Z = (k: number) => SZ + D * RX[k] * 0.951;                                                                                                                  // where the flat front face of tier k stands
      const topAt = (x: number, z: number) => 0.12 + H * (1 + Math.max(-1, ...RX.map((rx, i) => (((x - SX) / rx) ** 2 + ((z - SZ) / (rx * D)) ** 2 < 0.8 ? i : -1))));          // the height of the mountain at (x, z)
      const DECAGON = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, Math.PI / 10);                                                                          // a unit slab with a flat face to the front, stretched into ellipses
      const slab = (rx: number, rz: number, x: number, z: number, y: number, h: number, c: number) => part(g, DECAGON, h, mat(c), x, y, z).scale.set(rx, h, rz);                                                        // an elliptical slab rx wide, rz deep
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);                                                                           // Guanabara Bay, its shallows
      slab(1.1, 1.1 * D, SX, SZ, 0.1, 0.02, FOAM); slab(1.06, 1.06 * D, SX, SZ, 0.1, 0.04, SAND); slab(0.85, 0.26, SX, SZ + 0.6, 0.1, 0.05, SAND);              // foam round the shore, the beach, the sand spit in front
      RX.forEach((rx, i) => slab(rx, rx * D, SX, SZ, 0.12 + i * H, H, i < 7 ? LEAF[i] : ROCK[i - 7]));                                                          // the mountain: seven tiers of forest under four of granite
      RX.forEach((_, k) => box(g, 0.16, H, 0.14, STAIR, SX, 0.12 + k * H, Z(k) - 0.04));                                                                        // the stair of pale stone up its front face
      [[0.24, 0x2a7f48], [0.24, 0x359654], [0.22, 0xb5aa98], [0.19, 0xc4baa8], [0.15, 0xb5aa98], [0.1, 0xc4baa8], [0.05, 0xb5aa98]].forEach(([r, c], i) => slab(r, r * 0.8, 0.96, -0.66, 0.1 + i * 0.12, 0.12, c));  // Sugarloaf behind the mountain's shoulder: green flanks, a rounded granite dome
      box(g, 0.1, 0.06, 0.07, 0xe43b44, 0.96, 0.94, -0.66);                                                                                                     // the red cable car at its summit
      const rock = (x: number, z: number, s: number) => { const y = topAt(x, z); box(g, 0.2 * s, 0.1 * s, 0.14 * s, 0xa39b88, x, y, z); box(g, 0.12 * s, 0.08 * s, 0.1 * s, 0xb2a994, x + 0.03 * s, y + 0.1 * s, z).rotation.y = 0.5; };  // a boulder s big: a block and a smaller turned one on it
      rock(-0.5, SZ + 0.1, 1.2); rock(0.5, SZ + 0.08, 1); rock(-0.28, SZ + 0.2, 0.8);                                                                           // three on the granite ledges
      const CROWN = [[0x2f7a4a, 0x3f9a5c, 0x4fb06a], [0x277043, 0x358f55, 0x45a862], [0xe0a020, 0xf4c430, 0xffe066]];                                           // a tree's three tiers of leaves: two greens, and an ipê in yellow bloom
      const tree = (x: number, z: number, s: number, c: number) => { const y = topAt(x, z); [[0.15, 0.12], [0.12, 0.11], [0.08, 0.1]].forEach(([r, h], i) => cyl(g, r * s, h * s, CROWN[c][i], x, y + (0.03 + i * 0.09) * s, z)); };  // three tiers of leaves down to the ground, s big
      for (let i = 0; i < 26; i++) { const a = i * 2.4, t = Math.sqrt((i + 0.5) / 26), x = SX + t * 0.92 * Math.cos(a), z = SZ + t * 0.64 * Math.sin(a); if (t > 0.6 && (Math.abs(x - SX) > 0.2 || z < SZ)) tree(x, z, 0.8 + (i % 3) * 0.12, i % 7 === 3 ? 2 : i & 1); }  // the jungle: trees spread over the slopes a golden angle apart, the stair kept clear
      stone(g, 1, 0.08, 0.74, GRL, SX, T, SZ); box(g, 0.96, 0.08, 0.04, GR, SX, T + 0.08, SZ + 0.34);                                                           // the viewing terrace on the summit, its balustrade along the front
      for (const s of [-1, 1]) box(g, 0.04, 0.08, 0.7, GR, SX + s * 0.48, T + 0.08, SZ);                                                                        // and along both sides
      stone(g, 0.72, 0.06, 0.54, GR, SX, T + 0.08, SZ); stone(g, 0.54, 0.46, 0.4, GR, SX, T + 0.14, SZ); box(g, 0.62, 0.05, 0.48, GRL, SX, T + 0.6, SZ);        // the pedestal: its footing, the chapel in granite, the cornice
      box(g, 0.1, 0.18, 0.02, DARK, SX, T + 0.14, SZ + 0.2); box(g, 0.15, 0.03, 0.03, GRL, SX, T + 0.32, SZ + 0.2);                                             // the chapel door and its lintel
      [[-0.32, 0xe43b44], [-0.14, 0xffd23f], [0.15, 0x41a6f6], [0.33, 0x38b764]].forEach(([x, c]) => { box(g, 0.05, 0.08, 0.04, c, SX + x, T + 0.08, SZ + 0.26); box(g, 0.04, 0.04, 0.04, 0xf5b88c, SX + x, T + 0.16, SZ + 0.26); box(g, 0.12, 0.02, 0.025, c, SX + x, T + 0.145, SZ + 0.26); });  // visitors posing with their arms wide: shirt, head, arms
      soap(0.4, 0.14, 0.28, SOAPD, SX, P, SZ); soap(0.37, 0.41, 0.25, SOAP, SX, Y(0.14), SZ); soap(0.34, 0.4, 0.23, SOAP, SX, Y(0.55), SZ); soap(0.31, 0.35, 0.21, SOAP, SX, Y(0.95), SZ); // the robe: the hem, three stages narrowing
      [[-0.13, SOAPD], [-0.045, SOAPL], [0.045, SOAPD], [0.13, SOAPL]].forEach(([x, c]) => soap(0.075, 1.1, 0.03, c, SX + x, Y(0.16), SZ + 0.115)); // folds down its front
      soap(0.35, 0.32, 0.2, SOAPL, SX, Y(1.3), SZ); // the chest and shoulders
      const sleeve = (s: number) => new THREE.ExtrudeGeometry(new THREE.Shape([[0.17, 1.612], [0.694, 1.535], [0.694, 1.47], [0.56, 1.28], [0.17, 1.28]].map(([x, y]) => new THREE.Vector2(s * x, Y(y)))), { depth: 0.15, bevelEnabled: false }).translate(0, 0, -0.075);  // a sleeve in profile: the top sloping to the wrist, a flat hem, the cuff cut steeply back up to the wrist
      for (const s of [-1, 1]) {                                                                                                                                // an arm either side: the sleeve, then the thin hand past its cuff
        part(g, sleeve(s), 0, flood(SOAP), SX, 0, SZ);
        soap(0.14, 0.065, 0.085, SOAPL, SX + s * 0.75, Y(1.47), SZ); soap(0.12, 0.05, 0.075, SOAP, SX + s * 0.88, Y(1.475), SZ); soap(0.07, 0.035, 0.04, SOAPL, SX + s * 0.74, Y(1.535), SZ + 0.025); // the hand: palm, fingers, thumb on top
      }
      soap(0.1, 0.1, 0.1, SOAPD, SX, Y(1.6), SZ); soap(0.18, 0.22, 0.17, SOAP, SX, Y(1.67), SZ); soap(0.2, 0.05, 0.19, SOAPD, SX, Y(1.86), SZ - 0.005); // the neck, the head, the hair on top
      for (const s of [-1, 1]) soap(0.035, 0.27, 0.18, SOAPD, SX + s * 0.11, Y(1.6), SZ - 0.01); // long locks down to the shoulders
      soap(0.14, 0.02, 0.02, SOAPDD, SX, Y(1.8), SZ + 0.09); soap(0.03, 0.08, 0.03, SOAPL, SX, Y(1.7), SZ + 0.095); soap(0.1, 0.1, 0.05, SOAPD, SX, Y(1.58), SZ + 0.08); // the brow, the nose, the beard
      const palm = (x: number, z: number, h: number) => {                                                                                                                               // a palm h tall on the beach: a trunk in three leaning sections, five drooping fronds
        for (let i = 0; i < 3; i++) box(g, 0.08 - 0.008 * i, h / 3, 0.08 - 0.008 * i, i & 1 ? WOOD : 0x7a4a22, x + 0.025 * i, 0.15 + (i * h) / 3, z);
        for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5 + 0.3; box(g, 0.11, 0.025, 0.36, k & 1 ? 0x2fa84f : 0x4cc36b, x + 0.08 + Math.sin(a) * 0.16, 0.11 + h, z + Math.cos(a) * 0.16).rotation.set(0.45, a, 0, 'YXZ'); }
      };
      palm(-0.7, SZ + 0.62, 0.7); palm(-0.5, SZ + 0.7, 0.5);                                                                                                    // two on the beach
      const BR = ['mmmmYYYmmmm', 'mmYYuuuYYmm', 'mYYuuuuuYYm', 'YYYwwwwwYYY', 'mYYuuuuuYYm', 'mmYYuuuYYmm', 'mmmmYYYmmmm'];                                     // Brazil's green field, yellow rhombus and blue globe with its white band
      box(g, 0.03, 0.8, 0.03, 0xdddddd, 0.3, 0.15, 0.52); decal(g, BR, 0.3 + 11 / 44, 0.62, 0.52);                                                              // the flag on its pole
      const [bx, bz] = [0.78, 0.82];                                                                                                                            // the sailboat's centre
      box(g, 0.38, 0.06, 0.13, WHITE, bx, 0.1, bz); box(g, 0.39, 0.02, 0.135, 0x2b68d4, bx, 0.1, bz); box(g, 0.08, 0.06, 0.09, WHITE, bx + 0.22, 0.1, bz);      // the sailboat: hull, its blue waterline, the narrow bow
      box(g, 0.16, 0.05, 0.1, 0xdce4ff, bx - 0.03, 0.16, bz); box(g, 0.02, 0.5, 0.02, 0xdddddd, bx, 0.16, bz);                                                  // the cabin, the mast
      decal(g, ['.....w', '....ww', '....ww', '...www', '...www', '..wwww', '..wwww', '.wwwww', '.wwwww', 'wwwwww'], bx - 3 / 22 - 0.01, 0.2, bz); decal(g, ['R...', 'RR..', 'RR..', 'RRR.', 'RRR.', 'RRRR', 'RRRR'], bx + 2 / 22 + 0.02, 0.2, bz);  // the mainsail, the red jib
      [[-0.9, 0.85], [0.3, 0.9], [1.0, 0.65]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                                             // ripples on the bay
    }),
  ],
  levels: [ // the Christ stands on his mountain at every level; each upgrade adds a landmark of Rio on the apron in front of the bay: the stadium on the left, the steps on the right
    [ // Lv 1, the Maracanã on the apron's left: an oval bowl on a paved esplanade, a ring of white piers over dark glass round its foot, three tiers of blue and yellow seats inside and over them a wide white roof that leaves the striped pitch open to the sky, a ring of lights round the roof's inner edge
      final((g) => {
        const [MX, MZ, A, B, EY, PX, PZ] = [-0.5, 1.4, 0.62, 0.37, 0.27, 0.25, 0.115];                                                                                     // the stadium's centre line, the half-width and half-depth of its wall, the height of its eave; the pitch's half-width and half-depth
        const oval = (a: number, b: number) => Array.from({ length: 40 }, (_, i) => new THREE.Vector2(a * Math.cos((i * Math.PI) / 20), b * Math.sin((i * Math.PI) / 20)));  // an ellipse a wide and b deep, in forty corners
        const ring = (a0: number, b0: number, a1: number, b1: number, y: number, h: number, c: number) => {                                                                // a slab of the oval (a1, b1) with the oval (a0, b0) cut out of it (a0 = 0: none), h tall from y: the esplanade, the wall, the seats and the roof are all rings
          const s = new THREE.Shape(oval(a1, b1)); if (a0) s.holes.push(new THREE.Path(oval(a0, b0)));
          return part(g, new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2), 0, mat(c), MX, y, MZ);                                    // extruded up from the plan, turned to stand on y
        };
        ring(0, 0, A + 0.07, B + 0.04, 0, 0.04, CONCRETE);                                                                                                                 // the esplanade
        ring(0.57, 0.33, A, B, 0.04, 0.09, CONCRETE); ring(0.57, 0.33, A - 0.005, B - 0.005, 0.13, 0.1, INK); ring(0.57, 0.33, A + 0.01, B + 0.01, 0.23, 0.04, CONCRETE);    // the wall: a concrete foot, a band of dark glass, the fascia under the eave
        for (let k = 0; k < 32; k++) { const t = (k * Math.PI) / 16; box(g, 0.045, 0.1, 0.04, SNOW, MX + A * Math.cos(t), 0.13, MZ + B * Math.sin(t)).rotation.y = Math.atan2(-B * Math.cos(t), -A * Math.sin(t)); } // a white pier at every step round the glass, turned to stand along the wall
        [[0.33, 0.185, 0.09, BLUE], [0.4, 0.23, 0.14, YELLOW], [0.47, 0.275, 0.19, BLUE]].forEach(([a, b, top, c]) => ring(a, b, A - 0.05, B - 0.04, 0.04, top - 0.04, c));  // the seats in three tiers that climb from the pitch to the wall
        for (let i = 0; i < 8; i++) { const c = i & 1 ? LIME : GREEN; box(g, PX / 4, 0.02, 2 * PZ, c, MX - PX + (i + 0.5) * (PX / 4), 0.04, MZ, lamplit(c, c, 0.45)); } // the pitch, mown in eight stripes across
        const line = (w: number, d: number, x: number, z: number) => box(g, w, 0.008, d, SNOW, MX + x, 0.06, MZ + z);                                                      // a white line on it, from its centre
        for (const s of [-1, 1]) { line(2 * PX, 0.025, 0, s * (PZ - 0.0125)); line(0.025, 2 * PZ, s * (PX - 0.0125), 0); line(0.1, 0.025, s * (PX - 0.05), 0.07); line(0.1, 0.025, s * (PX - 0.05), -0.07); line(0.025, 0.165, s * (PX - 0.1), 0); } // the touchlines and goal lines, the penalty areas
        line(0.025, 2 * PZ, 0, 0); ring(0.035, 0.035, 0.06, 0.06, 0.06, 0.008, SNOW);                                                                                      // the halfway line, the centre circle
        ring(0.43, 0.235, A + 0.03, B + 0.025, EY, 0.035, SNOW); ring(0.43, 0.235, 0.455, 0.26, EY + 0.035, 0.02, LAMP);                                                   // the roof, a broad white ring from over the wall to over the edge of the pitch, and the ring of lights round its inner rim
      }),
    ],
    [ // Lv 2, the Selarón Steps on the apron's right: seven steps up from the street, tiled in the blue, yellow and green of the flag with the white and red that the artist broke them with, between two walls of tiles that climb with them; a lamp on the front of each wall and a pot of greenery at its foot, and more of it spilling over the walls
      final((g) => {
        const [SX, ZF, N, RUN, RISE, CW, WALL] = [0.74, 1.82, 7, 0.117, 0.085, 0.1, 0.12];                                                                                 // the steps' centre line and foot, how many, the depth and height of a step, the width of a tile and of a wall
        const TILE: Record<string, number> = { B: BLUE, Y: YELLOW, G: GREEN, R: RED, W: SNOW };                                                                            // the tiles' paints
        const STEPS = ['RWRWR', 'GYBGY', 'YBWRB', 'BGYBG', 'WRBYW', 'YGRGY', 'BYGBR'];                                                                                     // the tiles across each step, from the foot: a tile's top and its front are one paint
        const WALLS = ['BGYRWBG', 'YRBGYWR'];                                                                                                                              // the two courses of tiles in a wall, from the foot: a tile to every step
        const T = (RISE + 0.1) / 2, EDGE = 2.5 * CW + WALL / 2, top = (k: number) => (k + 1) * RISE + 0.1;                                                                  // the height of a wall's tile (the wall stands 0.1 over its step), how far a wall stands from the centre line, the height of its top at step k
        for (let k = 0; k < N; k++) {
          const z = ZF - RUN * (k + 0.5), y = k * RISE;                                                                                                                    // the step's centre line, the height it starts at
          if (k) { box(g, 5 * CW, y, RUN, CONCRETE, SX, 0, z); for (const s of [-1, 1]) box(g, WALL, y, RUN, CONCRETE, SX + s * EDGE, 0, z); }                              // the solid under the step and under each wall
          [...STEPS[k]].forEach((c, i) => box(g, CW, RISE, RUN, TILE[c], SX + (i - 2) * CW, y, z));                                                                        // the step's tiles
          for (const s of [-1, 1]) [0, 1].forEach((j) => box(g, WALL, T, RUN, TILE[WALLS[s < 0 ? j : 1 - j][k]], SX + s * EDGE, y + j * T, z));                           // the wall's two courses, flipped on the other side
        }
        for (const s of [-1, 1]) {
          const x = SX + s * EDGE, z = ZF - RUN / 2;
          box(g, 0.02, 0.18, 0.02, INK, x, top(0), z); box(g, 0.05, 0.05, 0.05, LAMP, x, top(0) + 0.18, z);                                                                 // the lamp on the front of the wall
          box(g, 0.09, 0.07, 0.09, RED, x + s * 0.12, 0, ZF - 0.07); box(g, 0.11, 0.09, 0.11, GREEN, x + s * 0.12, 0.07, ZF - 0.07); box(g, 0.07, 0.07, 0.07, LIME, x + s * 0.12, 0.16, ZF - 0.07);  // the pot at its foot, the shrub in it
        }
        [[-1, 2], [1, 4], [-1, 5], [1, 6]].forEach(([s, k]) => { const x = SX + s * EDGE, z = ZF - RUN * (k + 0.5); box(g, 0.1, 0.05, 0.1, k & 1 ? LIME : GREEN, x, top(k), z); box(g, 0.06, 0.05, 0.06, k & 1 ? GREEN : LIME, x + s * 0.02, top(k) + 0.05, z); });  // greenery spilling over the walls
      }),
    ],
  ],
} satisfies ModelDef;
