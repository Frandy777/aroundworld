import * as THREE from 'three';
import { box, cyl, decal, final, glass, hip, lamplit, mat, part, rnd, stone, GOLD, INK, IRON, type ModelDef } from '../../builder';
import { canvas, shade } from '../../art';
import { DENSITY, pixelTexture, toon } from '../../scene';

// The face of the Western Wall (see `levels`), WW x WH texels on the world's own grid: golden limestone laid in five courses that grow from the top down, as they do in the wall itself: small stones two rows tall under the coping, the big dressed blocks of Herod's masons five rows tall at its foot.
// Each stone is lit along its top and left edge and shaded along its bottom and right, so that it stands proud of its joints; capers root in some of the joints and notes of prayer are pushed into others. Drawn twice: the day's, and the night's, which is the emissive map (the same stone, dim: the floodlights on it)
const WW = 24, WH = 16, STONES = [0xdcbf86, 0xd4b57a, 0xe1c48c, 0xcfae70], COURSES = [[2, 5], [2, 6], [3, 7], [4, 9], [5, 12]];  // the stones' golds; the courses from the top, each [rows, a stone's usual width]
const face = (night: boolean) => pixelTexture(canvas(WW, WH, (g) => {
  const at = (c: number, k: number, x: number, y: number, w = 1, h = 1) => { g.fillStyle = shade(c, k * (night ? 0.3 : 1)); g.fillRect(x, y, w, h); };                  // a rectangle of c, k times as bright
  let y = 0;
  COURSES.forEach(([h, sw], c) => {
    let x = -Math.floor(rnd(c, 9) * sw);                                                                                                                                    // the first stone starts off the edge by a different amount in every course, so that the joints stagger
    for (let k = 0; x < WW; k++) {
      const w = Math.max(3, Math.round(sw * (0.7 + 0.6 * rnd(c, k)))), s = STONES[Math.floor(rnd(c, k, 1) * STONES.length)], x0 = Math.max(x, 0), x1 = Math.min(x + w, WW);
      at(s, 1, x0, y, x1 - x0, h); at(s, 1.15, x0, y, x1 - x0, 1); if (x >= 0) at(s, 1.15, x0, y, 1, h);                                                                    // the stone, lit along its top and left edge
      at(s, 0.75, x0, y + h - 1, x1 - x0, 1); if (x + w <= WW) at(s, 0.75, x1 - 1, y, 1, h);                                                                               // shaded along its bottom and right
      x += w;
    }
    y += h;
  });
  [[4, 7], [10, 4], [15, 7], [20, 11], [7, 11]].forEach(([x, j]) => { at(0x3f7d3a, 1, x, j - 1, 2, 1); at(0x6fb552, 1, x + 1, j - 2); });                                            // capers: a dark tuft in a joint and its bright tip
  [[3, 9], [8, 13], [12, 10], [17, 14], [21, 12], [6, 14]].forEach(([x, j]) => at(0xfffaf0, 1, x, j));                                                                     // notes of prayer in the cracks
}));
const FACE = toon(0xffffff, { map: face(false), emissive: 0xffffff, emissiveMap: face(true) });                                                                             // the wall's material: the stone by day, the floodlit stone after dusk (see `nightlit`)
// A worshipper on a plaza whose top is y, in a coat of colour c, a head and a black hat; leaning forward (negative: toward the wall) by `lean` from the feet
const person = (g: THREE.Group, x: number, y: number, z: number, c: number, lean = 0) => {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.x = lean; g.add(p);
  box(p, 0.07, 0.11, 0.05, c); box(p, 0.05, 0.045, 0.05, 0xf5b88c, 0, 0.11); box(p, 0.08, 0.015, 0.075, INK, 0, 0.15); box(p, 0.05, 0.03, 0.05, INK, 0, 0.165);       // coat, head, the brim and the crown of the hat
};

export default {
  key: 'Jerusalem',
  lamps: [{ at: [0, 0.95, 0.75], color: 0xffc870, power: 4, reach: 6.5, final: true }], // the floodlights of the Temple Mount, in front of the shrine's south porch
  props: [ // Dome of the Rock: the octagonal shrine in marble and blue Ottoman tile, a frieze of white script under its battlements, a porch on three of its faces and a gilded dome on its windowed drum under a crescent; on the limestone platform of the Temple Mount, with its stair, a free-standing arch at each front corner, the Dome of the Chain, cypresses, olives, pilgrims and doves; the apron in front of the plaza is left bare for the upgrades (see `levels`)
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
      const disc = (r: number, h: number, c: number | THREE.Material, y: number, x = CX, z = CZ) => { part(g, ROUND, h, typeof c === 'number' ? mat(c) : c, x, y, z).scale.set(r, h, r); }; // a round slab of radius r
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
      for (let k = -4; k <= 4; k++) { const a = (k * Math.PI) / 8, [x, z] = at(a, 0.397); box(g, 0.06, 0.14, 0.03, GLASS, x, DY + 0.08, z, glass(GLASS, 0xffd9a0, 0.9)).rotation.y = a; } // nine of its sixteen windows
      Array.from({ length: 14 }, (_, i) => 0.42 * Math.sqrt(1 - ((i + 0.5) / 14) ** 2.4)).forEach((r, i) => disc(r, 0.04, lamplit(i & 1 ? 0xf6c534 : GOLD, 0xffcf60, 0.55), DY + 0.33 + i * 0.04)); // the dome: fourteen slices of a flattened hemisphere, in two golds
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
  levels: [ // the shrine stands at every level; each upgrade adds a landmark of Jerusalem on the apron in front of its plaza: the Western Wall on the right, the Church of the Holy Sepulchre on the left; each has its own plaza, inset from the apron's edge so that the owner's colour frames them
    [ // Lv 1, the Western Wall: a tall wall of golden limestone, the big dressed blocks of Herod at its foot and ever smaller stones above, capers in its joints and notes of prayer in its cracks, under a coping; on a plaza of pale paving, worshippers in black coats and hats with their backs to us, one of them leaning on the stones, a low barrier between the two sides of the plaza and a floodlight at each of its front corners (after dusk the wall is floodlit)
      final((g) => {
        const [X, Z, Y, W, H] = [0.575, 1.08, 0.1, WW / DENSITY, WH / DENSITY];                                                                                                 // the wall's centre line and depth line, the top of its plaza, its size (whole texels, so that its drawing is on the world's grid)
        const PAVE = 0xd0c2a0, HONEY = 0xd4b57a, COPING = 0xe6cf9c, BULB = 0xfff6b0, BLUE = 0x3b5dc9, WHITE = 0xf4f6fa;                                                         // paints: paving, the wall's plain sides, its coping, a lamp's bulb, the colours of the coats
        stone(g, 1.12, 0.1, 0.75, PAVE, 0.56, 0, 1.325);                                                                                                                        // the plaza, level with the Temple Mount's and joined to it and to the forecourt of the church
        const side = mat(HONEY);
        box(g, W, H, 0.14, HONEY, X, Y, Z, [side, side, side, side, FACE, side]); box(g, W + 0.02, 0.02, 0.17, COPING, X, Y + H, Z);                                            // the wall, its face drawn (see `face`), its coping
        ([[0.15, 1.2, INK], [0.28, 1.22, WHITE, -0.1], [0.41, 1.2, INK], [0.53, 1.21, INK, -0.12], [0.64, 1.2, WHITE], [0.88, 1.2, BLUE], [1, 1.21, WHITE], [0.22, 1.38, INK], [0.47, 1.4, INK], [0.9, 1.4, BLUE], [1.04, 1.37, INK]] as [number, number, number, number?][])
          .forEach(([x, z, c, lean]) => person(g, x, Y, z, c, lean));                                                                                                           // the worshippers along the wall, a second row behind them; the men to the left of the barrier, the women to the right
        for (const z of [1.25, 1.43, 1.61]) box(g, 0.02, 0.17, 0.02, IRON, 0.75, Y, z); box(g, 0.02, 0.02, 0.4, IRON, 0.75, Y + 0.17, 1.43); box(g, 0.015, 0.015, 0.4, IRON, 0.75, Y + 0.08, 1.43);  // the barrier: three posts, a top rail and a lower one
        for (const x of [0.1, 1.06]) { box(g, 0.025, 0.6, 0.025, IRON, x, Y, 1.62); box(g, 0.1, 0.04, 0.06, INK, x, Y + 0.6, 1.62); box(g, 0.08, 0.02, 0.03, BULB, x, Y + 0.58, 1.6); }  // a floodlight at each front corner: its pole, its head, the lamp under it
      }),
    ],
    [ // Lv 2, the Church of the Holy Sepulchre: a pale limestone façade under a lead roof, with two round-arched portals under two windows in frames, the Crusader bell tower at its left corner under a lead roof and a gold cross, and rising behind it the great lead dome of the Rotunda over its windowed drum and the smaller dome of the Katholikon, each with a lantern and a gold cross; pilgrims on the forecourt (after dusk the windows are lit)
      final((g) => {
        const [TX, FX, Z, Y, RX, RZ, KX, KZ] = [-0.99, -0.55, 1.36, 0.1, -0.68, 1, -0.33, 1.06];                                                                                // the tower's and the façade's centre lines, their depth line, the top of the plaza; the centres of the Rotunda and the Katholikon behind them
        const STONE = 0xe9e1cd, TRIM = 0xf3ecdb, LEAD = 0x8e97ab, LEAD2 = 0xa9b1c4, PAVE = 0xd0c2a0, GLASS = 0x1a2250, BULB = 0xfff6b0;                                         // paints: the church's stone and its pale trim, the lead in two tones, paving, the windows' glass, a lamp's bulb
        const win = glass(GLASS, 0xffd9a0, 0.9); // a window's glass: dark by day, lit warm after dusk
        const PORTALS = ['..xxxx....xxxx..', ...Array(6).fill('.xOOOOx..xOOOOx.')];                                                                                             // the façade's two portals: a pale arch round a dark door, 16 x 7 texels
        const ROUND = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, Math.PI / 16);                                                                                          // a unit 16-gon slab, a flat face to the front
        const disc = (r: number, h: number, c: number, x: number, y: number, z: number) => { part(g, ROUND, h, mat(c), x, y, z).scale.set(r, h, r); };                          // a round slab of radius r
        const cross = (x: number, y: number, z: number) => { box(g, 0.02, 0.12, 0.02, GOLD, x, y, z); box(g, 0.07, 0.02, 0.02, GOLD, x, y + 0.07, z); };                        // a gold cross standing on y
        const dome = (x: number, z: number, y: number, R: number, n: number, k: number) => {                                                                                    // a dome of n slices k tall, a flattened hemisphere of radius R on y, in two tones of lead, its lantern and its cross
          for (let i = 0; i < n; i++) disc(R * Math.sqrt(1 - ((i + 0.5) / n) ** 2.4), k, i & 1 ? LEAD2 : LEAD, x, y + i * k, z);
          disc(R * 0.22, 0.07, TRIM, x, y + n * k, z); cross(x, y + n * k + 0.07, z);
        };
        const ring = (x: number, z: number, y: number, r: number, n: number, w: number, h: number) => { for (let k = 0; k < n; k++) { const a = (k * 2 * Math.PI) / n; box(g, w, h, 0.025, GLASS, x + Math.sin(a) * r, y, z + Math.cos(a) * r, win).rotation.y = a; } }; // n windows round a drum, each facing out
        stone(g, 1.12, 0.1, 0.75, PAVE, -0.56, 0, 1.325);                                                                                                                       // the forecourt, level with the wall's plaza and the Temple Mount's
        stone(g, 0.727, 0.62, 0.3, STONE, FX, Y, Z); box(g, 0.77, 0.035, 0.34, TRIM, FX, Y + 0.585, Z); box(g, 0.69, 0.02, 0.26, LEAD2, FX, Y + 0.62, Z); box(g, 0.75, 0.022, 0.02, TRIM, FX, Y + 0.33, Z + 0.16);  // the façade, its cornice, the lead roof inside it, the string course between its portals and windows
        decal(g, PORTALS, FX, Y, Z + 0.16);                                                                                                                                     // its two portals
        for (const s of [-1, 1]) { const x = FX + s * 0.182; box(g, 0.115, 0.2, 0.02, TRIM, x, Y + 0.37, Z + 0.155); box(g, 0.08, 0.12, 0.02, GLASS, x, Y + 0.4, Z + 0.165, win); box(g, 0.05, 0.03, 0.02, GLASS, x, Y + 0.52, Z + 0.165, win); } // over each portal a window in a frame, its head stepped
        stone(g, 0.23, 0.7, 0.23, STONE, TX, Y, Z); box(g, 0.26, 0.025, 0.26, TRIM, TX, Y + 0.7, Z); stone(g, 0.21, 0.2, 0.21, STONE, TX, Y + 0.725, Z); box(g, 0.26, 0.03, 0.26, TRIM, TX, Y + 0.925, Z);  // the bell tower: its shaft, a string course, the belfry, its cornice
        for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, [sx, sz] = [Math.sin(a), Math.cos(a)]; box(g, 0.09, 0.12, 0.02, GLASS, TX + sx * 0.11, Y + 0.76, Z + sz * 0.11, win).rotation.y = a; box(g, 0.03, 0.14, 0.02, GLASS, TX + sx * 0.115, Y + 0.35, Z + sz * 0.115, win).rotation.y = a; } // on each side an opening of the belfry and a slit in the shaft
        hip(g, 0.25, 0.25, 0.16, Y + 0.955, LEAD, TX, Z); cross(TX, Y + 1.115, Z);                                                                                              // its roof, its cross
        disc(0.26, 0.6, STONE, RX, Y, RZ); disc(0.28, 0.03, TRIM, RX, Y + 0.6, RZ); disc(0.23, 0.13, STONE, RX, Y + 0.63, RZ); ring(RX, RZ, Y + 0.66, 0.23, 12, 0.04, 0.07); dome(RX, RZ, Y + 0.76, 0.23, 9, 0.037);  // the Rotunda: its wall, its cornice, the drum with twelve windows, the dome
        disc(0.16, 0.5, STONE, KX, Y, KZ); disc(0.175, 0.025, TRIM, KX, Y + 0.5, KZ); disc(0.14, 0.09, STONE, KX, Y + 0.525, KZ); ring(KX, KZ, Y + 0.54, 0.14, 8, 0.035, 0.05); dome(KX, KZ, Y + 0.615, 0.14, 6, 0.03);  // the Katholikon: the same, smaller
        person(g, -0.86, Y, 1.62, INK); person(g, -0.55, Y, 1.64, 0x3b5dc9); person(g, -0.28, Y, 1.62, 0xf4f6fa);                                                               // pilgrims on the forecourt
        for (const x of [-1.06, -0.08]) { box(g, 0.02, 0.2, 0.02, IRON, x, Y, 1.64); box(g, 0.05, 0.05, 0.05, BULB, x, Y + 0.2, 1.64); }                                        // a lamp at each front corner of it
      }),
    ],
  ],
} satisfies ModelDef;
