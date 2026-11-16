import * as THREE from 'three';
import { BOARD_K, DENSITY } from './scene';

const S = 3 * BOARD_K, SZ = 128 / DENSITY, TOP = 0.6, SLAB = TOP + 0.8;
const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const MOVES = 'N6 W4 N3 E4 N6 W4 S4 W7 N4 W4 S6 E4 S3 W4 S6 E4 N4 E7 S4 E4';
const cells: [number, number][] = [[0, 0]];
for (const [, d, n] of MOVES.matchAll(/([NSEW])(\d+)/g))
  for (let k = 0; k < +n; k++) { const [x, y] = cells[cells.length - 1], [dx, dy] = DIRS[d]; cells.push([x + dx, y + dy]); }
cells.pop();
const mid = (a: number[]) => (Math.min(...a) + Math.max(...a)) / 2;
const cx = mid(cells.map((c) => c[0])), cy = mid(cells.map((c) => c[1]));
export const POS = cells.map(([x, y]) => new THREE.Vector3((x - cx) * S, TOP, (y - cy) * S));
export { S, TOP, SLAB, SZ };
export const FOOT = POS.map((p) => [p.x, p.z, SZ / 2, SZ / 2]);

const M = 0.25;
export const LOT = { x: 1.6, z: 1.0 };
export const PAD = { x: 1.6, z: 1.225, w: 2.5, d: 3.25, h: 0.3 };
export const CARD = { w: 2.9, d: 2.175, x: M + 1.45 - SZ / 2, z: M + 1.0875 - SZ / 2 };
