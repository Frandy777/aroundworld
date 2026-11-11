import * as THREE from 'three';
import { box, cyl, decal, final, mat, part, stone, type ModelDef } from '../../builder';

export default {
  key: 'Rio',
  props: [ // Christ the Redeemer: the soapstone statue, arms spread, on its chapel pedestal and viewing terrace (visitors posing arms wide) on the granite summit of Corcovado, the rainforest mountain with its stair and flowering ipês rising from Guanabara Bay; behind its shoulder the Sugarloaf and its red cable car, on the beach palms and the Brazilian flag, a sailboat in the bay
    final((g) => {
      const [SX, SZ, H, D] = [0, -0.15, 0.115, 0.7];                                                                                                            // the statue's centre line, the height of a tier of the mountain, how deep a tier is for its width
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, SAND = 0xf0dca0, STAIR = 0xdcd0b0, GR = 0xcbc3ae, GRL = 0xded8c6, DARK = 0x3f392e, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;  // paints: bay, foam, beach, the stair's stone, granite in two tones, the doorway's shade, trunks, white
      const SOAP = 0xf0f4ec, SOAPL = 0xfcfdf9, SOAPD = 0xcad5cc, SOAPDD = 0x96a79a;                                                                             // the statue's soapstone in four tones
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
      box(g, 0.4, 0.14, 0.28, SOAPD, SX, P, SZ); box(g, 0.37, 0.41, 0.25, SOAP, SX, Y(0.14), SZ); box(g, 0.34, 0.4, 0.23, SOAP, SX, Y(0.55), SZ); box(g, 0.31, 0.35, 0.21, SOAP, SX, Y(0.95), SZ);  // the robe: the hem, three stages narrowing
      [[-0.13, SOAPD], [-0.045, SOAPL], [0.045, SOAPD], [0.13, SOAPL]].forEach(([x, c]) => box(g, 0.075, 1.1, 0.03, c, SX + x, Y(0.16), SZ + 0.115));           // folds down its front
      box(g, 0.35, 0.32, 0.2, SOAPL, SX, Y(1.3), SZ);                                                                                                           // the chest and shoulders
      const sleeve = (s: number) => new THREE.ExtrudeGeometry(new THREE.Shape([[0.17, 1.612], [0.694, 1.535], [0.694, 1.47], [0.56, 1.28], [0.17, 1.28]].map(([x, y]) => new THREE.Vector2(s * x, Y(y)))), { depth: 0.15, bevelEnabled: false }).translate(0, 0, -0.075);  // a sleeve in profile: the top sloping to the wrist, a flat hem, the cuff cut steeply back up to the wrist
      for (const s of [-1, 1]) {                                                                                                                                // an arm either side: the sleeve, then the thin hand past its cuff
        part(g, sleeve(s), 0, mat(SOAP), SX, 0, SZ);
        box(g, 0.14, 0.065, 0.085, SOAPL, SX + s * 0.75, Y(1.47), SZ); box(g, 0.12, 0.05, 0.075, SOAP, SX + s * 0.88, Y(1.475), SZ); box(g, 0.07, 0.035, 0.04, SOAPL, SX + s * 0.74, Y(1.535), SZ + 0.025);  // the hand: palm, fingers, thumb on top
      }
      box(g, 0.1, 0.1, 0.1, SOAPD, SX, Y(1.6), SZ); box(g, 0.18, 0.22, 0.17, SOAP, SX, Y(1.67), SZ); box(g, 0.2, 0.05, 0.19, SOAPD, SX, Y(1.86), SZ - 0.005);   // the neck, the head, the hair on top
      for (const s of [-1, 1]) box(g, 0.035, 0.27, 0.18, SOAPD, SX + s * 0.11, Y(1.6), SZ - 0.01);                                                              // long locks down to the shoulders
      box(g, 0.14, 0.02, 0.02, SOAPDD, SX, Y(1.8), SZ + 0.09); box(g, 0.03, 0.08, 0.03, SOAPL, SX, Y(1.7), SZ + 0.095); box(g, 0.1, 0.1, 0.05, SOAPD, SX, Y(1.58), SZ + 0.08);  // the brow, the nose, the beard
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
} satisfies ModelDef;
