import type { Group } from 'three';
import type { Tile } from '../../../shared/data';
import { drawProps, type Prop } from '../builder';
import { INVEST_PROPS } from './invest';
import { LANDMARK_PROPS } from './landmarks';
import { PUBLIC_PROPS } from './public';

export { building, flag, level, sign } from './city';

const PK = 1.25; // props are drawn this much bigger than authored (see FIT for the wide ones)
const FIT: Record<string, number> = { bank: 1.2, exchange: 1.15, jail: 1.45 }; // per-kind scale where PK would overflow the strip (or, the jail, can hold four prisoners)
const PROPS: Record<string, Prop[]> = { ...PUBLIC_PROPS, ...INVEST_PROPS, ...LANDMARK_PROPS };

// The static props of tile t, drawn into g: every special city and every carrier has a model of its own, the rest share one per kind
export const buildProps = (g: Group, t: Tile) => {
  const key = PROPS[t.name] ? t.name : t.kind;
  drawProps(g, PROPS[key] ?? [], FIT[key] ?? PK);
};
