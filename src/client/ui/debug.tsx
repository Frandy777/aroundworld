import { useEffect, useState, type ReactNode } from 'react';
import { TILES, maxLevel } from '../../shared/data';
import { canMortgage, command } from '../../shared/state';
import type { Cmd, NewsCard, Notice, Prompt } from '../../shared/types';
import { hold } from '../asks';
import { AUDIO_AUDITIONS, auditionSound } from '../audio';
import { quickGame } from '../controller';
import { devUrl, send } from '../net';
import { POS } from '../render/layout';
import { camera, controls, dirtyShadow, fitZoom, jumpTo, lod, resetView, viewAngles } from '../render/scene';
import { clock, wallHour } from '../render/sky';
import { loop, playStrike } from '../stage';
import { G, actionBtn, paused, selectedTile, session, stageOnly, useCell, type View } from '../store';
import { openAlert, openAsk, openNews, openNotice } from './open';

const SAMPLES: Record<string, Notice | NewsCard | Prompt> = {
  notice: {
    title: 'PAY RENT', sub: [{ tile: 1 }], tone: 0xb13e53, label: 'PAY $160', danger: true,
    body: [{ k: 'face', player: 1 }, { k: 'rows', rows: [{ label: ['Base rent'], value: ['$160'] }, { label: ['Total due'], value: ['$160'], sum: true, tone: 'bad' }] }],
  },
  news: { category: 'Money', title: 'Lost Wallet', text: 'You found an unclaimed wallet on the street.', amount: 100 },
  deed: { k: 'deed', tile: 1, mode: 'buy', price: 1600 },
  pick: {
    k: 'pick', of: 'tile', title: 'MORTGAGE TO PAY', sub: ['Ruby owes $1,200'], tone: 0x3b7bd9, hint: "You can't afford this. Mortgage properties to raise at least $1,100.",
    items: [{ index: 1, level: 2, amount: 800 }, { index: 2, level: 0, amount: 900 }], rule: { k: 'raise', cash: 100, need: 1200 }, label: 'MORTGAGE & PAY',
  },
  confirm: { k: 'confirm', title: "DEVIL'S ISLAND", sub: ['Ruby'], tone: 0x2d7d6f, body: [{ k: 'note', message: ['Pay $700 bail and only visit the Jail tile, with no stay?'] }], yes: 'PAY $700', no: 'GO TO JAIL' },
  dep: { k: 'dep', maxPrincipal: 12000 },
};
const sample = (k: string) => JSON.stringify(SAMPLES[k], null, 1);

let fake = 0;
function preview(text: string) {
  try {
    const x = JSON.parse(text);
    if ('k' in x) { const id = --fake, card = openAsk(id, x as Prompt); if (card) hold(id, () => card.close()); }
    else if ('category' in x) openNews(x as NewsCard);
    else openNotice(x as Notice);
  } catch (err) { void openAlert('PREVIEW', String(err)); }
}

type Opt = [label: ReactNode, on: boolean, click: () => void, off?: boolean];
const Seg = ({ opts, cls = '' }: { opts: Opt[]; cls?: string }) => (
  <div className={`seg ${cls}`}>{opts.map(([label, on, click, off], i) => <button key={i} className={on ? 'on' : ''} disabled={off} onClick={click}>{label}</button>)}</div>
);
const Field = ({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) => <div className="field"><label>{label}{note !== undefined && <b>{note}</b>}</label>{children}</div>;
const TilePick = ({ tile, set, children }: { tile: number; set: (i: number) => void; children?: ReactNode }) => (
  <div className="pl-row">
    <select value={tile} onChange={(e) => set(+e.target.value)}>{TILES.map((t) => <option key={t.i} value={t.i}>{t.i} {t.name}{t.variant ? ` (${t.variant})` : ''}</option>)}</select>
    {children}
  </div>
);
const focusTile = (i: number) => { controls.autoRotate = false; jumpTo(POS[i].x, POS[i].z, 2); loop.draw(); };
const mod24 = (h: number) => ((h % 24) + 24) % 24;
const hhmm = (h: number) => new Date(mod24(h) * 36e5).toISOString().slice(11, 16);
const LOD_NAMES = ['far', 'mid', 'near'] as const;

interface Pane { show: boolean; tile: number; setTile: (i: number) => void }

function Scene({ show, tile, setTile, view, bump }: Pane & { view: View; bump: () => void }) {
  const bare = useCell(stageOnly), { elev } = viewAngles();
  const wall = wallHour(), hour = clock.stop ?? mod24(wall + clock.shift);
  const setClock = (shift: number, stop: number | null) => { clock.shift = shift; clock.stop = stop; dirtyShadow(); loop.draw(); bump(); };
  const seek = (h: number) => setClock(clock.stop === null ? mod24(h - wall) : clock.shift, clock.stop === null ? null : mod24(h));
  const toggleStop = () => setClock(clock.stop === null ? clock.shift : mod24(clock.stop - wall), clock.stop === null ? hour : null);
  const setPace = (paused: boolean, scale = loop.scale) => { loop.paused = paused; loop.scale = scale; loop.draw(); bump(); };
  const cam = (f: () => void) => () => { controls.autoRotate = false; f(); bump(); };
  const fireStrike = () => { const from = (tile + Math.floor(TILES.length / 2)) % TILES.length; void playStrike(from, tile); };
  const orbit: Opt[] = view === 'game' ? [] : [['ORBIT', controls.autoRotate, () => { controls.autoRotate = !controls.autoRotate; bump(); }]];
  return (
    <div className="bd" hidden={!show}>
      <Field label="TILE">
        <TilePick tile={tile} set={setTile}>
          <button className="btn sm" onClick={() => { focusTile(tile); bump(); }}>FOCUS</button>
          <button className="btn sm" onClick={fireStrike}>STRIKE</button>
        </TilePick>
      </Field>
      <Field label="LOOK">
        <Seg opts={[['STAGE ONLY', bare, () => stageOnly.set(!bare)]]} />
      </Field>
      <Field label="CAMERA" note={`z ${camera.zoom.toFixed(2)} · fit ${fitZoom.toFixed(2)} · ${LOD_NAMES[lod.n] ?? '-'} · ${Math.round(elev)}°`}>
        <Seg opts={[['FIT', false, cam(() => { jumpTo(0, 0, 'fit'); loop.draw(); })], ['RESET', false, cam(() => void resetView())], ...orbit]} />
      </Field>
      <Field label="TIME OF DAY" note={hhmm(hour)}>
        <input type="range" min={0} max={24} step="any" value={hour} onChange={(e) => seek(+e.target.value)} />
        <Seg opts={[
          ['PAUSE', clock.stop !== null, toggleStop],
          ['LIVE', clock.stop === null && !clock.shift, () => setClock(0, null)],
          ...[0, 6.2, 12, 18].map((h): Opt => [hhmm(h), clock.stop === h, () => setClock(0, h)]),
        ]} />
      </Field>
      <Field label="ANIMATION">
        <Seg opts={[
          ['PAUSE', loop.paused, () => setPace(!loop.paused)],
          ...[0.25, 1, 2].map((s): Opt => [`${s}x`, !loop.paused && loop.scale === s, () => setPace(false, s)]),
          ['+0.2s', false, () => { loop.step(0.2); bump(); }, !loop.paused],
        ]} />
      </Field>
      <Field label="AUDIO">
        <div className="audition">
          {AUDIO_AUDITIONS.map(([label]) => <button key={label} className="btn sm" data-audio="none" onClick={() => auditionSound(label)}>{label}</button>)}
        </div>
      </Field>
    </div>
  );
}

const STATUS = {
  none: ['NO GAME', 'Start one with QUICK 4P.'],
  plain: ['NOT DEV', 'This room is not a dev room.'],
  wait: ['WAITING', 'Wait for your ROLL DICE.'],
  go: ['READY', 'Commands run before the roll.'],
} as const;

function Game({ show, tile, setTile }: Pane) {
  const { room } = useCell(session), run = useCell(actionBtn)?.submitAnswer, isPaused = useCell(paused), S = G.S;
  const [who, setWho] = useState(0), [lv, setLv] = useState(0), [mort, setMort] = useState(false), [draws, setDraws] = useState('3,4'), [cash, setCash] = useState('1000');
  const aim = TILES[tile], cap = maxLevel(aim), level = Math.min(lv, cap), mortgaged = mort && canMortgage(aim);
  const btn = (label: string, c: Cmd, cls = '') => <button className={`btn sm ${cls}`} disabled={!S || !run || !command(S, c)} onClick={() => run?.(c)}>{label}</button>;
  const st = !S ? 'none' : !room?.dev ? 'plain' : run ? 'go' : 'wait';
  return (
    <div className="bd" hidden={!show}>
      <div className="note"><span className={`badge ${st === 'go' ? 'gold' : 'dim'}`}>{STATUS[st][0]}</span>{STATUS[st][1]}</div>
      {S && room?.dev && (
        <>
          <Field label="TARGET">
            <TilePick tile={tile} set={setTile}><button className="btn sm" onClick={() => focusTile(tile)}>FOCUS</button></TilePick>
            <Seg cls="fit" opts={S.players.map((p, i): Opt => [p.name, who === i, () => setWho(i), !!p.bankruptRound])} />
          </Field>
          <Field label="TELEPORT">
            <div className="pl-row fill">{btn('MOVE', { c: 'goto', player: who, tile, resolveLanding: false })}{btn('LAND', { c: 'goto', player: who, tile, resolveLanding: true }, 'primary')}</div>
          </Field>
          <Field label="DEED">
            <Seg opts={[...[0, 1, 2, 3].map((n): Opt => [`Lv ${n}`, level === n, () => setLv(n), n > cap]), ['MORT', mortgaged, () => setMort(!mort), !canMortgage(aim)]]} />
            <div className="pl-row fill">{btn('GIVE', { c: 'own', tile, owned: { owner: who, level, mortgaged } })}{btn('CLEAR', { c: 'own', tile, owned: null })}</div>
          </Field>
          <div className="pair">
            <Field label="CASH">
              <div className="pl-row"><input inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} />{btn('SET', { c: 'cash', player: who, cash: Number(cash) })}</div>
            </Field>
            <Field label="ROOM">
              <button className={`btn sm ${isPaused ? 'on' : ''}`} onClick={() => send({ t: 'pause', paused: !isPaused })}>PAUSE GAME</button>
            </Field>
          </div>
          <Field label="NEXT DRAWS (dice, news card #...)">
            <div className="pl-row"><input value={draws} onChange={(e) => setDraws(e.target.value)} />{btn('SET', { c: 'draw', draws: draws.split(/\D+/).filter(Boolean).map(Number) })}</div>
          </Field>
        </>
      )}
    </div>
  );
}

function Cards({ show }: { show: boolean }) {
  const [kind, setKind] = useState('notice'), [json, setJson] = useState(() => sample('notice'));
  return (
    <div className="bd" hidden={!show}>
      <Field label="SAMPLE">
        <div className="pl-row">
          <select value={kind} onChange={(e) => { setKind(e.target.value); setJson(sample(e.target.value)); }}>{Object.keys(SAMPLES).map((k) => <option key={k}>{k}</option>)}</select>
          <button className="btn sm" onClick={() => preview(json)}>SHOW</button>
        </div>
      </Field>
      <Field label="JSON"><textarea rows={10} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} /></Field>
    </div>
  );
}

const TABS = ['scene', 'game', 'cards'] as const;

export function Debug() {
  const { view, room } = useCell(session), sel = useCell(selectedTile);
  const [open, setOpen] = useState(false), [tab, setTab] = useState<(typeof TABS)[number]>('scene'), [tile, setTile] = useState(1), [, setTick] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => { if (sel >= 0) setTile(sel); }, [sel]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [open]);

  if (!devUrl && !room?.dev) return null;
  const bump = () => setTick((n) => n + 1), pane = (t: (typeof TABS)[number]) => ({ show: tab === t, tile, setTile });
  return (
    <aside id="dev">
      <div className="dock">
        <button className={`btn sm ${open ? 'on' : ''}`} onClick={() => setOpen(!open)}>DEV</button>
        {!G.S && <button className="btn sm primary" disabled={busy} onClick={() => { setBusy(true); void quickGame(3).finally(() => setBusy(false)); }}>QUICK 4P</button>}
      </div>
      <div className="box" hidden={!open}>
        <nav className="tabs">{TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t.toUpperCase()}</button>)}</nav>
        <Scene {...pane('scene')} view={view} bump={bump} />
        <Game {...pane('game')} />
        <Cards show={tab === 'cards'} />
      </div>
    </aside>
  );
}
