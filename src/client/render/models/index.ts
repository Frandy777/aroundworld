import type { Group } from 'three';
import type { Tile } from '../../../shared/data';
import { drawProps, PK, type ModelDef } from '../builder';
import { level } from './city';

export { building, flag, sign } from './city';

// One registered model per file under {special,invest,public}/<key>.ts (a ModelDef: its key, its props, an optional draw-scale override).
// special/ — the special cities' landmarks, each a monument of its own, keyed by city name; one may list `levels`, the landmarks its upgrades add round it, and an `owner`, to light up for whoever owns it.
// invest/  — the investments: the carriers keyed by name, the rest sharing one per kind; they stand on the owner's pad (see board.ts).
// public/  — the edge tiles that are not bought, keyed by kind: each keeps its signature floor (in its ground texture, see labels.ts) and one prop.
// Ordinary cities have no model here: their buildings (one file per level under city/) and flag/sign are drawn by ownership (city.ts). The glob names the
// registered directories itself: a model file dropped under one of them is found, helpers like city/ and missile.ts are not, and none touches a shared table.
const defs = import.meta.glob<{ default: ModelDef }>(['./special/*.ts', './invest/*.ts', './public/*.ts'], { eager: true });
const MODELS: Record<string, ModelDef> = {};
for (const m of Object.values(defs)) MODELS[m.default.key] = m.default;

// The static props of tile t, drawn into g: a model keyed by the tile's name wins over one keyed by its kind
export const defOf = (t: Tile) => MODELS[t.name] ?? MODELS[t.kind];
export const modelKey = (t: Tile) => defOf(t)?.key;
export const buildProps = (g: Group, t: Tile) => {
  const def = defOf(t);
  drawProps(g, def?.props ?? [], def?.scale ?? PK);
};
// The level lv of special tile t, drawn into g, the building group: what its upgrades have built (see ModelDef.levels), the props of level 1 and of every level up to lv, which say the level themselves;
// a model without upgrades gets the small gold sign instead (m: mortgaged)
export const buildLevels = (g: Group, t: Tile, lv: number, m: boolean) => {
  const def = defOf(t);
  if (def?.levels) drawProps(g, def.levels.slice(0, lv).flat(), def.scale ?? PK);
  else level(g, lv, m);
};
// Tells the model of tile t who owns the lot (see ModelDef.owner)
export const modelOwner = (t: Tile, color: number | null) => defOf(t)?.owner?.(color);

// A model file saved while developing is accepted here: MODELS is updated in place and the board rebuilds only the tiles that draw it —
// the camera, the clock and the lighting never notice (see board.rebuild).
let onModelChange: (keys: string[]) => void = () => {};
export const setModelHandler = (f: typeof onModelChange) => (onModelChange = f);
if (import.meta.hot) {
  import.meta.hot.accept(Object.keys(defs), (mods) => {
    const keys: string[] = [];
    mods?.forEach((m) => { const d = (m as { default?: ModelDef } | undefined)?.default; if (d) { MODELS[d.key] = d; keys.push(d.key); } });
    if (keys.length) onModelChange(keys);
  });
}
