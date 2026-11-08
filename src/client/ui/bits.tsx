import { Fragment, useMemo, type ReactNode } from 'react';
import { COUNTRY, INVEST, PLAYER_DEFS, REGIONS, TILES, type InvestKind, type Tile } from '../../shared/data';
import { money } from '../../shared/msg';
import type { Block, Msg, Row } from '../../shared/types';
import { ICONS, PAL, dieRows, faceRows, facePal, hex, lum, svgParts, type Pal } from '../render/art';
import { FLAG_PAL, flagRows } from '../render/flags';
import { state } from '../store';

export { money };
export { hex };
export const inkOn = (c: number) => (lum(c) > 0.5 ? '#1a1c2c' : '#fff');

// ---- 16x16 sprites (see art.ts) ----
function Sprite({ rows, cls = '', pal = PAL, z = 1 }: { rows: string[]; cls?: string; pal?: Pal; z?: number }) {
  const { w, h, paths } = useMemo(() => svgParts(rows, pal), [rows, pal]);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox={`0 0 ${w} ${h}`} width={w * z} height={h * z} shapeRendering="crispEdges">
      {paths.map(([f, d], k) => <path key={k} fill={f} d={d} />)}
    </svg>
  );
}
export const Icon = ({ n }: { n: string }) => <Sprite rows={ICONS[n]} cls="ic" />;
export function Face({ color }: { color: number }) {
  const [rows, pal] = useMemo(() => { const i = Math.max(0, PLAYER_DEFS.findIndex((p) => p.color === color)); return [faceRows(i), facePal(color, i)] as const; }, [color]);
  return <Sprite rows={rows} cls="face" pal={pal} />;
}
const FLAGS = new Map<string, string[]>();
export function Flag({ name, z = 2 }: { name: string; z?: number }) { // the flag of a city's country (nothing for any other tile), z px to an art pixel
  const code = COUNTRY[name];
  if (!code) return null;
  if (!FLAGS.has(code)) FLAGS.set(code, flagRows(code));
  return <Sprite rows={FLAGS.get(code)!} cls="flag" pal={FLAG_PAL} z={z} />;
}
export const Named = ({ name, z }: { name: string; z?: number }) => <><Flag name={name} z={z} />{name}</>; // a city's name with its flag on the left
// A tile's card header. Not in tile.tsx (components only, so it hot-refreshes in place) nor a file of its own: hud and dialogs would then refresh together, and Vite would re-run controller and director as stray copies.
export const tileHead = (t: Tile) => ({
  title: <Named name={t.name} z={1} />, tone: t.color, ink: inkOn(t.color), // the flag at 1px to an art pixel: 17px high, inside the 20px capitals of the name
  sub: t.type === 'city' ? REGIONS[t.region!][0] : t.type === 'special' ? <><Icon n="star" /> SPECIAL {'\u00B7'} {REGIONS[t.region!][0]}</> : t.type === 'invest' ? INVEST[t.kind as InvestKind].label : 'Public tile',
});
export function Die({ v, cls = '', n = 16 }: { v: number; cls?: string; n?: number }) { // n x n art pixels: 16 for the HUD, 32 for the big casino dice
  const rows = useMemo(() => dieRows(v, n), [v, n]);
  return <div className={`die ${cls}`}><Sprite rows={rows} /></div>;
}

// ---- Text from the server is data (see Msg): it is made into elements here, never into markup ----
export function Rich({ m }: { m: Msg }) {
  const S = state();
  return <>{m.map((s, k) => {
    if (typeof s === 'string') return s;
    if ('p' in s) return <b key={k} style={{ color: hex(S.players[s.p].color) }}>{S.players[s.p].name}</b>;
    if ('t' in s) { const name = <Named name={TILES[s.t].name} />; return s.b ? <b key={k}>{name}</b> : <Fragment key={k}>{name}</Fragment>; }
    return <b key={k}>{s.b}</b>;
  })}</>;
}

export const Rows = ({ a }: { a: [ReactNode, ReactNode, string?][] }) => (
  <div className="rows">{a.map(([k, v, c = ''], i) => <div className={`row ${c}`} key={i}><span>{k}</span><b>{v}</b></div>)}</div>
);
export const Pips = ({ n, max }: { n: number; max: number }) => <span className="lv">{[...Array(max)].map((_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;

export function Blocks({ blocks }: { blocks: Block[] }) {
  const S = state();
  return <>{blocks.map((b, k) => {
    switch (b.k) {
      case 'note': return <div className="note" key={k}><Rich m={b.m} /></div>;
      case 'rows': return <Rows key={k} a={b.rows.map((r: Row): [ReactNode, ReactNode, string] => [<Rich m={r.l} />, r.tone ? <b className={r.tone}><Rich m={r.v} /></b> : <Rich m={r.v} />, r.sum ? 'sum' : ''])} />;
      case 'face': return <div key={k} style={{ display: 'flex', justifyContent: 'center' }}><Face color={S.players[b.p].color} /></div>;
    }
  })}</>;
}
