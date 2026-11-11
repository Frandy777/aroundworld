import * as THREE from 'three';
import { box, cyl, decal, final, mat, part, stone, GOLD, type ModelDef } from '../../builder';

export default {
  key: 'Jerusalem',
  props: [ // Dome of the Rock: the octagonal shrine in marble and blue Ottoman tile, a frieze of white script under its battlements, a porch on three of its faces and a gilded dome on its windowed drum under a crescent; on the limestone platform of the Temple Mount, with its stair, a free-standing arch at each front corner, the Dome of the Chain, cypresses, olives, pilgrims and doves
    final((g) => {
      const [CX, CZ, PY] = [0, -0.2, 0.236];                                                                                                                    // the shrine's centre line, the top of the platform it stands on
      const A = (12 / 44) * (1 + Math.SQRT2), C8 = Math.cos(Math.PI / 8), Y0 = PY + 0.09, DY = Y0 + 0.63;                                                       // the octagon's apothem (a side is 12 texels), cos 22.5°, the foot of its walls, the foot of the drum
      const PLAZA = 0xd5c9ab, DECK = 0xe6dabb, TRIM = 0xf4eedb, MARBLE = 0xf0e9d4, BLUE = 0x2b68d4, LEAD = 0x8e97ab, LEAD2 = 0xa9b1c4, DGOLD = 0xf0a020, GLASS = 0x1a2250, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;  // paints: plaza and platform limestone, trim and marble, tile blue, lead in two tones, the dome's darker gold, the windows' shade, trunks, white
      const CYPRESS = [0x1f5a3a, 0x2a6e45, 0x35804f], OLIVE = [0x6f8f5a, 0x8aa86c, 0xa3bf86];                                                                   // the greens of the cypresses and of the olive leaves, dark to light
      const FACE = [                                                                                                                                            // an octagon's face, 12 x 11 texels: a frieze of white script on navy, three tiled windows over a string course, three marble panels
        'eaaeaeaaeaae', 'eeaeaaeeaeea',
        'LuaaLaauaaLu', 'uLOOuOOLOOuL', 'LueOLeOueOLu', 'uLeOueOLeOuL', 'LuaaLaauaaLu',
        'xxxxxxxxxxxx', 'xxbaxbaxbaxx', 'xxbaxbaxbaxx', 'aaaaaaaaaaaa',
      ];
      const PORTAL = ['..xxx..', '.xOOOx.', 'xxOOOxx', 'xOOOOOx', 'xOOYOOx', 'xOOOOOx', 'xOOOOOx'];                                                             // a porch's pointed doorway
      const OCT = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, Math.PI / 8), ROUND = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, Math.PI / 16);       // unit slabs with a flat face to the front: an octagon, a 16-gon
      const ARCH = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(-0.22, 0).lineTo(-0.22, 0.26).quadraticCurveTo(-0.16, 0.42, 0, 0.58).quadraticCurveTo(0.16, 0.42, 0.22, 0.26).lineTo(0.22, 0).lineTo(0.14, 0).lineTo(0.14, 0.26).quadraticCurveTo(0.1, 0.36, 0, 0.47).quadraticCurveTo(-0.1, 0.36, -0.14, 0.26).lineTo(-0.14, 0), { depth: 0.08, bevelEnabled: false });  // a free-standing pointed arch, 0.44 wide and 0.58 tall: the outline of a lancet, extruded
      const MOON = new THREE.TorusGeometry(0.1, 0.024, 4, 10, 4.7);                                                                                             // the finial's crescent: a ring open at the top
      const at = (a: number, r: number, t = 0) => [CX + Math.sin(a) * r + Math.cos(a) * t, CZ + Math.cos(a) * r - Math.sin(a) * t];                                             // the point r out from the shrine's axis at angle a from the south, t along the face's tangent
      const oct = (a: number, h: number, c: number, y: number) => { part(g, OCT, h, mat(c), CX, y, CZ).scale.set(a / C8, h, a / C8); };                                                         // an octagonal slab of apothem a, on the shrine's axis
      const disc = (r: number, h: number, c: number, y: number, x = CX, z = CZ) => { part(g, ROUND, h, mat(c), x, y, z).scale.set(r, h, r); };                                                  // a round slab of radius r
      const porch = (a: number) => { const [x, z] = at(a, A + 0.06), [px, pz] = at(a, A + 0.162); stone(g, 0.318, 0.318, 0.2, MARBLE, x, Y0, z).rotation.y = a; box(g, 0.41, 0.04, 0.28, LEAD, x, Y0 + 0.318, z).rotation.y = a; decal(g, PORTAL, px, Y0, pz).rotation.y = a; };  // the porch on the face at angle a: a marble block, its lead roof, the doorway
      stone(g, 2.4, 0.1, 1.9, PLAZA);                                                                                                                           // the plaza
      stone(g, 2.2, 0.136, 1.6, DECK, 0, 0.1, -0.1);                                                                                                            // the platform of the mount, flagged in limestone
      [0, 1, 2].forEach((k) => stone(g, 0.64, 0.0455 * (k + 1), 0.083, DECK, CX, 0.1, 0.9075 - 0.083 * k));                                                    // its stair: three steps
      oct(A + 0.09, 0.045, PLAZA, PY); oct(A + 0.045, 0.045, 0xe6dcc3, PY + 0.045);                                                                             // the shrine's plinth, two steps
      oct(A, 0.182, MARBLE, Y0); oct(A, 0.318, BLUE, Y0 + 0.182); oct(A + 0.04, 0.045, TRIM, Y0 + 0.5);                                                         // the walls: marble below, blue tile above; the cornice
      [0, 1, -1, 2, -2].forEach((k) => { const a = (k * Math.PI) / 4, [x, z] = at(a, A + 0.015); decal(g, FACE, x, Y0, z).rotation.y = a; });                  // the tiled face to the south, the two beside it and the two to east and west
      for (let k = 0; k < 8; k++) for (const t of [-0.19, 0, 0.19]) { const a = (k * Math.PI) / 4, [x, z] = at(a, A + 0.01, t); box(g, 0.09, 0.08, 0.05, TRIM, x, Y0 + 0.545, z).rotation.y = a; }  // the battlements: three merlons on each side
      oct(A - 0.04, 0.045, LEAD, Y0 + 0.545); oct(A - 0.15, 0.04, LEAD2, Y0 + 0.59);                                                                            // the lead roof, in two steps
      [0, Math.PI / 2, -Math.PI / 2].forEach(porch);                                                                                                           // the porches: south, east and west
      disc(0.4, 0.3, BLUE, DY); disc(0.44, 0.03, DGOLD, DY + 0.3);                                                                                              // the drum, its gold band
      for (let k = -4; k <= 4; k++) { const a = (k * Math.PI) / 8, [x, z] = at(a, 0.397); box(g, 0.06, 0.14, 0.03, GLASS, x, DY + 0.08, z).rotation.y = a; }    // nine of its sixteen windows
      Array.from({ length: 14 }, (_, i) => 0.42 * Math.sqrt(1 - ((i + 0.5) / 14) ** 2.4)).forEach((r, i) => disc(r, 0.04, i & 1 ? 0xf6c534 : GOLD, DY + 0.33 + i * 0.04));  // the dome: fourteen slices of a flattened hemisphere, in two golds
      box(g, 0.03, 0.14, 0.03, GOLD, CX, DY + 0.87, CZ); disc(0.045, 0.05, GOLD, DY + 0.97); part(g, MOON, 0, mat(0xfff6b0), CX, DY + 1.12, CZ).rotation.z = Math.PI / 2 + (2 * Math.PI - 4.7) / 2;  // the finial: a mast, its ball and the crescent opening upward
      for (const s of [-1, 1]) part(g, ARCH, 0, mat(TRIM), s * 0.88, PY, 0.58);                                                                                 // an arch at each front corner of the platform
      const [DX, DZ] = [0.92, 0.26];                                                                                                                            // the Dome of the Chain: its centre
      disc(0.16, 0.04, TRIM, PY, DX, DZ); disc(0.15, 0.03, TRIM, PY + 0.2, DX, DZ);                                                                             // its base and its entablature
      for (let k = 0; k < 8; k++) box(g, 0.03, 0.16, 0.03, TRIM, DX + Math.sin((k * Math.PI) / 4) * 0.13, PY + 0.04, DZ + Math.cos((k * Math.PI) / 4) * 0.13);  // eight slim columns
      [0.15, 0.135, 0.105, 0.06].forEach((r, i) => disc(r, 0.04, i & 1 ? LEAD2 : LEAD, PY + 0.23 + i * 0.04, DX, DZ)); box(g, 0.02, 0.07, 0.02, GOLD, DX, PY + 0.39, DZ);  // its lead dome and finial
      const cypress = (x: number, z: number, h: number) => [0.08, 0.1, 0.1, 0.085, 0.06, 0.03].forEach((r, i) => cyl(g, (r * h) / 0.9, h / 6, CYPRESS[i % 3], x, PY + (i * h) / 6, z));  // a cypress h tall: six tiers of a dark flame
      cypress(-0.95, -0.5, 1); cypress(-0.97, 0.12, 0.75); cypress(1, -0.55, 0.9);                                                                              // three of them either side of the shrine
      const olive = (x: number, z: number) => { box(g, 0.05, 0.16, 0.05, WOOD, x, 0.1, z); [[0.15, 0.11], [0.12, 0.09], [0.08, 0.08]].forEach(([r, h], i) => cyl(g, r, h, OLIVE[i], x, 0.2 + i * 0.08, z)); };  // an olive: a trunk, three tiers of silver-green leaves
      olive(-1.06, 0.84); olive(1.06, 0.84);                                                                                                                    // one at each front corner of the plaza
      const pilgrim = (x: number, z: number, c: number) => { box(g, 0.07, 0.11, 0.06, c, x, PY, z); box(g, 0.05, 0.05, 0.05, 0xf5b88c, x, PY + 0.11, z); box(g, 0.056, 0.02, 0.056, c, x, PY + 0.15, z); };  // a pilgrim: body, head and cap
      pilgrim(-0.45, 0.55, 0x3b5dc9); pilgrim(0.5, 0.5, 0xf4f6fa);                                                                                              // two on the platform, one in blue and one in white
      const dove = (x: number, z: number) => { box(g, 0.07, 0.04, 0.04, WHITE, x, PY, z); box(g, 0.03, 0.03, 0.03, WHITE, x + 0.045, PY + 0.03, z); };                          // a dove: body and head
      dove(-0.6, 0.62); dove(0.62, 0.56); dove(0.2, 0.66);                                                                                                      // three of them
    }),
  ],
} satisfies ModelDef;
