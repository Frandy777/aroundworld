import * as THREE from 'three';
import { BOARD_K, DENSITY } from './scene';
import { TILES } from '../../shared/data';

// ---- Layout: the map design (see the map in game-rules.md), one closed loop of straight runs, walked counter-clockwise from START in the bottom-right corner ----
const S = 3 * BOARD_K, SZ = 128 / DENSITY, TOP = 0.6, SLAB = TOP + 0.8, WIDE = SZ + S; // cell size, tile size (128 texels, 4 short of the cell), tile top height, slab height (its foot is at the sea, y = -0.8), START's slab: two cells
const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const MOVES = 'N6 W4 N3 E4 N6 W4 S4 W7 N4 W4 S6 E4 S3 W4 S6 E4 N4 E7 S4 E4';
const cells: [number, number][] = [[0, 0]];
for (const [, d, n] of MOVES.matchAll(/([NSEW])(\d+)/g))
  for (let k = 0; k < +n; k++) { const [x, y] = cells[cells.length - 1], [dx, dy] = DIRS[d]; cells.push([x + dx, y + dy]); }
cells.pop(); // the final step lands back on START
const mid = (a: number[]) => (Math.min(...a) + Math.max(...a)) / 2;
const cx = mid(cells.map((c) => c[0])), cy = mid(cells.map((c) => c[1]));
// 92 cells for 91 tiles: START is two cells wide, and the loop's last cell (POS[TILES.length]) is its wing
export const POS = cells.map(([x, y]) => new THREE.Vector3((x - cx) * S, TOP, (y - cy) * S));
// START's slab covers its own cell and the wing: MID is the way from START's centre to the slab's, CENTRE the slab's centre
const MID = POS[TILES.length].clone().sub(POS[0]).multiplyScalar(0.5), CENTRE = POS[0].clone().add(MID);
export { S, TOP, SLAB, SZ, WIDE, MID, CENTRE };
// Every slab as [centre x, centre z, half width, half depth] (seen from above): what the sea washes against
export const FOOT = [...POS.slice(1, TILES.length).map((p) => [p.x, p.z, SZ / 2, SZ / 2]), [CENTRE.x, CENTRE.z, WIDE / 2, SZ / 2]];

// ---- Tile layout (tile space: x east, z south toward the default camera; the tiles are fixed, only the camera turns) ----
// The tile is split in two. RIGHT strip = the city: an owner-coloured plot with the building (or props) on it, the one thing that carries
// ownership and level, so it takes the most room and all the height. LEFT half = information: the card at the back, the tokens' yard in front
// (the dice land between its two rows). Nothing tall stands in the left half, so from the default camera no tower can hide a card or a token, not even
// the tower of the tile in front of it.
const M = 0.25;                                             // margin between the tile edge and what stands on it
export const LOT = { x: 1.6, z: 1.0 };                      // building / props group centre, in the middle of the strip
export const PAD = { x: 1.6, z: 1.225, w: 2.5, d: 3.25, h: 0.3 };  // the plot: the whole strip, the building's depth + a front apron; owner colour shows all round the base
export const CARD = { w: 2.9, d: 2.175, x: M + 1.45 - SZ / 2, z: M + 1.0875 - SZ / 2 }; // info card, tucked into the back-left corner
// START is two cells wide, so its contents make two clusters, each laid out exactly like a tile's own (same margins) in one of its cells: the information (card, tokens'
// yard, dice) in the wing, west of START's own cell, and the props (the gate) in START's own cell. home(i) is what a tile's information is laid out around: its centre, or for START the wing's
export const home = (i: number) => POS[i || TILES.length];
