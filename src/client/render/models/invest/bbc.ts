import { box, cyl, final, floor, glass, plaque, GOLD, IRON, INK, type ModelDef } from '../../builder';

export default {
  key: 'bbc',
  props: [ // Broadcasting House: a stepped Art Deco tower in Portland stone (statue over the doors, the three black BBC squares on its frieze, a red ON AIR sign and a banded mast on top), on its forecourt an outside-broadcast van with a dish, a camera on its dolly and a studio light
    final((g) => {
      const Z = -0.45, STONE = 0xffffff, TRIM = 0xe4ddc8, WHITE = 0xf4f6fa, GREY = 0xcfd6e6, DARK = 0x3a4056, RED = 0xd9423e, GLASS = 0x7db6ff, BRONZE = 0xb89a5a; // Z: the tower's centre line
      box(g, 2.2, 0.08, 1.9, 0xb9b2a0); box(g, 1.1, 0.04, 0.18, TRIM, 0, 0.08, 0.14);                                                         // forecourt, the step at the doors
      floor(g, 4, 2, 'lobby', STONE, 0.08, 0, Z); floor(g, 4, 2, 'win', STONE, 0.98, 0, Z);                                                  // the tower: glass doors, a storey of windows
      box(g, 2, 0.5, 1, STONE, 0, 1.88, Z); box(g, 2.02, 0.03, 1.02, GOLD, 0, 1.88, Z); box(g, 2.12, 0.1, 1.12, TRIM, 0, 2.38, Z);           // frieze on a gold rule, cornice
      floor(g, 3, 2, 'win', STONE, 2.48, 0, Z); box(g, 1.62, 0.1, 1.12, TRIM, 0, 3.38, Z);                                                    // second tier, set in
      floor(g, 2, 2, 'win', STONE, 3.48, 0, Z); box(g, 1.12, 0.1, 1.12, TRIM, 0, 4.38, Z);                                                    // third tier and its roof
      [[0.97, 0.08, 2.3], [0.72, 2.48, 0.9], [0.47, 3.48, 0.9]].forEach(([x, y, h]) => [-1, 1].forEach((s) => box(g, 0.08, h, 0.08, TRIM, s * x, y, Z + 0.52))); // a pier up each front corner of the three tiers
      ['B', 'B', 'C'].forEach((c, i) => plaque(g, c, '#14161f', '#fff', 0.41, 0.36, (i - 1) * 0.47, 1.95, Z + 0.56));                        // the logo: three black squares on the frieze
      box(g, 0.16, 0.06, 0.08, TRIM, 0, 1.2, Z + 0.54); box(g, 0.09, 0.26, 0.06, BRONZE, -0.03, 1.26, Z + 0.54); box(g, 0.06, 0.06, 0.06, BRONZE, -0.03, 1.52, Z + 0.54); box(g, 0.05, 0.16, 0.05, BRONZE, 0.05, 1.26, Z + 0.54); // Prospero and Ariel on the pier over the doors
      box(g, 0.05, 0.12, 0.05, GREY, 0.88, 2.48, -0.3); cyl(g, 0.14, 0.03, WHITE, 0.88, 2.7, -0.28).rotation.x = Math.PI / 4; box(g, 0.04, 0.04, 0.04, DARK, 0.88, 2.78, -0.2); // a satellite dish on the first terrace
      for (const x of [-0.45, 0.45]) box(g, 0.06, 0.12, 0.06, DARK, x, 4.48, Z + 0.4); plaque(g, 'ON AIR', '#d9423e', '#fff', 1.1, 0.3, 0, 4.6, Z + 0.4); // the roof sign on two posts
      box(g, 0.3, 0.1, 0.3, TRIM, 0.2, 4.48, -0.6); for (let i = 0; i < 5; i++) box(g, 0.12, 0.34, 0.12, i & 1 ? WHITE : RED, 0.2, 4.58 + i * 0.34, -0.6); // the mast on its plinth, in red and white bands
      box(g, 0.5, 0.04, 0.04, WHITE, 0.2, 5.35, -0.6); [-0.05, 0.45].forEach((x) => box(g, 0.08, 0.16, 0.04, GREY, x, 5.19, -0.6));                // a crossarm with a panel antenna at each end
      box(g, 0.03, 0.26, 0.03, GREY, 0.2, 6.28, -0.6); box(g, 0.08, 0.08, 0.08, 0xff3b3b, 0.2, 6.54, -0.6);                                  // aerial and its red beacon
      const [vx, vz, kx, kz] = [-0.7, 0.42, 0.6, 0.45];                                                                                         // the van's centre, the camera's
      box(g, 0.72, 0.06, 0.3, DARK, vx, 0.1, vz); box(g, 0.46, 0.32, 0.34, WHITE, vx - 0.13, 0.16, vz); box(g, 0.26, 0.22, 0.34, GREY, vx + 0.23, 0.16, vz);  // van (nose to the right): chassis, studio box, cab
      box(g, 0.72, 0.045, 0.02, RED, vx, 0.2, vz + 0.175); box(g, 0.14, 0.09, 0.02, GLASS, vx + 0.23, 0.27, vz + 0.175, glass(GLASS)); // red stripe, cab window
      for (let i = -1; i < 2; i++) box(g, 0.09, 0.09, 0.02, 0x14161f, vx - 0.13 + i * 0.11, 0.3, vz + 0.175);                                  // the BBC squares on its side
      [-0.2, 0.22].forEach((dx) => box(g, 0.14, 0.14, 0.05, INK, vx + dx, 0.08, vz + 0.15));                                                  // wheels
      box(g, 0.04, 0.18, 0.04, GREY, vx - 0.2, 0.48, vz); cyl(g, 0.17, 0.03, WHITE, vx - 0.2, 0.74, vz + 0.03).rotation.x = Math.PI / 4; box(g, 0.04, 0.04, 0.04, DARK, vx - 0.2, 0.83, vz + 0.12); // roof dish on its post, tilted to the sky, its feed horn
      box(g, 0.03, 0.3, 0.03, GREY, vx, 0.48, vz - 0.1); box(g, 0.05, 0.05, 0.05, 0xff3b3b, vx, 0.78, vz - 0.1);                              // telescopic aerial and its red tip
      box(g, 0.94, 0.012, 0.025, INK, 0.13, 0.08, 0.52);                                                                                      // cable from the van to the camera
      box(g, 0.36, 0.03, 0.05, DARK, kx, 0.08, kz); box(g, 0.05, 0.03, 0.36, DARK, kx, 0.08, kz); box(g, 0.05, 0.32, 0.05, 0x7b86a0, kx, 0.11, kz); // camera dolly: crossed legs and column
      box(g, 0.12, 0.05, 0.1, INK, kx, 0.43, kz); box(g, 0.24, 0.16, 0.14, GREY, kx, 0.48, kz); box(g, 0.16, 0.1, 0.1, INK, kx - 0.2, 0.51, kz);  // pan head, body, lens
      box(g, 0.05, 0.14, 0.14, DARK, kx - 0.3, 0.49, kz); box(g, 0.12, 0.07, 0.07, INK, kx + 0.02, 0.64, kz); box(g, 0.04, 0.04, 0.04, 0xff3b3b, kx - 0.06, 0.64, kz + 0.07); // lens hood, viewfinder, red tally lamp
      box(g, 0.03, 0.5, 0.03, IRON, 0.95, 0.08, 0.3); box(g, 0.2, 0.15, 0.1, INK, 0.95, 0.58, 0.3); box(g, 0.16, 0.11, 0.02, 0xfff6b0, 0.95, 0.6, 0.36); // studio light on its stand, its glowing lens
    }),
  ],
} satisfies ModelDef;
