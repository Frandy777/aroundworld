import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { block, box, cyl, final, memo, stone, INK, type ModelDef } from '../../builder';
import { glassy, glow, nightlit, switchOf } from '../../light';
import { toon } from '../../scene';

const WARM = 0xffd9a0; // the warm light of a window
// What shines once the hotel is bought, and only then (see `shine`): the glass of its slabs (gathered as they are built: `block` makes them) and every other lamp of the island (`lit`: a part that shines after dusk, k times its light, glass if it is a pane (see `glassy`); made here, never shared, so that
// switching it cannot reach another tile), and a beacon at each end of the SkyPark that takes the colour of its owner (unlit like any lamp, but this one is the hotel's own material, so that its colour can be set).
// `own` is who owns it now, so that what is drawn after a change of hands (an upgrade's landmarks, a model saved while developing) is lit as the rest is
const LIT = new Set<THREE.Material>(), beacon = glow(new THREE.MeshBasicMaterial({ color: INK }));
let own: number | null = null;
const lit = memo((c: number, k: number, light: number = WARM, pane: boolean = false) => { const m = nightlit(toon(c), light, k); LIT.add(m); switchOf(m).value = +(own !== null); return pane ? glassy(m) : m; });
const shine = (c: number | null) => { own = c; LIT.forEach((m) => (switchOf(m).value = +(c !== null))); beacon.color.set(c ?? INK); }; // c: the owner's colour while the hotel stands, null while it is for sale or mortgaged: its lights are out and its beacons dark

export default {
  key: 'Singapore',
  lamps: [{ at: [0, 0.8, 0.85], color: WARM, power: 3.6, reach: 6.5, final: true, owned: true }], // the promenade's lights in front of the hotel's lobby: out with the hotel's own while the lot is for sale or mortgaged
  props: [ // Marina Bay Sands: three squat towers of dark glass, a clear gap between each, leaning on their back slabs under the long ship of the SkyPark, its bow out over the bay, with its infinity pool and gardens, on a podium by the water, the lotus of the ArtScience Museum on its quay and a bumboat on the water. By night, once the hotel is bought, the towers' floors, the lobby, the pool and the museum are lit
    final((g) => {
      const BASE = 0.46, H = 1.8, ZC = -0.26, OFF = 0.4, LEAN = 0.11, TOP = BASE + H, DY = TOP + 0.08, LX = -0.08, TW = 0.88, TD = 0.8;                         // the towers' foot and height, their centre line, how far each slab stands off it and leans (so that the two meet at the top), the SkyPark's underside and its walking level, the middle tower's (and the lobby's) x, how much a slab is narrowed and thinned
      const WATER = 0x3a86e0, PLAZA = 0xd8d2c0, WHITE = 0xf4f6fa, GLASS = 0x8fa4cc, HULL = 0x8d97ab, POOL = 0x4da3ff, AQUA = 0x6cc8ff, LEAF = 0x3f9a5c, LEAF2 = 0x2f7a4a, BULB = 0xfff6b0, WOOD = 0x6e3a12, CREAM = 0xf0e8d4; // paints
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.4, 0.06, 1.5, PLAZA, 0, 0.1, -0.2); box(g, 2.4, 0.03, 0.05, 0xe6e9f0, 0, 0.16, 0.5);                               // the bay, the promenade on it, its kerb
      box(g, 2.3, 0.3, 1.38, 0xdfe3ec, 0, 0.16, ZC); for (const s of [-1, 1]) box(g, 0.75, 0.08, 0.03, 0x3f6fd0, LX + s * 0.62, 0.3, ZC + 0.7, lit(0x3f6fd0, 0.5, WARM, true)); // the podium the towers stand on, the band of glass along its front, either side of the lobby (lit by night)
      [LX - 0.75, LX, LX + 0.75].forEach((x, k) => [1, -1].forEach((s) => { // the three towers, a gap of 0.31 between them, each two slabs leaning on one another: the front one (s = 1) and the back one
        const p = new THREE.Group(); p.position.set(x, BASE, ZC + s * OFF); p.rotation.x = -s * LEAN; p.scale.set(TW, 1, TD); g.add(p);
        [block(p, 1, 1, 'glass glass', GLASS, 0, 0, 0, true, 10 * (k + 1)).material].flat().forEach((m) => m.userData.maps && (LIT.add(m), switchOf(m).value = +(own !== null)));     // a slab of ribbon glazing, in the lamps of its tower
      }));
      box(g, 0.1, 0.1, 0.5, WHITE, -1.15, TOP - 0.02, ZC); box(g, 2.06, 0.1, 0.9, WHITE, -0.07, TOP - 0.02, ZC);                                                // the SkyPark: its tip, the deck
      box(g, 0.12, 0.1, 0.72, WHITE, 1.02, TOP - 0.02, ZC); box(g, 0.09, 0.1, 0.5, WHITE, 1.125, TOP - 0.02, ZC); box(g, 0.08, 0.1, 0.26, WHITE, 1.21, TOP - 0.02, ZC);               // the bow that overhangs the last tower, narrowing in three steps
      box(g, 2.06, 0.07, 0.62, HULL, 0.03, TOP - 0.09, ZC); box(g, 1.7, 0.06, 0.4, HULL, 0.05, TOP - 0.15, ZC); box(g, 0.12, 0.07, 0.34, HULL, 1.12, TOP - 0.09, ZC);                 // its hull, in steps, and under the bow
      box(g, 0.9, 0.05, 0.18, POOL, 0.45, DY - 0.02, ZC + 0.35, lit(POOL, 0.8, AQUA));                                                                          // the infinity pool along its front edge (lit from below by night)
      box(g, 0.85, 0.03, 0.3, 0x7bbf6a, -0.625, DY - 0.02, ZC - 0.04);                                                                                          // a lawn
      for (let i = 0; i < 9; i++) box(g, 0.1, i & 1 ? 0.14 : 0.1, 0.1, i & 1 ? LEAF2 : LEAF, -1 + i * 0.22, DY - 0.02, ZC - 0.36);                              // trees along its back edge
      box(g, 0.16, 0.08, 0.22, 0xe6e9f0, 1, DY - 0.02, ZC);                                                                                                     // the bar at its tip
      for (const x of [-1.16, 1.21]) { box(g, 0.025, 0.2, 0.025, INK, x, DY - 0.02, ZC); box(g, 0.06, 0.06, 0.06, INK, x, DY + 0.18, ZC, beacon); }             // a mast at each end of it, a beacon on each
      box(g, 0.46, 0.22, 0.03, 0xe8edf6, LX, 0.16, ZC + 0.7); box(g, 0.38, 0.18, 0.04, 0x1d2c4d, LX, 0.16, ZC + 0.705, lit(0x1d2c4d, 0.85, WARM, true)); box(g, 0.025, 0.18, 0.045, 0xe8edf6, LX, 0.16, ZC + 0.71); // the lobby: frame, dark glass doors (lit by night), the bar between them
      const mx = -0.78, mz = 0.7;                                                                                                                               // the museum's centre
      box(g, 0.8, 0.06, 0.48, PLAZA, mx, 0.1, mz); cyl(g, 0.2, 0.14, CREAM, mx, 0.16, mz).material = lit(CREAM, 0.4);                                           // its quay, the drum (lit by night)
      for (let k = 0; k < 8; k++) { // the lotus: eight petals round it, each leaning out
        const a = (k * Math.PI) / 4, r = 0.17 + 0.21 * Math.sin(0.45), p = box(g, 0.12, 0.42, 0.05, CREAM, mx + r * Math.sin(a), 0.3 + 0.21 * (Math.cos(0.45) - 1), mz + r * Math.cos(a));
        p.rotation.order = 'YXZ'; p.rotation.set(0.45, a, 0);
      }
      const bx = -0.05;                                                                                                                                         // the bumboat's centre
      box(g, 0.5, 0.07, 0.16, WOOD, bx, 0.1, 0.78); box(g, 0.32, 0.03, 0.2, 0xd9423e, bx, 0.22, 0.78); box(g, 0.02, 0.12, 0.02, WOOD, bx - 0.12, 0.17, 0.78); box(g, 0.02, 0.12, 0.02, WOOD, bx + 0.12, 0.17, 0.78); // the bumboat: hull, red awning on two posts
      for (const x of [-1.1, -0.35, 0.35, 1.1]) { box(g, 0.02, 0.2, 0.02, INK, x, 0.16, 0.48); box(g, 0.05, 0.05, 0.05, BULB, x, 0.36, 0.48); }                 // lamp posts along the kerb
      shine(own);                                                                                                                                               // light it as its owner has it
    }),
  ],
  levels: [ // the hotel stands at every level; each upgrade adds a landmark of Singapore on the apron and the bay's right bank
    [ // Lv 1, the Merlion on its quay: a white lion-headed fish in three-quarter profile on blue waves, a cowl of mane draped down its back, a scaled body with its tail fanned out at the foot, and a jet from its open mouth arcing into the pool, beads of foam running down it, drops leaping and ripples spreading where it lands; floodlit by night
      final((g) => {
        const WHITE = 0xffffff, SHADE = 0xd5deee, FOAM = 0xeaf6ff, WATER = 0x4da3ff, LAPIS = 0x2f5fc0, SKY = 0x7fb3ff, MAW = 0x3b1020, NOSE = 0x596176, PAVE = 0xd6cdbd, CZ = 1.43, S = 1.18; // paints; the quay's centre line, the statue's scale
        const lamp = (o: THREE.Mesh, c: number) => (o.material = lit(c, 0.16, 0xffe9c4), o);                                                                    // a part of the statue, floodlit by night without bleaching its relief in HD
        stone(g, 1.4, 0.12, 0.84, PAVE, -0.5, 0, CZ); box(g, 1.28, 0.08, 0.72, WATER, -0.5, 0.12, CZ);                                                          // the quay, the pool in it
        const m = new THREE.Group(); m.position.set(-0.14, 0.12, CZ - 0.06); m.rotation.y = 0.3 - Math.PI / 2; m.scale.setScalar(S); g.add(m);                  // the statue, drawn at its own size and scaled: from the waves up, its face (+z) to the left over the pool and a little toward us
        const cw = (p: THREE.Group, r: number, h: number, c: number, x: number, y: number, z: number) => lamp(cyl(p, r, h, c, x, y, z), c);                     // a cylinder of it, in the frame of p
        const wb = (p: THREE.Group, w: number, h: number, d: number, c: number, x: number, y: number, z: number) => lamp(box(p, w, h, d, c, x, y, z), c);       // a box of it
        cyl(m, 0.3, 0.09, LAPIS, 0, 0, 0); cyl(m, 0.26, 0.04, SKY, 0, 0.09, 0); cyl(m, 0.21, 0.035, LAPIS, 0, 0.13, 0);                                       // a low, three-tone wave rather than a pedestal
        for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; box(m, 0.09, 0.055 + 0.025 * (k & 1), 0.08, k & 1 ? SKY : LAPIS, 0.29 * Math.sin(a), 0.025, 0.29 * Math.cos(a)).rotation.y = a; } // broken crests round the foot
        const profile = [0.21, 0.205, 0.195, 0.185, 0.175, 0.165, 0.158, 0.15, 0.145];
        profile.forEach((r, i) => cw(m, r, 0.09, WHITE, 0, 0.16 + i * 0.075, 0));                                                                                // the fish's continuous body, broad at the foot and narrow at the chest
        const scale = (p: THREE.Group, r: number, c: number, y: number, z: number) => { const o = cw(p, r, 0.018, c, 0, y - 0.009, z); o.scale.y = 0.72; o.rotation.x = Math.PI / 2; };
        for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) { // overlapping scale plates, staggered from row to row round the back and flanks
          const r = profile[i] + 0.003, a = -1.4 + j * (2.8 / 6) + (i & 1 ? 0.1 : 0), p = new THREE.Group();
          p.position.set(r * Math.sin(a), 0.235 + i * 0.075, -r * Math.cos(a)); p.rotation.y = Math.PI - a; m.add(p);
          scale(p, 0.049, SHADE, 0, 0.004); scale(p, 0.047, WHITE, 0.004, 0.015);
        }
        cw(m, 0.15, 0.15, WHITE, 0, 0.76, 0.015);                                                                                                                  // the chest under the mane
        const paw = new THREE.Group(); paw.position.set(-0.065, 0.53, 0.145); paw.rotation.x = -0.16; m.add(paw); wb(paw, 0.075, 0.29, 0.075, WHITE, 0, 0, 0); wb(paw, 0.105, 0.075, 0.09, WHITE, 0, 0.27, 0.015); // the long forepaw held against it
        [0.35, 0.62, 0.9, 1.18, 1.45].forEach((a, i) => { // the broad, ribbed fan of the tail curling forward round the foot
          const p = new THREE.Group(), w = [0.065, 0.08, 0.095, 0.08, 0.065][i], h = [0.27, 0.34, 0.38, 0.34, 0.27][i]; p.position.set(0, 0.18, 0.14); p.rotation.x = a; m.add(p);
          wb(p, w, h, 0.035, SHADE, 0, 0, 0); wb(p, w - 0.014, h - 0.025, 0.04, WHITE, 0, 0.015, 0.012);
        });
        cw(m, 0.2, 0.34, SHADE, 0, 0.73, -0.07).scale.z = 0.8;                                                                                                    // the mane's solid cowl behind the head
        [[0.36, 0.4, 0.61, -0.18, 0.18], [0.32, 0.27, 0.9, -0.145, 0.12], [0.24, 0.16, 1.07, -0.1, 0]].forEach(([w, h, y, z, t]) => { // broad overlapping locks make one continuous, draped silhouette
          const p = new THREE.Group(); p.position.set(0, y, z); p.rotation.x = t; m.add(p); wb(p, w, h, 0.12, WHITE, 0, 0, 0);
          for (const x of [-w * 0.28, 0, w * 0.28]) wb(p, 0.014, h - 0.06, 0.014, SHADE, x, 0.03, -0.067);                                                       // the long carved grooves down its back
        });
        const hd = new THREE.Group(); hd.position.set(0, 1.02, 0.045); hd.rotation.x = -0.12; hd.scale.setScalar(1.15); m.add(hd);                            // a large, nearly upright lion's head, its muzzle pushed well forward
        cw(hd, 0.2, 0.25, SHADE, 0, -0.12, -0.12).scale.z = 0.75;                                                                                                 // the mane behind the skull
        const ruff = cw(hd, 0.26, 0.12, WHITE, 0, -0.06, -0.11); ruff.rotation.x = Math.PI / 2;                                                                   // its broad disc frames the whole face, joining the cowl behind
        for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; wb(hd, 0.018, 0.09, 0.015, SHADE, 0.225 * Math.sin(a), 0.225 * Math.cos(a) - 0.02, -0.043).rotation.z = -a; } // short radial grooves carved into it
        cw(hd, 0.18, 0.26, WHITE, 0, -0.11, -0.035); cw(hd, 0.14, 0.06, WHITE, 0, 0.15, -0.035); wb(hd, 0.24, 0.08, 0.18, WHITE, 0, 0.12, -0.025);     // the rounded skull and its stepped crown
        wb(hd, 0.22, 0.13, 0.18, WHITE, 0, -0.01, 0.11);                                                                                                            // the bridge of the nose and upper jaw
        for (const s of [-1, 1]) {
          wb(hd, 0.12, 0.1, 0.11, WHITE, s * 0.055, -0.085, 0.22);                                                                                                 // the two broad whisker pads
          wb(hd, 0.055, 0.05, 0.04, WHITE, s * 0.12, 0.14, -0.015).rotation.z = s * 0.35; wb(hd, 0.025, 0.025, 0.015, SHADE, s * 0.12, 0.155, 0.008);     // small ears tucked into the mane
          box(hd, 0.027, 0.038, 0.04, INK, s * 0.14, 0.045, 0.085); box(hd, 0.009, 0.012, 0.01, WHITE, s * 0.14 - 0.006, 0.068, 0.108);                  // deep-set eyes and their glints
          wb(hd, 0.085, 0.035, 0.05, WHITE, s * 0.12, 0.09, 0.075).rotation.z = -s * 0.28;                                                                        // a heavy, separately sculpted brow over each
          for (let i = 0; i < 3; i++) { wb(hd, 0.07, 0.16, 0.1, WHITE, s * (0.16 + i * 0.01), -0.18 + i * 0.1, -0.07 - i * 0.025).rotation.z = s * (0.12 + i * 0.1); box(hd, 0.012, 0.012, 0.012, SHADE, s * (0.035 + i * 0.022), -0.06 - (i & 1) * 0.025, 0.273); } // cheek locks, whisker pits
          wb(hd, 0.025, 0.07, 0.025, WHITE, s * 0.058, -0.19, 0.25); wb(hd, 0.025, 0.035, 0.025, WHITE, s * 0.055, -0.24, 0.24);                            // upper fangs and the smaller teeth below
        }
        box(hd, 0.105, 0.055, 0.045, NOSE, 0, -0.035, 0.29); box(hd, 0.016, 0.055, 0.018, NOSE, 0, -0.09, 0.278);                                             // a small broad nose, not a black muzzle; its philtrum
        wb(hd, 0.18, 0.13, 0.15, MAW, 0, -0.19, 0.17); box(hd, 0.16, 0.12, 0.025, MAW, 0, -0.19, 0.25); box(hd, 0.075, 0.02, 0.04, 0xa95462, 0, -0.25, 0.24); // the deep open mouth and its tongue
        wb(hd, 0.19, 0.05, 0.19, WHITE, 0, -0.275, 0.16); wb(hd, 0.15, 0.055, 0.09, WHITE, 0, -0.3, 0.2);                                                      // the dropped lower jaw and its chin
        const L = 0.38, spray = lit(FOAM, 0.35, 0xbfe4ff), y = (s: number) => 0.88 + 0.08 * s - 5.75 * s * s;                                                   // the jet's reach; its height s ahead of the mouth: level at first, then falling to the pool (at 0.08) by s = L
        const core = lit(0x94c8ff, 0.12, 0xbfe4ff), zc = 0.4 + L;                                                                                               // the jet's steady core, paler than the pool and dimmer by night so that the foam running on it shows; the z where it lands
        for (let i = 0; i < 10; i++) { const s0 = (L * i) / 10, s1 = (L * (i + 1)) / 10, w = 0.05 + 0.04 * (i / 9), o = box(m, w, w, Math.hypot(L / 10, y(s1) - y(s0)) + 0.01, FOAM, 0, (y(s0) + y(s1)) / 2 - w / 2, 0.4 + (s0 + s1) / 2); o.rotation.x = Math.atan2(y(s0) - y(s1), L / 10); o.material = core; } // ten steady segments along its arc, thickening as it spreads
        const flow = new THREE.Mesh(mergeGeometries(Array(22).fill(new THREE.BoxGeometry().toNonIndexed())), spray), [pos, nor] = ['position', 'normal'].map((k) => flow.geometry.getAttribute(k) as THREE.BufferAttribute), [p0, n0] = [pos, nor].map((a) => a.array.slice()); // the water that moves: 22 boxes in one mesh (a bead of foam, a drop, the side of a ripple), posed afresh every frame
        const pose = new THREE.Object3D(), vt = new THREE.Vector3();
        const put = (i: number, px: number, py: number, pz: number, pitch: number, w: number, h: number, d: number) => { // box i: its centre, its pitch (about x) and its size
          pose.position.set(px, py, pz); pose.rotation.x = pitch; pose.scale.set(w, h, d); pose.updateMatrix();
          for (let k = 36 * i; k < 36 * i + 36; k++) { vt.fromArray(p0, 3 * k).applyMatrix4(pose.matrix).toArray(pos.array, 3 * k); vt.fromArray(n0, 3 * k).applyQuaternion(pose.quaternion).toArray(nor.array, 3 * k); }
        };
        flow.frustumCulled = false; flow.receiveShadow = true; flow.geometry.userData.own = true; m.add(flow);                                                  // it moves: no shadow (the sun's map is not drawn again for what moves) and no culling by the bounds of its first pose
        flow.userData.tick = (t: number) => {
          let n = 0;
          for (let i = 0; i < 7; i++) { const p = (t / 0.9 + i / 7) % 1, s = L * p, w = (0.065 + 0.05 * p) * (1 + 0.2 * Math.sin(5 * i)) * Math.min(1, 6 * p, 6 - 6 * p); put(n++, 0, y(s), 0.4 + s, Math.atan(11.5 * s - 0.08), w, w, 0.05); } // beads of foam run down the arc, swelling out of the mouth and sinking into the pool
          for (let j = 0; j < 6; j++) { const q = (t / (0.7 + 0.06 * j) + 0.37 * j) % 1, r = (0.06 + 0.03 * (j % 3)) * q, e = 0.06 * Math.sqrt(Math.sin(Math.PI * q)); put(n++, r * Math.sin(2.4 * j), 0.09 + 0.72 * q * (1 - q), zc + 0.6 * r * Math.cos(2.4 * j), 0, e, e, e); } // drops leap from where it lands, each at its own pace and heading
          put(n++, 0, 0.1, zc, 0, 0.13 + 0.03 * Math.sin(8 * t), 0.04, 0.13 + 0.03 * Math.sin(8 * t));                                                          // the foam churning there
          for (let k = 0; k < 2; k++) { const q = (t / 1.4 + k / 2) % 1, r = 0.025 + 0.055 * q, e = 0.005 + 0.02 * (1 - q); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(n++, dx * r, 0.09, zc + dz * r, 0, dx ? e : 2 * r + e, 0.02, dx ? 2 * r + e : e); } // two ripples spreading over the pool and thinning out
          pos.needsUpdate = nor.needsUpdate = true;
        };
        flow.userData.tick(0);
      }),
    ],
    [ // Lv 2, Gardens by the Bay on the bank at the right: a lawn with a grove of three Supertrees, each a trunk wrapped in climbers and blue-lit at the neck under a canopy of pink and violet steel ribs flaring round a glowing bowl with a lime rim, the OCBC Skyway slung between the two tallest, and the Flower Dome and the Cloud Forest on the water's edge; lit by night
      final((g) => {
        const LAWN = 0x6fb55f, LEAF = 0x3f9a5c, LEAF2 = 0x2f7a4a, PINK = 0xd0368a, ROSE = 0xff8fd6, VIOLET = 0x8a46d0, LILAC = 0xcdb4ff, LIME = 0xb4e83c, GOLD = 0xf2c46d, BLUE = 0x6a78c8, PAVE = 0xd6cdbd, PALE = 0xe4eaf5, SKY = 0xcfeaf6, MINT = 0xc4ebd6; // paints
        stone(g, 0.9, 0.12, 1.2, PAVE, 0.75, 0, 1.2); box(g, 0.8, 0.04, 1.1, LAWN, 0.75, 0.12, 1.2);                                                            // the bank, the lawn on it
        const on = (o: THREE.Mesh, c: number, k: number, light: number) => (o.material = lit(c, k, light), o);                                                  // a part of a tree, shining after dusk: its paint c, k times the light
        const tree = (x: number, z: number, h: number, r: number, rib: number, rim: number, glow: number, rimGlow: number) => { // a Supertree h tall under a canopy r wide, its steel lit rib (paint and light) and rim
          const F = 0.1 + 0.9 * r, d = 0.4 * r + 0.02, yn = h - F, ct = 0.65 * F, N = 12;                                                                       // the canopy's depth, the radius of the cup at its heart, the height of the neck it springs from, the cup's height, the ribs
          on(cyl(g, 0.09, 0.12, LEAF2, x, 0.16, z), LEAF2, 0.3, 0x5fe08a); on(cyl(g, 0.06, yn - 0.34, LEAF2, x, 0.28, z), LEAF2, 0.3, 0x5fe08a);                // the trunk on its flared foot, green by night
          for (let k = 0; k < 12; k++) on(box(g, 0.06, 0.09, 0.06, k & 1 ? LEAF : LEAF2, x + 0.068 * Math.sin(2.4 * k), 0.3 + ((yn - 0.44) * k) / 11, z + 0.068 * Math.cos(2.4 * k)), k & 1 ? LEAF : LEAF2, 0.35, 0x7fe0a0); // tufts of climbers spiralling up it
          for (let k = 0; k < 6; k++) on(box(g, 0.03, 0.03, 0.03, GOLD, x + 0.15 * Math.sin((k * Math.PI) / 3), 0.16, z + 0.15 * Math.cos((k * Math.PI) / 3)), GOLD, 1, 0xffd9a0);    // garden lights ringing its foot
          on(cyl(g, 0.06, 0.06, BLUE, x, yn - 0.06, z), BLUE, 0.9, 0x5aa8ff);                                                                                   // the neck, blue by night
          for (let i = 0; i < 3; i++) on(cyl(g, 0.075 + ((d - 0.075) * i) / 2, ct / 3, GOLD, x, yn + (i * ct) / 3, z), GOLD, 0.9, 0xffa94d);                    // the cup that rises from it, widening, warm within
          on(cyl(g, d + 0.012, 0.02, LIME, x, yn + ct, z), LIME, 0.9, 0xb8ff40); on(cyl(g, d - 0.045, 0.015, GOLD, x, yn + ct + 0.02, z), GOLD, 0.9, 0xffa94d);                       // its rim, lime green, and the lit well inside
          const bend = [[0.08, 0.08], [d + 0.03, ct], [r, F], [r + 0.05, F + 0.035]];                                                                           // a rib's profile, (radius, height above the neck): out of the cup, over its rim, at the canopy's rim and at its tip, steep at first and flaring wider as it climbs
          for (let k = 0; k < N; k++) { // the ribs, each three struts
            const p = new THREE.Group(); p.position.set(x, yn, z); p.rotation.y = (k * 2 * Math.PI) / N - Math.PI / 2; g.add(p);
            for (const j of [0, 1, 2]) { const [r0, y0] = bend[j], [r1, y1] = bend[j + 1], q = new THREE.Group(); q.position.set(r0, y0, 0); q.rotation.z = -Math.atan2(r1 - r0, y1 - y0); p.add(q); on(box(q, 0.045, Math.hypot(r1 - r0, y1 - y0), 0.045, rib), rib, 0.7, glow); }
          }
          for (const [rr, yy, c, l] of [[d + 0.03, ct, rib, glow], [(d + 0.03 + r) / 2, (ct + F) / 2, rib, glow], [r, F, rim, rimGlow]]) for (let k = 0; k < N; k++) { const a = ((k + 0.5) * 2 * Math.PI) / N, e = rr * Math.cos(Math.PI / N); on(box(g, 2 * rr * Math.sin(Math.PI / N), 0.04, 0.045, c, x + e * Math.sin(a), yn + yy - 0.02, z + e * Math.cos(a)), c, c === rim ? 0.8 : 0.7, l).rotation.y = a; } // the rings that bind them: over the cup, between, and the pale one at the canopy's rim
        };
        tree(0.55, 0.9, 1.6, 0.3, PINK, ROSE, 0xff4fd8, 0xff9aea); tree(0.9, 1.1, 1.15, 0.24, VIOLET, LILAC, 0xa56bff, 0xcdb0ff); tree(1.02, 0.7, 1.25, 0.17, PINK, ROSE, 0xff4fd8, 0xff9aea);
        on(box(g, 0.51, 0.04, 0.07, 0xe6e9f0, 0.785, 0.72, 0.8), 0xe6e9f0, 0.3, 0xffd9a0).rotation.y = 0.402; on(box(g, 0.49, 0.012, 0.04, GOLD, 0.785, 0.76, 0.8), GOLD, 0.9, 0xffa94d).rotation.y = 0.402; // the OCBC Skyway, between the two tallest, its lamps along it
        const dome = (x: number, z: number, r: number, h: number, n: number, c: number) => { // a glass dome of n slices, r wide at its foot and h tall
          cyl(g, r + 0.03, 0.04, PALE, x, 0.16, z);                                                                                                             // its footing
          for (let i = 0; i < n; i++) cyl(g, r * Math.sqrt(1 - ((i + 0.5) / n) ** 2.2), h / n, c, x, 0.2 + (i * h) / n, z).material = lit(c, 0.5, WARM, true); // the glass in slices, lit from within by night
        };
        dome(0.52, 1.52, 0.28, 0.26, 5, SKY); dome(0.98, 1.5, 0.18, 0.4, 7, MINT);                                                                              // the Flower Dome, wide and low, the Cloud Forest, small and tall
      }),
    ],
  ],
  owner: shine,                                                                                                                                                 // the board tells the hotel who owns it
} satisfies ModelDef;
