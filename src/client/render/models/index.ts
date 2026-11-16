import type { Group } from 'three';
import type { Tile } from '../../../shared/data';
import { drawProps, PK, type ModelDef } from '../builder';
import { level } from './city';

export { building, flag, sign } from './city';

const defs = import.meta.glob<{ default: ModelDef }>(['./special/*.ts', './invest/*.ts', './public/*.ts'], { eager: true });
const MODELS: Record<string, ModelDef> = {};
for (const m of Object.values(defs)) MODELS[m.default.key] = m.default;

export const defOf = (t: Tile) => MODELS[t.name] ?? MODELS[t.kind];
export const modelKey = (t: Tile) => defOf(t)?.key;
export const buildProps = (g: Group, t: Tile) => {
  const def = defOf(t);
  drawProps(g, def?.props ?? [], def?.scale ?? PK);
};
export const buildLevels = (g: Group, t: Tile, lv: number, m: boolean) => {
  const def = defOf(t);
  if (def?.levels) drawProps(g, def.levels.slice(0, lv).flat(), def.scale ?? PK);
  else level(g, lv, m);
};
export const modelOwner = (t: Tile, color: number | null) => defOf(t)?.owner?.(color);

let onModelChange: (keys: string[]) => void = () => {};
export const setModelHandler = (f: typeof onModelChange) => (onModelChange = f);
if (import.meta.hot) {
  import.meta.hot.accept(Object.keys(defs), (mods) => {
    const keys: string[] = [];
    mods?.forEach((m) => { const d = (m as { default?: ModelDef } | undefined)?.default; if (d) { MODELS[d.key] = d; keys.push(d.key); } });
    if (keys.length) onModelChange(keys);
  });
}
