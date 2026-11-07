import { Fragment, useMemo, type ReactNode } from 'react';
import { COUNTRY, PLAYER_DEFS, TILES } from '../../shared/data';
import { money } from '../../shared/msg';
import type { Block, Msg, Row } from '../../shared/types';
import { ICONS, PAL, dieRows, faceRows, facePal, svgParts, type Pal } from '../render/art';
import { FLAG_PAL, flagRows } from '../render/flags';
import { state } from '../store';

export { money };
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const lum = (c: number) => (((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114) / 255;
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
export function Flag({ name }: { name: string }) { // the flag of a city's country (nothing for any other tile)
  const code = COUNTRY[name];
  if (!code) return null;
  if (!FLAGS.has(code)) FLAGS.set(code, flagRows(code));
  return <Sprite rows={FLAGS.get(code)!} cls="flag" pal={FLAG_PAL} z={2} />;
}
export const Named = ({ name }: { name: string }) => <><Flag name={name} />{name}</>; // a city's name with its flag on the left
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
      case 'owner': { const p = S.players[b.p]; return <div className="owner" key={k}><Face color={p.color} /><b style={{ color: hex(p.color) }}>{p.name}</b><span className="dim">{b.text}</span></div>; }
    }
  })}</>;
}
