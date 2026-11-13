import * as THREE from 'three';
import { TILES, type Tile } from '../../shared/data';
import { LOT, PAD, POS } from './layout';
import { PK, type ModelDef } from './builder';
import { ISLETS } from './scenery';
import { FLOAT } from './world';

// ---- The fixed lamps (slots LAMP.fixed..LAMP.city of light.ts): the warm pools the landmarks shine with after dusk. Each tile model
// declares its own (see ModelDef.lamps), resolved here to world space over its lot exactly as its props are drawn; the three lights off the
// board have no model to carry them and stay below. hd2d.ts parks the roster in the slots and only dims it from there. ----
export interface Fixed {
  at: THREE.Vector3;                 // world position
  color: number;                     // lamp colour
  power: number;                     // intensity at full night (the sky's lamp share scales it)
  reach: number;                     // falloff distance, world units
  tile?: number;                     // the lot it belongs to: out while that tile is hidden (see board.lotVisible)
  owned?: boolean;                   // on only while the lot stands lit — bought and not mortgaged (see board.lotLit)
  pulse?: 'flare' | 'beacon';        // how it breathes: the oil flares' quick flicker, or the lighthouse's slow sweep
}

// The three lights off the board: no tile model can carry them.
export const SCENERY: Fixed[] = [
  { at: new THREE.Vector3(ISLETS[1][0] + 0.3, 3.6, ISLETS[1][1]), color: 0xfff0c0, power: 28, reach: 13, pulse: 'beacon' }, // the lighthouse
  { at: new THREE.Vector3(ISLETS[4][0], 4.4, ISLETS[4][1]), color: 0xff7a1a, power: 24, reach: 14, pulse: 'flare' },      // the volcano's lava
  { at: new THREE.Vector3(0, FLOAT, 0), color: 0x8fc4ff, power: 14, reach: 12 },                                          // the globe
];

// Every tile's lamps (see ModelDef.lamps), resolved over its lot the way its props are drawn: `at` in the model's authored units times its
// draw scale, or straight final units when `final` is set; y measured up from the plot top, which a public tile has none of.
export const modelLamps = (defOf: (t: Tile) => ModelDef | undefined): Fixed[] => TILES.flatMap((t) => {
  const def = defOf(t), k0 = def?.scale ?? PK, base = t.type === 'public' ? 0 : PAD.h;
  return (def?.lamps ?? []).map((l) => {
    const k = l.final ? 1 : k0;
    return { at: new THREE.Vector3(POS[t.i].x + LOT.x + l.at[0] * k, POS[t.i].y + base + l.at[1] * k, POS[t.i].z + LOT.z + l.at[2] * k), color: l.color, power: l.power, reach: l.reach, tile: t.i, owned: l.owned, pulse: l.flicker ? 'flare' as const : undefined };
  });
});

// The whole roster, the models' in tile order and then the scenery's: the order they take the fixed slots in.
export const fixedLamps = (defOf: (t: Tile) => ModelDef | undefined): Fixed[] => [...modelLamps(defOf), ...SCENERY];
