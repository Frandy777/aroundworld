import * as THREE from 'three';
import { box, cyl, final, INK, IRON, type ModelDef } from '../../builder';

export default {
  key: 'Singapore',
  props: [ // the Merlion: a white lion-headed fish on a round pedestal in a pool, a spiked mane round its face, its tail curled up behind, spouting water from its mouth
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
} satisfies ModelDef;
