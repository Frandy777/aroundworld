import { box, cyl, decal, final, stone, GOLD, type ModelDef } from '../../builder';

export default {
  key: 'Pyongyang',
  props: [ // Juche Tower: a tapering shaft of granite tiers with gold characters up its front, under a red glass torch on a gold collar; beside it the statue of the worker, peasant and intellectual raising hammer, sickle and brush; the Taedong in front with two fountains and a rowing boat
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
} satisfies ModelDef;
