import * as THREE from 'three';
import { box, cyl, emissive, final, GOLD, INK, type ModelDef } from '../../builder';
import { LAUNCH_PAD, MISSILE_LENGTH, MISSILE_NAME, MISSILE_SCALE, missile } from '../missile';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export default {
  key: 'military',
  props: [ // a missile launch complex: the rocket and its service gantry dominate the pad, with a flame trench, fuel tanks, radar and a low control bunker
    final((g) => {
      const { x: px, y: py, z: pz } = LAUNCH_PAD, gx = px - 0.64, gz = pz - 0.25;
      const OD = 0x5b6b3a, DARK = 0x3a4528, STEEL = 0x7b86a0, LIGHT = 0xcfd6e6, WALL = 0xb7bd96, GLASS = 0x7db6ff, RED = 0xd9423e, LAMP = 0x35e07a;
      const strut = (a: [number, number, number], b: [number, number, number]) => {
        const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), m = box(g, 0.045, d.length(), 0.045, STEEL);
        m.position.set(...a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
      };
      box(g, 2.3, 0.08, 1.95, 0xa9a48f);                                                                                  // hardened site
      box(g, 0.54, 0.035, 1.18, INK, px, 0.08, pz + 0.5); box(g, 0.34, 0.02, 0.92, 0x4a4f6e, px, 0.115, pz + 0.58); // flame trench and its scorched channel
      cyl(g, 0.82, 0.12, 0x8a8fa3, px, 0.08, pz); cyl(g, 0.7, 0.12, LIGHT, px, 0.2, pz);                              // circular launch pad, two concrete courses
      for (const x of [-0.34, 0.34]) for (const z of [-0.34, 0.34]) box(g, 0.12, 0.16, 0.12, DARK, px + x, 0.32, pz + z);
      cyl(g, 0.5, 0.12, OD, px, 0.36, pz); cyl(g, 0.34, 0.04, INK, px, 0.44, pz);                                     // launch mount and exhaust well
      for (const x of [-0.23, 0.23]) for (const z of [-0.23, 0.23]) box(g, 0.07, 3.08, 0.07, STEEL, gx + x, 0.16, gz + z); // service gantry
      for (let y = 0.38; y < 3.05; y += 0.53) {
        box(g, 0.54, 0.05, 0.05, LIGHT, gx, y, gz + 0.23); box(g, 0.05, 0.05, 0.54, LIGHT, gx + 0.23, y, gz);
        strut([gx - 0.23, y, gz + 0.23], [gx + 0.23, y + 0.48, gz + 0.23]); strut([gx + 0.23, y, gz - 0.23], [gx + 0.23, y + 0.48, gz + 0.23]);
      }
      for (const y of [0.82, 1.62, 2.42, 3.18]) {
        box(g, 0.64, 0.07, 0.62, DARK, gx, y, gz); box(g, 0.64, 0.08, 0.04, GOLD, gx, y + 0.07, gz + 0.29);
      }
      for (const y of [1.32, 2.12]) {                                                                                   // hinged service arms holding the rocket
        box(g, 0.55, 0.09, 0.13, OD, (gx + px) / 2 + 0.12, y, pz); box(g, 0.12, 0.18, 0.24, DARK, px - 0.25, y - 0.04, pz);
      }
      box(g, 0.05, 0.48, 0.05, INK, gx, 3.25, gz); box(g, 0.1, 0.1, 0.1, LAMP, gx, 3.73, gz, emissive(LAMP));       // lightning mast and warning lamp
      const rocket = new THREE.Group(); rocket.name = MISSILE_NAME;
      rocket.position.set(px, py + MISSILE_LENGTH * MISSILE_SCALE, pz); rocket.scale.setScalar(MISSILE_SCALE); missile(rocket); g.add(rocket);
      for (const z of [-0.64, -0.25]) {                                                                                 // propellant tanks, deliberately secondary
        cyl(g, 0.16, 0.52, LIGHT, 0.35, 0.08, z); cyl(g, 0.165, 0.1, RED, 0.35, 0.28, z); cyl(g, 0.12, 0.06, STEEL, 0.35, 0.6, z);
      }
      box(g, 0.52, 0.42, 0.62, WALL, 0.82, 0.08, -0.58); box(g, 0.58, 0.07, 0.68, DARK, 0.82, 0.5, -0.58);           // low blast-proof control bunker
      box(g, 0.34, 0.09, 0.025, GLASS, 0.82, 0.32, -0.26); box(g, 0.12, 0.24, 0.03, DARK, 0.82, 0.08, -0.25);
      box(g, 0.07, 0.68, 0.07, STEEL, 0.8, 0.08, 0.43);                                                                // radar pedestal
      const dish = cyl(g, 0.28, 0.06, LIGHT, 0.8, 0.75, 0.43); dish.rotation.x = -0.65;
      box(g, 0.04, 0.34, 0.04, DARK, 0.8, 0.72, 0.49).rotation.x = -0.65; box(g, 0.08, 0.08, 0.08, LAMP, 0.8, 1.04, 0.32, emissive(LAMP));
      for (let i = 0; i < 7; i++) box(g, 0.24, 0.08, 0.12, i & 1 ? INK : GOLD, -0.99 + i * 0.33, 0.08, 0.84);         // hazard kerb
      for (const z of [0.38, 0.61]) box(g, 0.32, 0.012, 0.045, GOLD, px, 0.12, z);
    }),
  ],
} satisfies ModelDef;
