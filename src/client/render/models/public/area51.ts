import * as THREE from 'three';
import { box, cyl, final, glass, mat, part, plaque, GOLD, IRON, INK, type ModelDef } from '../../builder';
import { LAYER_FX, fxOf } from '../../scene';

export default {
  key: 'area51',
  lamps: [{ at: [0.6, 2.4, 0], color: 0x5dfff0, power: 14, reach: 8, final: true }], // the saucer's beam
  props: [ // hangar under its sign, and a saucer beaming a cow up over a crop circle
    final((g) => {
      const [UX, UZ, BY, HX] = [0.62, 0.1, 2.0, -0.6]; // saucer axis and belly height, hangar centre line
      const SAND = 0xe6d3a3, ROCK = 0xb59a6a, CONCRETE = 0xb4bac6, WOOD = 0x6e3a12, RAIL = 0x9a6a34, STRAW = 0xe8c066, CACTUS = 0x3f9a5c, CYAN = 0x5dfff0, WHITE = 0xf4f6fa, PINK = 0xffc2c8;
      const hang = (p: THREE.Group, w: number, len: number, c: number, x: number, y: number, z: number, a: number) => { box(p, w, len, w, c, x + (Math.sin(a) * len) / 2, y - (Math.cos(a) * len) / 2 - len / 2, z).rotation.z = a; }; // bar hanging from (x, y), its tip swung a toward +x
      box(g, 2.4, 0.1, 1.9, SAND); box(g, 1.2, 0.03, 0.55, CONCRETE, HX, 0.1, 0.17); box(g, 0.05, 0.02, 0.55, GOLD, HX, 0.13, 0.17); // desert, apron with its guide line
      const vault = (r: number, d: number) => new THREE.CylinderGeometry(r, r, d, 16, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.6, 1), rib = vault(0.615, 0.09); // flattened half cylinder along the hangar's depth
      box(g, 1.2, 0.5, 0.78, 0x8f9aa8, HX, 0.1, -0.5); part(g, vault(0.6, 0.84), 0, mat(0xb7c1cf), HX, 0.6, -0.5); for (let k = -2; k <= 2; k++) part(g, rib, 0, mat(0xa4afbf), HX, 0.6, -0.5 + k * 0.18); // hangar: walls, barrel roof, ribs
      box(g, 0.74, 0.38, 0.05, 0x6f7a8c, HX, 0.1, -0.1); box(g, 0.64, 0.32, 0.04, 0x44546c, HX, 0.1, -0.08); plaque(g, 'AREA 51', '#1b2a3a', '#73eff7', 1.23, 0.3, HX, 0.5, -0.06, 'neon'); // door and its sign
      for (const x of [-1.12, -0.08]) { box(g, 0.04, 0.4, 0.04, IRON, x, 0.1, 0.42); box(g, 0.1, 0.05, 0.1, 0xfff6b0, x, 0.5, 0.42); } // floodlights
      box(g, 0.05, 0.22, 0.05, IRON, HX + 0.15, 0.9, -0.5); cyl(g, 0.17, 0.035, 0xe8ecf4, HX + 0.15, 1.12, -0.5).rotation.z = -0.9; box(g, 0.03, 0.14, 0.03, 0xff3b3b, HX + 0.25, 1.13, -0.5).rotation.z = -0.9; // radar dish turned up to the saucer, feed horn
      // paddock: a crop circle under the beam, a rail fence behind and beside it, a hay bale
      [[0.53, 0.02, CYAN], [0.5, 0.03, 0x4cc36b], [0.38, 0.04, 0x2fa84f], [0.26, 0.05, 0x4cc36b], [0.14, 0.06, 0x2fa84f]].forEach(([r, h, c]) => cyl(g, r, h, c, UX, 0.1, UZ));
      for (let i = 0; i < 5; i++) { box(g, 0.05, 0.24, 0.05, WOOD, 0.05 + i * 0.28, 0.1, -0.64); if (i) box(g, 0.05, 0.24, 0.05, WOOD, 1.17, 0.1, -0.64 + i * 0.2); }
      for (const y of [0.18, 0.28]) { box(g, 1.15, 0.03, 0.03, RAIL, 0.62, y, -0.64); box(g, 0.03, 0.03, 0.8, RAIL, 1.17, y, -0.24); }
      cyl(g, 0.11, 0.2, STRAW, 0.98, 0.11, 0.66).rotation.x = Math.PI / 2; cyl(g, 0.07, 0.03, 0xc79a3a, 0.98, 0.195, 0.75).rotation.x = Math.PI / 2; // hay bale on its side, its spiral end
      // saucer: hull slabs, rim lamps, a glass dome in a dark gasket, an aerial
      cyl(g, 0.16, 0.05, INK, UX, BY, UZ); cyl(g, 0.28, 0.06, 0x6f7a8c, UX, BY + 0.05, UZ); cyl(g, 0.4, 0.06, 0x8e99ac, UX, BY + 0.11, UZ); cyl(g, 0.5, 0.08, 0xc9d1de, UX, BY + 0.17, UZ);
      cyl(g, 0.42, 0.06, 0xdfe6f2, UX, BY + 0.25, UZ); cyl(g, 0.32, 0.05, 0xeef2f8, UX, BY + 0.31, UZ);
      cyl(g, 0.27, 0.03, INK, UX, BY + 0.35, UZ); part(g, new THREE.SphereGeometry(0.24, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), 0, glass(0x6fe0ee), UX, BY + 0.36, UZ);
      box(g, 0.02, 0.1, 0.02, IRON, UX, BY + 0.54, UZ); box(g, 0.05, 0.05, 0.05, 0xff5de0, UX, BY + 0.64, UZ);
      for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; box(g, 0.07, 0.06, 0.07, [0xfff6b0, 0xff5de0][k & 1], UX + 0.5 * Math.cos(a), BY + 0.18, UZ + 0.5 * Math.sin(a)); }
      // beam: a translucent cone from the belly to the circle, unlit and shadowless, with dust and straw round it
      const BEAM = fxOf(new THREE.MeshBasicMaterial({ color: 0xc8fff9, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.BackSide })); // far wall only, so the cow in front is never tinted
      const beam = part(g, new THREE.CylinderGeometry(0.18, 0.5, BY - 0.12, 14, 1, true), BY - 0.12, BEAM, UX, 0.12, UZ);
      beam.castShadow = beam.receiveShadow = false;
      beam.layers.set(LAYER_FX); beam.name = 'ufo-beam'; beam.geometry.userData.own = true; // the translucent layer (scene.ts): a name keeps it out of bake's batch, which has no layers, and `own` has freeBaked free its geometry
      [0.28, 0.4, 0.52, 1.3, 1.45, 1.6, 1.75].forEach((y, i) => { const r = 0.7 * (0.5 - (0.32 * (y - 0.12)) / (BY - 0.12)), a = i * 2.4; box(g, 0.05, 0.05, 0.05, i & 1 ? STRAW : 0xfff6b0, UX + r * Math.cos(a), y, UZ + r * Math.sin(a)); }); // clear of the cow
      // cow: white with black patches, pink udder and snout, golden horns, head thrown up, legs kicking, tail flicked
      const cow = new THREE.Group(); cow.position.set(UX, 0.85, UZ); cow.rotation.set(0, 0.2, 0.4); cow.scale.setScalar(0.9); g.add(cow);
      const leg = (x: number, z: number, a: number) => { hang(cow, 0.07, 0.22, WHITE, x, -0.12, z, a); hang(cow, 0.075, 0.06, INK, x + Math.sin(a) * 0.22, -0.12 - Math.cos(a) * 0.22, z, a); }; // leg with its hoof
      box(cow, 0.6, 0.26, 0.24, WHITE, 0, -0.13, 0); [[-0.27, -0.08, 0.17, 0.215], [-0.06, -0.13, 0.12, 0.17], [0.1, 0, 0.12, 0.135]].forEach(([x, y, w, h]) => box(cow, w, h, 0.25, INK, x, y, 0)); box(cow, 0.11, 0.05, 0.11, PINK, -0.14, -0.17, 0);
      leg(0.22, 0.07, 0.25); leg(0.22, -0.07, -0.1); leg(-0.22, 0.07, -0.6); leg(-0.22, -0.07, -0.9); // the body's pitch swings all four forward by 0.4
      box(cow, 0.19, 0.18, 0.19, WHITE, 0.38, -0.01, 0); box(cow, 0.08, 0.09, 0.15, PINK, 0.5, -0.01, 0);
      for (const s of [-1, 1]) { box(cow, 0.035, 0.035, 0.02, INK, 0.42, 0.09, s * 0.1); box(cow, 0.04, 0.03, 0.07, INK, 0.33, 0.1, s * 0.13); box(cow, 0.03, 0.07, 0.03, STRAW, 0.37, 0.17, s * 0.06); } // eyes, ears, horns
      hang(cow, 0.03, 0.24, WHITE, -0.3, 0.1, 0, -2.4); box(cow, 0.06, 0.06, 0.06, INK, -0.46, 0.24, 0); // tail and its tuft
      // desert: boulders and a cactus
      box(g, 0.24, 0.12, 0.18, ROCK, -1.0, 0.1, 0.72); box(g, 0.14, 0.08, 0.12, 0xc9ae7c, -0.92, 0.22, 0.7).rotation.y = 0.5; box(g, 0.18, 0.1, 0.14, ROCK, 0.1, 0.1, 0.8);
      box(g, 0.08, 0.4, 0.08, CACTUS, -0.55, 0.1, 0.78); box(g, 0.18, 0.06, 0.06, CACTUS, -0.63, 0.28, 0.78); box(g, 0.06, 0.16, 0.06, CACTUS, -0.69, 0.28, 0.78); box(g, 0.14, 0.06, 0.06, CACTUS, -0.5, 0.22, 0.78); box(g, 0.06, 0.14, 0.06, CACTUS, -0.44, 0.22, 0.78);
    }),
  ],
} satisfies ModelDef;
