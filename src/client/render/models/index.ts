import type { Group } from 'three';
import type { Tile } from '../../../shared/data';
import { drawProps, PK, type ModelDef } from '../builder';

export { building, flag, level, sign } from './city';

// One registered model per file under {special,invest,public}/<key>.ts (a ModelDef: its key, its props, an optional draw-scale override).
// special/ — the special cities' landmarks, each a monument of its own, keyed by city name.
// invest/  — the investments: the carriers keyed by name, the rest sharing one per kind; they stand on the owner's pad (see board.ts).
// public/  — the edge tiles that are not bought, keyed by kind: each keeps its signature floor (in its ground texture, see labels.ts) and one prop.
// Ordinary cities have no model here: their house/flag/sign are drawn by ownership (city.ts). The glob import finds the files, so a new or tuned model never touches a shared table.
const defs = import.meta.glob<{ default: ModelDef }>('./*/*.ts', { eager: true });
const MODELS: Record<string, ModelDef> = {};
for (const m of Object.values(defs)) MODELS[m.default.key] = m.default;

// The static props of tile t, drawn into g: a model keyed by the tile's name wins over one keyed by its kind
export const buildProps = (g: Group, t: Tile) => {
  const def = MODELS[t.name] ?? MODELS[t.kind];
  drawProps(g, def?.props ?? [], def?.scale ?? PK);
};
