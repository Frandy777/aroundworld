import * as THREE from 'three';
import { shade } from '../art';
import { box, plaque, GOLD } from '../builder';
import { kit } from './city/kit';
import { cottage } from './city/lv1';
import { villa } from './city/lv2';
import { tower } from './city/lv3';

// Buildings on the plot, built from whole storeys (see `block`: a taller house has more windows, never bigger ones): walls in the region's tint, the roofs,
// parapets and railings in the owner's colour, the trim white and gold; all of it grey when mortgaged. Each level has a silhouette and a storey count of its
// own (1, 2, 5), so they read apart at any zoom, and none is a stack of centred cubes — one file each under city/ (lv1 a cottage, lv2 a villa, lv3 a glass
// tower), all of them over the shared palette and small props of city/kit.ts. Relief (a stoop, a floor set back, the rim of a roof) is only what does not
// hide what is below it from this camera: a balcony is open, an overhang a hand's breadth.
export function building(g: THREE.Group, lv: number, wall: number, roof: number, m: boolean) {
  const k = kit(g, wall, roof, m);
  (lv === 1 ? cottage : lv === 2 ? villa : tower)(k);
}
// Owner flag (empty lots and investments) / "for sale" sign: both stand at the front-left corner of the plot, in the building group's space
const SPOT = [-0.85, 1.2], BACK = 0x5e3d1e; // BACK: the bare timber of a sign's back, darker than its post: seen from behind it is not a white board
export const flag = (g: THREE.Group, color: number) => {
  const [x, z] = SPOT, cx = x + 0.75, dark = shade(new THREE.Color(color).getHex(), 0.7);
  box(g, 0.45, 0.14, 0.45, 0xb9b2a0, x, 0, z); box(g, 0.14, 2.6, 0.14, 0xe8e8e8, x, 0.14, z); box(g, 0.28, 0.28, 0.28, GOLD, x, 2.74, z);
  box(g, 1.4, 0.85, 0.08, color, cx, 1.8, z); box(g, 1.4, 0.16, 0.09, dark, cx, 1.8, z);
};
export const sign = (g: THREE.Group) => { const z = SPOT[1] + 0.35; box(g, 0.14, 0.9, 0.14, 0x8a5a2b, 0, 0, z - 0.1); plaque(g, 'SALE', '#fff', '#d9423e', 1.8, 0.85, 0, 0.7, z, 'sign', BACK, 2); }; // out on the apron, clear of the props behind it
// A special city's landmark stands on its plot at every level, so an upgrade is posted on a small gold sign at the front-left corner instead (unless its model builds the upgrades itself, see buildLevels)
export const level = (g: THREE.Group, lv: number, m: boolean) => {
  if (!lv) return;
  const [x, z] = SPOT;
  box(g, 0.1, 0.4, 0.1, 0x8a5a2b, x + 0.5, 0, z - 0.1); plaque(g, 'LV ' + lv, m ? '#8c8c8c' : '#ffd23f', '#23263a', 1.0, 0.5, x + 0.5, 0.35, z, 'sign', BACK);
};
