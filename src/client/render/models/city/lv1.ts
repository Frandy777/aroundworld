import { block, box, gable, glass, INK } from '../../builder';
import type { Kit } from './kit';

// Lv 1 — a cottage: an L of two gables (the main ridge along x, the entrance wing's across it) with a chimney and a garden path.
export function cottage(k: Kit) {
  const { g, wall, roof, lamps, dim, walk, bed, bulb } = k;
  block(g, 4, 3, 'win', wall, 0, 0, -0.2, lamps, 1); block(g, 2, 1, 'door', wall, 0, 0, 0.8, lamps, 2);    // the house, 2 x 1.5, and its entrance wing in front
  gable(g, 2.2, 1.7, 0.75, 0.9, roof, wall, 0, -0.2); gable(g, 1.2, 1.2, 0.55, 0.9, roof, wall, 0, 0.5, true); // its roof, the ridge along x, and the wing's gable across it
  box(g, 0.24, 0.9, 0.24, dim(0xa8503c), -0.65, 1.3, -0.4); box(g, 0.3, 0.05, 0.3, dim(0xa39a8c), -0.65, 2.15, -0.4); // chimney and its cap
  box(g, 0.26, 0.22, 0.02, dim(0x1a2250), 0, 1.0, 1.11); box(g, 0.18, 0.15, 0.03, dim(0x5b8fe8), 0, 1.04, 1.11, glass(dim(0x5b8fe8), lamps ? 0xffa63d : undefined)); // a window in the gable, lit after dusk
  walk(0.4, 1.05); bed(-0.76, 0, 0.68, 0.44); bed(0.76, 0, 0.68, 0.44);                                      // the path from the door, a flower bed under the windows either side
  for (const x of [-0.4, 0.4]) { box(g, 0.05, 0.4, 0.05, dim(INK), x, 0, 1.45); bulb(x, 0.4, 1.45, 0.11); }  // a lamp post either side of the path
}
