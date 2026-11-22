import { Fragment, useMemo, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { COUNTRY, INVEST, PLAYER_DEFS, REGIONS, TILES, type InvestKind, type Tile } from '../../shared/data';
import { money } from '../../shared/msg';
import type { Block, Msg, Row } from '../../shared/types';
import { playVolumePreview } from '../audio';
import { ICONS, PAL, dieRows, faceRows, facePal, hex, lum, svgParts, type Pal } from '../render/art';
import { FLAG_PAL, flagRows } from '../render/flags';
import { fullscreen, setSoundVolume, soundMuted, soundVolume, state, toggleSoundMute, useCell } from '../store';

export { money };
export { hex };
export const inkOn = (c: number) => (lum(c) > 0.5 ? '#1a1c2c' : '#fff');

function Sprite({ rows, cls = '', pal = PAL, z = 1 }: { rows: string[]; cls?: string; pal?: Pal; z?: number }) {
  const { w, h, paths } = useMemo(() => svgParts(rows, pal), [rows, pal]);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox={`0 0 ${w} ${h}`} width={w * z} height={h * z} shapeRendering="crispEdges">
      {paths.map(([f, d], k) => <path key={k} fill={f} d={d} />)}
    </svg>
  );
}
export const Icon = ({ n }: { n: string }) => <Sprite rows={ICONS[n]} cls="ic" />;
export function FullBtn({ corner }: { corner?: boolean }) {
  const fs = useCell(fullscreen);
  if (!document.fullscreenEnabled) return null;
  return <button className={`btn sm${corner ? ' corner' : ''}`} id="btn-full" title={fs ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} onClick={() => fullscreen.set(!fs)}><Icon n={fs ? 'shrink' : 'full'} /></button>;
}
export function SoundBtn({ corner }: { corner?: boolean }) {
  const muted = useCell(soundMuted), volume = useCell(soundVolume);
  const off = muted || volume <= 0;
  const toggle = () => { toggleSoundMute(); if (!soundMuted.get()) playVolumePreview(); };
  return <button className={`btn sm${corner ? ' corner' : ''}`} id="btn-sound" title={off ? 'Unmute sound (M)' : 'Mute sound (M)'} onClick={toggle}><Icon n={off ? 'mute' : 'sound'} /></button>;
}
export function VolumeRow() {
  const muted = useCell(soundMuted), volume = useCell(soundVolume);
  const trackRef = useRef<HTMLDivElement>(null);
  const off = muted || volume <= 0;
  const shown = off ? 0 : volume;
  const pct = Math.round(shown * 100);
  const apply = (v: number) => {
    setSoundVolume(v);
    if (!soundMuted.get() && soundVolume.get() > 0) playVolumePreview();
  };
  const seek = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return;
    apply((clientX - r.left) / r.width);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(e.clientX);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e.clientX);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); apply(shown - 0.05); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); apply(shown + 0.05); }
    else if (e.key === 'Home') { e.preventDefault(); apply(0); }
    else if (e.key === 'End') { e.preventDefault(); apply(1); }
  };
  return (
    <div className="vol-row">
      <SoundBtn />
      <div ref={trackRef} className={`vol-track${off ? ' muted' : ''}`} role="slider" tabIndex={0} aria-label="Sound volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} onPointerDown={onDown} onPointerMove={onMove} onKeyDown={onKey}>
        <i style={{ width: `${pct}%` }} />
        <b style={{ left: `${pct}%` }} />
      </div>
      <span className={`vol-val${off ? ' dim' : ' gold'}`}>{off ? 'MUTE' : `${pct}%`}</span>
    </div>
  );
}
export function Face({ color }: { color: number }) {
  const [rows, pal] = useMemo(() => { const i = Math.max(0, PLAYER_DEFS.findIndex((p) => p.color === color)); return [faceRows(i), facePal(color, i)] as const; }, [color]);
  return <Sprite rows={rows} cls="face" pal={pal} />;
}
const FLAGS = new Map<string, string[]>();
export function Flag({ name, z = 2 }: { name: string; z?: number }) {
  const code = COUNTRY[name];
  if (!code) return null;
  if (!FLAGS.has(code)) FLAGS.set(code, flagRows(code));
  return <Sprite rows={FLAGS.get(code)!} cls="flag" pal={FLAG_PAL} z={z} />;
}
export const Named = ({ name, z }: { name: string; z?: number }) => <><Flag name={name} z={z} />{name}</>;
export const tileHead = (t: Tile) => ({
  title: <Named name={t.name} z={1} />, tone: t.color, ink: inkOn(t.color),
  sub: t.type === 'city' ? REGIONS[t.region!][0] : t.type === 'special' ? <><Icon n="star" /> SPECIAL {'\u00B7'} {REGIONS[t.region!][0]}</> : t.type === 'invest' ? INVEST[t.kind as InvestKind].label : 'Public tile',
});
export function Die({ v, cls = '', n = 16 }: { v: number; cls?: string; n?: number }) {
  const rows = useMemo(() => dieRows(v, n), [v, n]);
  return <div className={`die ${cls}`}><Sprite rows={rows} /></div>;
}

export function Rich({ m, z }: { m: Msg; z?: number }) {
  const S = state();
  return <>{m.map((s, k) => {
    if (typeof s === 'string') return s;
    if ('player' in s) return <b key={k} style={{ color: hex(S.players[s.player].color) }}>{S.players[s.player].name}</b>;
    if ('tile' in s) { const name = <Named name={TILES[s.tile].name} z={z} />; return s.bold ? <b key={k}>{name}</b> : <Fragment key={k}>{name}</Fragment>; }
    return <b key={k}>{s.bold}</b>;
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
      case 'note': return <div className="note" key={k}><Rich m={b.message} /></div>;
      case 'rows': return <Rows key={k} a={b.rows.map((r: Row): [ReactNode, ReactNode, string] => [<Rich m={r.label} />, r.tone ? <b className={r.tone}><Rich m={r.value} /></b> : <Rich m={r.value} />, r.sum ? 'sum' : ''])} />;
      case 'face': return <div key={k} style={{ display: 'flex', justifyContent: 'center' }}><Face color={S.players[b.player].color} /></div>;
    }
  })}</>;
}
