import * as THREE from 'three';
import { TILES, type Tile } from '../../shared/data';
import { LOT, PAD, POS } from './layout';
import { PK, type ModelDef } from './builder';
import { ISLETS } from './scenery';
import { BALL, FLOAT } from './world';

export interface Fixed {
  at: THREE.Vector3;
  color: number;
  power: number;
  reach: number;
  tile?: number;
  owned?: boolean;
  pulse?: 'flare' | 'beacon';
}

export const SCENERY: Fixed[] = [
  { at: new THREE.Vector3(ISLETS[1][0] + 0.3, 3.6, ISLETS[1][1]), color: 0xfff0c0, power: 28, reach: 13, pulse: 'beacon' },
  { at: new THREE.Vector3(ISLETS[4][0], 4.4, ISLETS[4][1]), color: 0xff7a1a, power: 24, reach: 14, pulse: 'flare' },
  { at: new THREE.Vector3(0, FLOAT - BALL + 0.6, BALL), color: 0x8fc4ff, power: 14, reach: 12 },
];

export const modelLamps = (defOf: (t: Tile) => ModelDef | undefined): Fixed[] => TILES.flatMap((t) => {
  const def = defOf(t), k0 = def?.scale ?? PK, base = t.type === 'public' ? 0 : PAD.h;
  return (def?.lamps ?? []).map((l) => {
    const k = l.final ? 1 : k0;
    return { at: new THREE.Vector3(POS[t.i].x + LOT.x + l.at[0] * k, POS[t.i].y + base + l.at[1] * k, POS[t.i].z + LOT.z + l.at[2] * k), color: l.color, power: l.power, reach: l.reach, tile: t.i, owned: l.owned, pulse: l.flicker ? 'flare' as const : undefined };
  });
});

export const fixedLamps = (defOf: (t: Tile) => ModelDef | undefined): Fixed[] => [...modelLamps(defOf), ...SCENERY];
