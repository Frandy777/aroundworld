import * as THREE from 'three';
import { box, cyl, decal, final, mat, part, prism, prismMat, sprite, stone, GOLD, IRON, INK, type Prop } from '../builder';

// The special cities' landmarks, each a monument of its own (keyed by city name, see buildProps)
export const LANDMARK_PROPS: Record<string, Prop[]> = {
  Singapore: [ // the Merlion: a white lion-headed fish on a round pedestal in a pool, a spiked mane round its face, its tail curled up behind, spouting water from its mouth
    final((g) => {
      const WHITE = 0xffffff, PALE = 0xe4eaf5, FACE = 0xfff3d6, MANE = 0xa9b8d6, SPIKE = 0xd0daee, GREY = 0xb4bccf, WATER = 0x4da3ff, JET = 0x9fd8ff, FOAM = 0xdcefff, hx = -0.25, zc = -0.15, zf = zc + 0.25; // hx, zc: the statue's centre line; zf: the front of its face
      const disc = (p: THREE.Group, r: number, t: number, c: number, x: number, y: number, z: number) => { cyl(p, r, t, c, x, y - t / 2, z).rotation.x = Math.PI / 2; };                                                                                                        // a cylinder facing the viewer, centred at height y
      box(g, 2.4, 0.14, 1.8, 0xb9b2a0); box(g, 2.12, 0.08, 1.52, WATER, 0, 0.14);                                                                                                                                // foundation, the pool
      for (const [w, d, x, z] of [[2.4, 0.14, 0, 0.83], [2.4, 0.14, 0, -0.83], [0.14, 1.52, -1.13, 0], [0.14, 1.52, 1.13, 0]]) box(g, w, 0.12, d, 0xe8e2d2, x, 0.14, z);                                       // its curb
      cyl(g, 0.66, 0.03, FOAM, hx + 0.15, 0.22, zc); cyl(g, 0.58, 0.2, GREY, hx + 0.15, 0.22, zc); cyl(g, 0.48, 0.16, PALE, hx + 0.15, 0.42, zc);                                                            // the pedestal in its ring of foam, in two steps
      for (let i = 0; i < 14; i++) cyl(g, 0.3 + 0.13 * Math.sin((Math.PI * (i + 2)) / 16), 0.12, i & 1 ? PALE : WHITE, hx, 0.58 + i * 0.12, zc);                                                                  // the fish: rings of scales, plump at the belly, slim at the neck
      for (let j = 0; j < 9; j++) cyl(g, 0.2 - j * 0.011, 0.15, j & 1 ? PALE : WHITE, hx + 0.37 + 0.55 * Math.sin((j * Math.PI) / 12), 0.62 + j * 0.15, zc - 0.1);                                              // the tail, curling out and back up behind
      disc(g, 0.18, 0.1, WHITE, hx + 0.85, 2.05, zc - 0.1); for (const s of [-1, 1]) box(g, 0.22, 0.6, 0.1, PALE, hx + 0.85 + s * 0.14, 2.08, zc - 0.1).rotation.z = -s * 0.5;                                 // its fin, forked in a V
      const head = new THREE.Group(); head.position.set(hx, 2.66, zc + 0.035); head.rotation.x = -0.45; g.add(head);                                                                                            // the head, tipped back to look up at the water it spouts
      const bx = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => box(head, w, h, d, c, x, y - h / 2, z);                                                                                                                               // a box centred on x, y, z in the head's own frame
      disc(head, 0.55, 0.3, MANE, 0, -0.1, -0.25);                                                                                                                                                              // the mane: a dark base, under a ring of pointed locks
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k & 1 ? 0.5 : 0.56; bx(0.3, 0.3, k & 1 ? 0.16 : 0.2, k & 1 ? PALE : SPIKE, r * Math.sin(a), r * Math.cos(a) - 0.1, -0.1).rotation.z = Math.PI / 4 - a; } // diamonds turned point-out, long and short in turn
      disc(head, 0.36, 0.2, FACE, 0, 0, 0); bx(0.44, 0.3, 0.14, WHITE, 0, -0.21, 0.17);                                                                                                                         // the face, the muzzle
      for (const s of [-1, 1]) { bx(0.1, 0.09, 0.03, INK, s * 0.15, 0.07, 0.1); bx(0.24, 0.07, 0.04, IRON, s * 0.15, 0.19, 0.1).rotation.z = s * 0.4; bx(0.05, 0.07, 0.05, WHITE, s * 0.125, -0.225, 0.27); }  // eyes, frowning brows, fangs
      bx(0.26, 0.09, 0.05, INK, 0, -0.08, 0.25); bx(0.05, 0.1, 0.05, INK, 0, -0.17, 0.25); bx(0.36, 0.14, 0.05, INK, 0, -0.26, 0.25);                                                                           // a broad nose, the line down from it, the open mouth
      box(g, 0.1, 0.1, 0.2, JET, hx, 2.5, zf + 0.17); box(g, 0.1, 0.1, 0.14, JET, hx, 2.4, zf + 0.31); box(g, 0.1, 2.18, 0.1, JET, hx, 0.22, zf + 0.43);                                                      // the water: out of the mouth, then falling
      box(g, 0.34, 0.05, 0.26, FOAM, hx, 0.22, zf + 0.45);                                                                                                                                                       // its splash
    }),
  ],
  'Hong Kong': [ // Bank of China Tower: four glass prisms stepping up to twin masts on a granite podium with flags, a rock garden with a red bridge over its pond, and Victoria Harbour with a red-sailed junk and a Star Ferry
    final((g) => {
      const HW = 0.6, MOD = 1.1, RISE = 0.5, TX = -0.4, TZ = -0.35, BASE = 0.44, RED = 0xd9423e, WHITE = 0xf4f6fa, GREEN = 0x2f8f5a, WOOD = 0x6e3a12, TAR = 0x3a2008, PANE = 0xe8edf6, ROCK = 0x8a8f9c, SHRUB = 0x4f9d4f; // the prisms' half-width, storey module and roof rise, the tower's centre and base height; paints
      const disc = (p: THREE.Group, r: number, t: number, c: number, x: number, y: number, z: number) => { cyl(p, r, t, c, x, y - t / 2, z).rotation.x = Math.PI / 2; };                                               // a cylinder facing the viewer, centred at height y
      const peak = (d: number) => BASE + 4 * MOD + (RISE * (HW - d)) / HW;                                                                                         // the tallest roof's height, d from the tower's centre line
      box(g, 2.4, 0.1, 1.9, 0x3a86e0); box(g, 2.4, 0.06, 1.42, 0xb9bdc8, 0, 0.1, -0.24); box(g, 2.4, 0.03, 0.05, 0xe6e9f0, 0, 0.16, 0.42);                   // the harbour, the plaza on it, its kerb
      box(g, 1.46, 0.14, 1.37, 0x8a92a3, -0.39, 0.16, -0.265); box(g, 1.34, 0.14, 1.27, 0xb3bac8, TX, 0.3, -0.315);                                         // the granite podium in two courses
      [[0, 1], [-Math.PI / 2, 2], [Math.PI, 3], [Math.PI / 2, 4]].forEach(([r, n]) => { part(g, prism(HW, n * MOD, RISE, MOD), 0, prismMat(HW, MOD), TX, BASE, TZ).rotation.y = r; }); // the four prisms, south, west, north, east: one module taller each
      box(g, 0.05, 1, 0.05, INK, TX + 0.1, peak(0.1) - 0.03, TZ); box(g, 0.05, 0.75, 0.05, INK, TX + 0.26, peak(0.26) - 0.03, TZ); box(g, 0.07, 0.07, 0.07, 0xff3b3b, TX + 0.1, peak(0.1) + 0.97, TZ); // the twin masts on the tallest roof, a beacon on the higher one
      box(g, 0.46, 0.34, 0.03, PANE, TX, BASE, 0.265); box(g, 0.36, 0.28, 0.03, 0x1d2c4d, TX, BASE, 0.285); box(g, 0.025, 0.28, 0.035, PANE, TX, BASE, 0.287); // the entrance: frame, dark glass doors, the bar between them
      disc(g, 0.075, 0.03, RED, TX, 0.89, 0.265); disc(g, 0.052, 0.04, 0xffffff, TX, 0.89, 0.265); box(g, 0.036, 0.036, 0.05, RED, TX, 0.872, 0.265);          // the bank's coin over it, between the braces: red disc, white ring, red square hole
      for (const d of [-0.31, 0.31]) { box(g, 0.16, 0.1, 0.07, 0x9aa1b0, TX + d, BASE, 0.285); box(g, 0.13, 0.1, 0.05, SHRUB, TX + d, BASE + 0.1, 0.285); }   // a planter either side of the entrance
      for (const x of [-1.04, 0.22]) { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.3, 0.37); box(g, 0.3, 0.18, 0.02, RED, x + 0.165, 1.02, 0.37); }                // a flagpole at each front corner of the podium, with a red flag
      box(g, 0.06, 0.06, 0.025, GOLD, -0.98, 1.14, 0.375); box(g, 0.025, 0.025, 0.025, GOLD, -0.91, 1.17, 0.375); box(g, 0.025, 0.025, 0.025, GOLD, -0.91, 1.1, 0.375); // the Chinese flag's stars
      box(g, 0.08, 0.08, 0.025, 0xffffff, 0.38, 1.07, 0.375);                                                                                                // the Hong Kong flag's bauhinia
      box(g, 0.6, 0.06, 0.44, 0xd8d2c0, 0.82, 0.16, -0.02); box(g, 0.5, 0.04, 0.34, 0x4da3ff, 0.82, 0.17, -0.02);                                           // the garden pond: stone coping, water
      [[0.26, 0.22, 0.2, 0.97, -0.34, ROCK], [0.2, 0.34, 0.16, 0.8, -0.38, 0x767b8a], [0.14, 0.16, 0.14, 0.62, -0.32, 0x9a9fac]].forEach(([w, h, d, x, z, c]) => box(g, w, h, d, c, x, 0.16, z)); // three rocks behind it
      box(g, 0.12, 0.12, 0.1, ROCK, 0.82, 0.5, -0.38); box(g, 0.06, 0.3, 0.02, 0xbfe6ff, 0.8, 0.2, -0.29);                                                   // a stone on the tallest rock, the waterfall down its front
      box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.68, 0.21, 0.04); box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.96, 0.21, 0.1);                                           // two goldfish
      box(g, 0.2, 0.04, 0.1, RED, 0.6, 0.22, -0.02); box(g, 0.22, 0.04, 0.1, RED, 1.04, 0.22, -0.02); box(g, 0.3, 0.04, 0.1, RED, 0.82, 0.26, -0.02); box(g, 0.62, 0.025, 0.02, 0xf4eedb, 0.82, 0.3, 0.03); // the red bridge over it: two ramps, the arch, a white rail
      box(g, 0.06, 0.3, 0.06, WOOD, 1.05, 0.16, -0.72); [[0.34, 0x2f7a4a], [0.26, 0x3f9a5c], [0.18, 0x4fb06a]].forEach(([w, c], i) => box(g, w, 0.16, w, c, 1.05, 0.4 + i * 0.14, -0.72)); // a pine: trunk, three tiers of needles
      box(g, 0.18, 0.14, 0.16, SHRUB, 0.45, 0.16, 0.3); box(g, 0.18, 0.14, 0.16, SHRUB, 1.08, 0.16, 0.36);                                                   // two shrubs
      const jx = -0.8;                                                                                                                                       // the junk's centre
      box(g, 0.68, 0.03, 0.21, TAR, jx, 0.1, 0.74); box(g, 0.66, 0.1, 0.2, WOOD, jx, 0.13, 0.74);                                                            // the junk: a tarred waterline, the hull
      box(g, 0.16, 0.2, 0.2, WOOD, jx + 0.25, 0.13, 0.74); box(g, 0.18, 0.03, 0.22, 0x8a5a2b, jx + 0.25, 0.33, 0.74); box(g, 0.1, 0.16, 0.18, WOOD, jx - 0.35, 0.13, 0.74); // the raised stern and its roof, the upturned bow
      [[-0.22, 0.5], [-0.03, 0.62], [0.16, 0.4]].forEach(([dx, h]) => {                                                                                       // three masts, each with a battened sail
        box(g, 0.025, h + 0.08, 0.025, TAR, jx + dx, 0.23, 0.74); box(g, 0.14, h, 0.03, RED, jx + dx + 0.055, 0.25, 0.74);                                  // the mast, the sail
        for (const k of [1, 2]) box(g, 0.14, 0.018, 0.035, 0x8a1f1f, jx + dx + 0.055, 0.25 + (k * h) / 3, 0.74);                                             // two battens across it
      });
      box(g, 0.08, 0.04, 0.015, GOLD, jx + 0.01, 0.93, 0.74);                                                                                                // a pennant at the main masthead
      const fx = 0.8;                                                                                                                                        // the ferry's centre
      box(g, 0.64, 0.1, 0.2, WHITE, fx, 0.1, 0.74); box(g, 0.65, 0.035, 0.205, GREEN, fx, 0.1, 0.74); box(g, 0.08, 0.1, 0.14, WHITE, fx + 0.35, 0.1, 0.74);   // the Star Ferry: hull, its green band, the narrow bow
      box(g, 0.52, 0.09, 0.17, WHITE, fx - 0.02, 0.2, 0.74); box(g, 0.46, 0.035, 0.02, INK, fx - 0.02, 0.23, 0.835);                                         // the main deck and its windows
      box(g, 0.42, 0.08, 0.15, WHITE, fx - 0.05, 0.29, 0.74); box(g, 0.36, 0.03, 0.02, INK, fx - 0.05, 0.32, 0.82);                                          // the upper deck and its windows
      box(g, 0.46, 0.025, 0.18, GREEN, fx - 0.05, 0.37, 0.74); box(g, 0.07, 0.1, 0.07, GREEN, fx + 0.03, 0.395, 0.74);                                       // the green roof, the funnel
      [[-0.3, 0.9], [0.1, 0.65], [-0.05, 0.86], [0.3, 0.55]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                           // ripples on the harbour
    }),
  ],
  Pyongyang: [ // Juche Tower: a tapering shaft of granite tiers with gold characters up its front, under a red glass torch on a gold collar; beside it the statue of the worker, peasant and intellectual raising hammer, sickle and brush; the Taedong in front with two fountains and a rowing boat
    final((g) => {
      const [TX, TZ, SX, SZ, FY, P] = [-0.26, -0.5, 0.76, 0.1, 5.05, 0.63];                                                                                    // the shaft's centre line, the statue's, the foot of the torch, the top of the statue's pedestal
      const WATER = 0x3a86e0, FOAM = 0xdcefff, JET = 0x9fd8ff, GREY = 0xd7d4cb, LIGHT = 0xf6f4ee, LEDGE = 0xe9e6dc, CRIMSON = 0xb13e53, RED = 0xe43b44, WOOD = 0x6e3a12, DGOLD = 0xf0a020, BRONZE = 0xa8673f, BRONZE2 = 0xc4824e; // paints
      const GLYPH: Record<number, string[]> = { 9: ['.Y..Y.Y', 'YYY.Y.Y', '.Y.YY.Y', '.Y..Y.Y', 'Y.Y.Y.Y', 'Y.Y.Y.Y'], 10: ['YYYYY', '..Y..', '.Y.Y.', 'YYYYY', '..Y..', '..Y..'] };         // 체 and 주, the gold characters on the front pier of the top two tiers
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.4, 0.14, 1.28, 0xd3d0c4, 0, 0.1, -0.31); box(g, 2.4, 0.03, 0.06, 0xf4eedb, 0, 0.24, 0.3); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.355); // the Taedong, the plaza on its bank, the kerb along it, foam at the quay wall
      box(g, 1.3, 0.07, 0.9, 0xe2dfd3, TX, 0.24, TZ); box(g, 1.1, 0.07, 0.78, 0xece9de, TX, 0.31, TZ);                                                         // two granite steps
      stone(g, 0.94, 0.32, 0.68, 0xe4e1d6, TX, 0.38, TZ); box(g, 1.02, 0.05, 0.76, LEDGE, TX, 0.7, TZ);                                                          // the base hall and its cornice
      box(g, 0.58, 0.3, 0.04, 0x3a3f4e, TX, 0.41, TZ + 0.35); decal(g, ['xtaSyxktaSb', 'aSxkytxaStx', 'tyaxbSxkaty', 'Sxktaxysbxa', 'kaSxyatxStb', 'xbtyaSkxyat'], TX, 0.435, TZ + 0.375); // the niche of the friendship plaques, a mosaic of them
      for (let i = 0; i < 11; i++) {                                                                                                                              // the shaft: eleven tiers, each a little narrower than the one below
        const w = 0.78 - 0.028 * i, y = 0.75 + i * 0.36;                                                                                                          // its width, its foot
        stone(g, w, 0.36, w, GREY, TX, y, TZ); stone(g, 0.62 * w, 0.32, 0.04, LIGHT, TX, y, TZ + w / 2); box(g, w + 0.1, 0.04, w + 0.1, LEDGE, TX, y + 0.32, TZ); // the tier's grey wings, the lighter pier up its front, the ledge that caps it
        if (GLYPH[i]) decal(g, GLYPH[i], TX, y + 0.045, TZ + w / 2 + 0.026);                                                                                      // its gold characters, on the pier
      }
      stone(g, 0.46, 0.26, 0.46, GREY, TX, 4.71, TZ); [-0.13, 0, 0.13].forEach((x) => box(g, 0.06, 0.14, 0.02, 0x2a3050, TX + x, 4.78, TZ + 0.23)); box(g, 0.56, 0.04, 0.56, LEDGE, TX, 4.97, TZ); // the viewing gallery with its slit windows, the last ledge
      cyl(g, 0.25, 0.05, DGOLD, TX, FY, TZ); cyl(g, 0.31, 0.08, GOLD, TX, FY + 0.05, TZ);                                                                         // the gold collar
      [0.15, 0.19, 0.21, 0.21, 0.2, 0.18, 0.155, 0.13, 0.105, 0.08, 0.057, 0.037, 0.02].forEach((r, i) => cyl(g, r, 0.085, [CRIMSON, RED, RED, 0xff3b3b, RED, 0xff3b3b, 0xff3b3b][i >> 1], TX + Math.max(0, i - 3) * 0.013, FY + 0.13 + i * 0.085, TZ)); // the torch: slices of red glass swelling, then licking up to the right, the upper ones glowing (unlit)
      box(g, 0.8, 0.07, 0.46, 0xd6d0c0, SX, 0.24, SZ); box(g, 0.68, 0.27, 0.36, 0xe9e4d6, SX, 0.31, SZ); box(g, 0.74, 0.05, 0.4, 0xcfc8b4, SX, 0.58, SZ);         // the statue's pedestal, in three courses
      const rod = (x: number, y: number, len: number, a: number, c: number) => { box(g, 0.045, len, 0.045, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, SZ).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; }; // a bar from (x, y) tipped a to the left: where its top end is
      const person = (x: number, s: number, a: number) => { const d = Math.sign(a); box(g, 0.13, 0.2 * s, 0.09, BRONZE, x, P, SZ); box(g, 0.18, 0.25 * s, 0.1, BRONZE, x, P + 0.2 * s, SZ); box(g, 0.1, 0.12 * s, 0.1, BRONZE2, x, P + 0.46 * s, SZ); box(g, 0.045, 0.2 * s, 0.07, BRONZE, x + d * 0.115, P + 0.22 * s, SZ); return rod(x - d * 0.09, P + 0.42 * s, 0.3, a, BRONZE); }; // a bronze figure s tall: legs, coat, head, one arm at his side, the other raised leaning a to the left (the tip of it returned)
      const [bx, by] = person(SX - 0.2, 1, 0.3), [hx, hy] = person(SX, 1.15, -0.08), [sx, sy] = person(SX + 0.2, 0.95, -0.3);                                    // the intellectual, the worker and the peasant, and their hands
      box(g, 0.06, 0.12, 0.06, 0x3b2418, bx - 0.015, by, SZ); box(g, 0.17, 0.08, 0.07, 0x7a4a28, hx, hy - 0.01, SZ);                                             // the brush, the hammer
      box(g, 0.13, 0.04, 0.04, 0x7a4a28, sx, sy + 0.08, SZ); box(g, 0.04, 0.1, 0.04, 0x7a4a28, sx + 0.045, sy - 0.02, SZ);                                       // the sickle: its curved back and its blade
      for (const x of [-0.95, 0.95]) {                                                                                                                            // a fountain in the river at each side
        cyl(g, 0.19, 0.012, FOAM, x, 0.1, 0.62); cyl(g, 0.12, 0.02, 0xffffff, x, 0.1, 0.62);                                                                      // the splash at its foot
        [[0.14, 0.26, FOAM], [0.1, 0.24, 0xffffff], [0.07, 0.22, FOAM], [0.05, 0.2, 0xffffff]].reduce((y, [w, h, c]) => { box(g, w, h, w, c, x, y, 0.62); return y + h - 0.02; }, 0.1); // the plume, thinning as it climbs
        box(g, 0.13, 0.04, 0.13, FOAM, x, 0.9, 0.62);                                                                                                             // the spray at its head
        [[0.09, 0.84], [0.19, 0.66]].forEach(([dx, y]) => [-1, 1].forEach((s) => box(g, 0.05, 0.07, 0.05, JET, x + s * dx, y, 0.62)));                           // the arcs of water falling to both sides
      }
      const [rx, rz] = [-0.2, 0.55];                                                                                                                              // the rowing boat's centre
      box(g, 0.4, 0.07, 0.14, 0x8a5a2b, rx, 0.1, rz); [-1, 1].forEach((s) => box(g, 0.06, 0.13, 0.1, 0x8a5a2b, rx + s * 0.22, 0.1, rz));                         // the hull and its upturned ends
      box(g, 0.08, 0.1, 0.07, 0xd9423e, rx - 0.02, 0.17, rz); box(g, 0.05, 0.05, 0.05, 0xf5b88c, rx - 0.02, 0.27, rz);                                           // the rower and his head
      [[0.45, 0.45], [-0.6, 0.5]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));                                                                // ripples
      [[-1.03, -0.7], [-1.03, -0.3]].forEach(([x, z]) => { box(g, 0.06, 0.3, 0.06, WOOD, x, 0.24, z); cyl(g, 0.2, 0.14, 0x2f7a4a, x, 0.5, z); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, z); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, z); }); // two trees on the plaza
    }),
  ],
  Zurich: [ // Grossmünster: twin sandstone towers on a plinth by the Limmat, each with a slate dome and gold cross, Charlemagne seated in a niche on the right one, a lattice window and the dark red ridge turret between them; swans and ripples on the river, lindens, lamps, and the flags of Zürich and Switzerland
    final((g) => {
      const W = 0.59, TX = 0.48, TZ = 0.02, R = (W + 0.06) / 2, FZ = TZ + W / 2;                                                                                // a tower: its width, its centre line (x either side of the middle, z), half a cornice, its front face
      const SAND = 0xd8cdb4, TRIM = 0xece4d0, DARK = 0xb4a78d, SLATE = 0x56627e, SLATE2 = 0x7280a0, ROOF = 0x8c6a42, MAROON = 0x7a1f35, DGOLD = 0xe0a020, WATER = 0x35a0b0, FOAM = 0xdcefff, PAVE = 0xcfc8b6, WOOD = 0x6e3a12, JET = 0x9fd8ff; // paints
      const gap = (n: number) => Array(n).fill('.............');                                                                                                        // n bare rows of a tower face
      const quoin = (rows: string[]) => rows.map((r) => 'x' + r.slice(1, 12) + 'x');                                                                                      // a pale pilaster up either edge of every row
      const SLIT = Array(4).fill('...O.....O...');                                                                                                              // the slit windows of the shaft
      const BELFRY = ['...O.....O...', ...Array(2).fill('..OdO...OdO..'), ...Array(5).fill('.OedeO.OedeO.'), 'xxxxxxxxxxxxx'];                                  // the belfry's pointed windows over a sill
      const UPPER = ['...O.....O...', ...Array(4).fill('..OeO...OeO..'), '.xxxxxxxxxxx.'];                                                                      // the upper stage's small windows over a sill
      const FRONT = quoin([...gap(5), ...UPPER, ...gap(8), ...BELFRY, ...gap(20), ...SLIT, ...gap(4)]);                                                         // a tower's face, top to foot: upper windows, belfry windows, slits, 56 rows
      const LANCET = ['....O....', ...Array(13).fill('.O.OdO.O.')];                                                                                             // the lancets round the octagon
      const KARL = ['.OOOOO.', '.OYOYO.', '.OYYYO.', '.OaaaO.', '.ObwbO.', 'YaaaaaO', '.ObbbO.', 'xxxxxxx', '.xxxxx.'];                                         // Charlemagne: crown, beard, sword across his lap, in his niche
      const LATTICE = ['.OOO.', ...Array(5).fill(['OabaO', 'ObabO']).flat(), 'OOOOO'];                                                                          // the diamond lattice of the big window
      const ZURICH = ['wwwwwww', 'LLwwwww', 'LLLwwww', 'LLLLLww', 'LLLLLLw'], SWISS = ['RRRRRR', 'RRwwRR', 'RwwwwR', 'RwwwwR', 'RRwwRR', 'RRRRRR'];             // the flags: Zürich's blue and white split on the diagonal, the Swiss white cross on red
      box(g, 2.4, 0.1, 1.9, WATER); stone(g, 2.4, 0.12, 1.5, PAVE, 0, 0.1, -0.2); box(g, 2.4, 0.07, 0.05, TRIM, 0, 0.22, 0.525); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.575); // the Limmat, the quay, its parapet, foam along the wall
      stone(g, 1.66, 0.08, 1.31, DARK, 0, 0.22, -0.295);                                                                                                        // the church's plinth
      for (const s of [-1, 1]) {                                                                                                                                // the twin towers; the south one (right) is the Karlsturm
        const x = s * TX; let y = 0.3;                                                                                                                          // this tower's centre line, the height built so far
        const up = (h: number, w = W, c = SAND, m = stone) => { m(g, w, h, w, c, x, y, TZ); y += h; };                                                                  // the next stage of the shaft: ashlar, or a plain box for a cornice
        decal(g, FRONT, x, y, FZ + 0.02);                                                                                                                       // its windows and pilasters
        up(1.2); up(0.06, W + 0.06, TRIM, box); up(0.72); up(0.06, W + 0.06, TRIM, box); up(0.5); up(0.05, W + 0.1, TRIM, box);                                 // shaft, cornice, belfry, cornice, upper stage, terrace slab
        [[W + 0.1, 0.04, 0, 1], [W + 0.1, 0.04, 0, -1], [0.04, W + 0.1, 1, 0], [0.04, W + 0.1, -1, 0]].forEach(([w, d, a, b]) => box(g, w, 0.1, d, TRIM, x + a * R, y, TZ + b * R)); // its balustrade
        [[0.205, SAND], [0.19, SAND]].forEach(([r, c], k) => { cyl(g, r, 0.33, c, x, y + 0.33 * k, TZ).rotation.y = Math.PI / 10; });                           // the octagonal stage, tapering
        decal(g, LANCET, x, y + 0.04, TZ + 0.2);                                                                                                                // its lancets
        y += 0.66; cyl(g, 0.235, 0.05, TRIM, x, y, TZ); y += 0.05;                                                                                              // the crown ring under the dome
        [0.215, 0.25, 0.255, 0.23, 0.18, 0.11, 0.05].forEach((r, i) => cyl(g, r, 0.06, i & 1 ? SLATE2 : SLATE, x, y + i * 0.06, TZ));                           // the dome: a stepped onion in slate
        y += 0.42; cyl(g, 0.015, 0.08, GOLD, x, y, TZ); cyl(g, 0.04, 0.05, GOLD, x, y + 0.06, TZ); box(g, 0.03, 0.14, 0.03, GOLD, x, y + 0.11, TZ); box(g, 0.1, 0.03, 0.03, GOLD, x, y + 0.18, TZ); // the gold post, ball and cross
      }
      decal(g, KARL, TX, 0.95, FZ + 0.02);                                                                                                                      // Charlemagne, seated in his niche on the south tower
      stone(g, 0.37, 0.9, 0.42, SAND, 0, 0.3, -0.01); decal(g, LATTICE, 0, 0.7, 0.22);                                                                          // the wall between the towers and its lattice window
      [0.37, 0.3, 0.23, 0.16, 0.09].forEach((w, i) => stone(g, w, 0.05, 0.42, SAND, 0, 1.2 + i * 0.05, -0.01));                                                 // its stepped gable
      stone(g, 1.52, 0.3, 0.73, SAND, 0, 0.3, -0.585);                                                                                                          // the nave and aisles behind
      [1.52, 1.3, 1.08].forEach((w, i) => box(g, w, 0.07, 0.73, ROOF, 0, 0.6 + i * 0.07, -0.585));                                                              // the aisle roofs
      stone(g, 0.74, 0.16, 0.73, SAND, 0, 0.81, -0.585);                                                                                                        // the clerestory
      [0.84, 0.62, 0.4, 0.18].forEach((w, i) => box(g, w, 0.08, 0.73, ROOF, 0, 0.97 + i * 0.08, -0.585));                                                       // the nave roof, stepped
      box(g, 0.16, 0.1, 0.16, TRIM, 0, 1.29, -0.5); box(g, 0.1, 0.12, 0.1, MAROON, 0, 1.39, -0.5); box(g, 0.14, 0.03, 0.14, DGOLD, 0, 1.51, -0.5);              // the ridge turret: base, lantern, gold gallery
      [0.09, 0.065, 0.045, 0.025].forEach((w, i) => box(g, w, 0.15, w, MAROON, 0, 1.54 + i * 0.15, -0.5)); box(g, 0.02, 0.1, 0.02, GOLD, 0, 2.14, -0.5);        // its needle spire and vane
      for (const x of [-1.03, 1.03]) { box(g, 0.07, 0.3, 0.07, WOOD, x, 0.22, 0.2); cyl(g, 0.21, 0.14, 0x2f7a4a, x, 0.5, 0.2); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, 0.2); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, 0.2); } // two lindens
      [-0.9, 0.9].forEach((x) => { box(g, 0.04, 0.5, 0.04, INK, x, 0.22, 0.45); box(g, 0.09, 0.08, 0.09, 0xfff6b0, x, 0.72, 0.45); });                          // two street lamps
      ([[-1.1, ZURICH], [1.1, SWISS]] as [number, string[]][]).forEach(([x, rows]) => { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.22, 0.45); decal(g, rows, x - Math.sign(x) * rows[0].length / 44, 0.95, 0.45); }); // the flags of Zürich and Switzerland on their masts
      [[-0.45, 0.8], [0.55, 0.74]].forEach(([x, z]) => { box(g, 0.14, 0.06, 0.08, 0xffffff, x, 0.1, z); box(g, 0.03, 0.1, 0.03, 0xffffff, x + 0.06, 0.16, z); box(g, 0.05, 0.03, 0.04, 0xffffff, x + 0.08, 0.26, z); box(g, 0.03, 0.02, 0.02, 0xff9a2e, x + 0.115, 0.26, z); }); // two swans
      [[-0.1, 0.9], [0.2, 0.68], [0.95, 0.85]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));                                                 // ripples on the river
    }),
  ],
  'New York': [ // Statue of Liberty: a verdigris copper figure on a granite pedestal inside the eleven-pointed star of Fort Wood on Liberty Island, torch raised in one hand and the tablet in the other under a crown of seven rays; trees and the Stars and Stripes on the lawn, a Staten Island ferry in the harbour
    final((g) => {
      const [SX, SZ, FY, P] = [0, -0.38, 0.46, 2.04];                                                                                                           // the monument's centre line, the top of Fort Wood, the top of the pedestal (the plinth she stands on)
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, GRASS = 0x4f9d4f, WALL = 0xcfc8b6, PATH = 0xdba596, FORT = 0xb4ab95, GR = 0xcbc3ae, GRL = 0xded8c6, GRD = 0xa9a08a, DARK = 0x3f392e;  // paints: sea, foam, lawn, seawall, the pink promenade, fort stone, granite in three tones, the loggia's shade
      const WOOD = 0x6e3a12, WHITE = 0xf4f6fa, NAVY = 0x1a2250, ORANGE = 0xf26b1d;                                                                              // trunks, the ferry's white paint, its windows, its orange
      const PAT = 0x5cc6a6, PATL = 0x8fe4cc, PATD = 0x419e83, PATDD = 0x2d7662, DGOLD = 0xe0a020;                                                               // the statue's verdigris in four tones, the flame's darker gold
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
      box(g, 0.58, 0.1, 0.19, WHITE, fx - 0.03, 0.2, 0.74); box(g, 0.52, 0.04, 0.02, NAVY, fx - 0.03, 0.23, 0.84);                                              // the main deck and its windows
      box(g, 0.42, 0.09, 0.16, WHITE, fx - 0.05, 0.3, 0.74); box(g, 0.36, 0.035, 0.02, NAVY, fx - 0.05, 0.33, 0.82); box(g, 0.46, 0.025, 0.18, ORANGE, fx - 0.05, 0.39, 0.74);  // the upper deck, its windows, the orange roof
      box(g, 0.16, 0.09, 0.12, WHITE, fx + 0.2, 0.3, 0.74); box(g, 0.12, 0.04, 0.02, NAVY, fx + 0.2, 0.33, 0.8);                                                // the wheelhouse and its glass
      box(g, 0.1, 0.22, 0.1, ORANGE, fx - 0.18, 0.415, 0.74); box(g, 0.105, 0.03, 0.105, INK, fx - 0.18, 0.635, 0.74);                                          // the funnel, its black cap
      box(g, 0.76, 0.012, 0.03, FOAM, fx, 0.1, 0.86); box(g, 0.08, 0.012, 0.22, FOAM, fx + 0.45, 0.1, 0.74);                                                    // foam along the hull and at the bow
      [[-1, -0.2], [1, -0.2], [-0.86, 0.22]].forEach(([x, z]) => { box(g, 0.05, 0.2, 0.05, WOOD, x, 0.27, z); cyl(g, 0.15, 0.12, 0x2f7a4a, x, 0.42, z); cyl(g, 0.12, 0.11, 0x3f9a5c, x, 0.52, z); cyl(g, 0.07, 0.09, 0x4fb06a, x, 0.61, z); });  // three trees on the island: a trunk and three tiers of leaves
      box(g, 0.03, 0.9, 0.03, 0xdddddd, 0.62, 0.3, 0.3); box(g, 0.05, 0.05, 0.05, GOLD, 0.62, 1.2, 0.3); decal(g, ['uuurrrr', 'uuuwwww', 'rrrrrrr', 'wwwwwww'], 0.8, 1, 0.31);  // the Stars and Stripes on its mast: a blue canton over the stripes
      [[-0.9, 0.78], [-0.4, 0.9], [0.1, 0.93]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                                            // ripples on the harbour
    }),
  ],
  'Las Vegas': [ // Welcome to Fabulous Las Vegas: the diamond sign on its median, seven silver-dollar coins spelling WELCOME across its top, a star between the two poles that carry it, palms and boulders round its foot; behind it the Strat, a concrete tripod under a two-tier glass pod with neon bracing and a red-lit mast; the boulevard in front with a taxi
    final((g) => {
      const [TX, TZ, SX, SZ, SY] = [0.8, -0.5, -0.34, 0.2, 0.99];                                                                                               // the tower's centre line, the sign's, its depth, the foot of its board
      const PLAZA = 0xb9b3a2, PAVE = 0xcfc8b6, KERB = 0xe6e9f0, ASPHALT = 0x3d4254, GRAVEL = 0xb8825c, ROCK = 0xc99a74, CREAM = 0xf0e6bd, CREAM2 = 0xdccfa0, GLASS = 0x34426e, GLASS2 = 0x4a5c92, DOME = 0x6b7391, WHITE = 0xf4f6fa, POLE = 0x4a9ac8, STAR = 0xe8502a, WOOD = 0x8a5a2b;  // paints
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
  Rio: [ // Christ the Redeemer: the soapstone statue, arms spread, on its chapel pedestal and viewing terrace (visitors posing arms wide) on the granite summit of Corcovado, the rainforest mountain with its stair and flowering ipês rising from Guanabara Bay; behind its shoulder the Sugarloaf and its red cable car, on the beach palms and the Brazilian flag, a sailboat in the bay
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
  Jerusalem: [ // Dome of the Rock: the octagonal shrine in marble and blue Ottoman tile, a frieze of white script under its battlements, a porch on three of its faces and a gilded dome on its windowed drum under a crescent; on the limestone platform of the Temple Mount, with its stair, a free-standing arch at each front corner, the Dome of the Chain, cypresses, olives, pilgrims and doves
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
};
