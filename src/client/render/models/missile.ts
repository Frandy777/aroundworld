import * as THREE from 'three';
import { box, cyl, mat, part } from '../builder';

export const MISSILE_NAME = 'military-missile';
export const MISSILE_LENGTH = 2.6;
export const MISSILE_SCALE = 1.2;
export const LAUNCH_PAD = { x: -0.22, y: 0.48, z: -0.12 };

const NOSE = new THREE.ConeGeometry(0.14, 0.62, 12);
const fin = new THREE.Shape();
fin.moveTo(0.12, -1.89); fin.lineTo(0.35, -2.38); fin.lineTo(0.35, -2.49); fin.lineTo(0.12, -2.4); fin.closePath();
const FIN = new THREE.ExtrudeGeometry(fin, { depth: 0.035, bevelEnabled: false }).translate(0, 0, -0.0175);

// The origin is the nose and local +Y is forward, so a flight path can aim the whole model with one quaternion.
export function missile(g: THREE.Group) {
  const WHITE = 0xe8edf0, STEEL = 0x9caeb9, DARK = 0x354650;
  part(g, NOSE, 0.62, mat(STEEL), 0, -0.62, 0);
  cyl(g, 0.14, 1.76, WHITE, 0, -2.38, 0);
  cyl(g, 0.145, 0.055, DARK, 0, -0.75, 0);
  cyl(g, 0.146, 0.08, STEEL, 0, -1.85, 0);
  cyl(g, 0.15, 0.1, STEEL, 0, -2.48, 0);
  cyl(g, 0.105, 0.12, DARK, 0, -MISSILE_LENGTH, 0);
  for (let i = 0; i < 4; i++) part(g, FIN, 0, mat(DARK), 0, 0, 0).rotation.y = i * Math.PI / 2;
  box(g, 0.025, 1.05, 0.018, STEEL, 0, -2.06, 0.14);
}
