import { useEffect, useState, type ReactNode } from 'react';
import { TILES, maxLevel } from '../../shared/data';
import { command } from '../../shared/state';
import type { Cmd, NewsCard, Notice, Prompt } from '../../shared/types';
import { hold } from '../asks';
import { quickGame } from '../controller';
import { devUrl } from '../net';
import { POS } from '../render/layout';
import { camera, controls, dirtyShadow, fitZoom, jumpTo, lod, resetView, viewAngles } from '../render/scene';
import { clock, wallHour } from '../render/sky';
import { loop, playStrike } from '../stage';
import { G, actionBtn, hd2d, selectedTile, session, stageOnly, useCell } from '../store';
import { openAlert, openAsk, openNews, openNotice } from './open';

// ---- The dev panel: available whenever opened with ?dev=1 (title, lobby or game), and in any dev room ----
// Scene controls (look, sky clock, camera readout, animation pace, strike test, quick 4P start) work everywhere, including over the SEED demo board;
// game-state commands answer the roll question (`Game.debug`), so they light up in a dev room while ROLL DICE is waiting.

const SAMPLES: Record<string, Notice | NewsCard | Prompt> = {
  notice: {
    title: 'PAY RENT', sub: [{ t: 1 }], tone: 0xb13e53, label: 'PAY $160', danger: true,
    body: [{ k: 'face', p: 1 }, { k: 'rows', rows: [{ l: ['Base rent'], v: ['$160'] }, { l: ['Total due'], v: ['$160'], sum: true, tone: 'bad' }] }],
  },
  news: { cat: 'Money', title: 'Lost Wallet', text: 'You found an unclaimed wallet on the street.', amt: 100 },
  deed: { k: 'deed', tile: 1, mode: 'buy', price: 1600 },
  pick: {
    k: 'pick', of: 'tile', title: 'MORTGAGE TO PAY', sub: ['Ruby owes $1,200'], tone: 0x3b7bd9, hint: "You can't afford this. Mortgage properties to raise at least $1,100.",
    items: [{ i: 1, lv: 2, amt: 800 }, { i: 2, lv: 0, amt: 900 }], rule: { k: 'raise', cash: 100, need: 1200 }, label: 'MORTGAGE & PAY',
  },
  confirm: { k: 'confirm', title: "DEVIL'S ISLAND", sub: ['Ruby'], tone: 0x2d7d6f, body: [{ k: 'note', m: ['Pay $700 bail and only visit the Jail tile, with no stay?'] }], yes: 'PAY $700', no: 'GO TO JAIL' },
};
const sample = (k: string) => JSON.stringify(SAMPLES[k], null, 1);

let fake = 0; // a previewed question has an id that no real one has
function preview(text: string) {
  try {
    const x = JSON.parse(text);
    if ('k' in x) { const id = --fake, card = openAsk(id, x as Prompt); if (card) hold(id, () => card.close()); }
    else if ('cat' in x) openNews(x as NewsCard);
    else openNotice(x as Notice);
  } catch (err) { void openAlert('PREVIEW', String(err)); }
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;
const mod24 = (h: number) => ((h % 24) + 24) % 24;
const hhmm = (h: number) => new Date(mod24(h) * 36e5).toISOString().slice(11, 16);
const LOD_NAMES = ['far', 'mid', 'near'] as const;

export function Debug() {
  const { view, room } = useCell(session), run = useCell(actionBtn)?.reply, sel = useCell(selectedTile);
  const isHd = useCell(hd2d), bare = useCell(stageOnly);
  const [open, setOpen] = useState(false), [, setTick] = useState(0), [busy, setBusy] = useState(false);
  const [who, setWho] = useState(0), [draws, setDraws] = useState('3,4'), [cash, setCash] = useState('1000');
  const [tile, setTile] = useState(1), [lv, setLv] = useState(0), [mort, setMort] = useState(false), [kind, setKind] = useState('notice'), [json, setJson] = useState(() => sample('notice'));
  useEffect(() => { if (sel >= 0) setTile(sel); }, [sel]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [open]);

  if (!devUrl && !room?.dev) return null;
  const S = G.S, bumpUi = () => setTick((n) => n + 1);
  const wall = wallHour(), hour = clock.stop ?? mod24(wall + clock.shift);
  const setClock = (shift: number, stop: number | null) => { clock.shift = shift; clock.stop = stop; dirtyShadow(); loop.draw(); bumpUi(); };
  const seek = (h: number) => setClock(clock.stop === null ? mod24(h - wall) : clock.shift, clock.stop === null ? null : mod24(h));
  const toggleStop = () => setClock(clock.stop === null ? clock.shift : mod24(clock.stop - wall), clock.stop === null ? hour : null);

  const { elev } = viewAngles(), lodLabel = LOD_NAMES[lod.n] ?? '-';
  const aim = TILES[tile], cap = maxLevel(aim), level = Math.min(lv, cap), mortgaged = mort && aim.mort > 0;
  const btn = (label: string, c: Cmd, cls = '') => <button className={`btn sm ${cls}`} disabled={!S || !run || !command(S, c)} onClick={() => run?.(c)}>{label}</button>;
  const fireStrike = () => { const from = (tile + Math.floor(TILES.length / 2)) % TILES.length; void playStrike(from, tile); };
  const setPace = (paused: boolean, scale = loop.scale) => { loop.paused = paused; loop.scale = scale; loop.draw(); bumpUi(); };

  return (
    <aside id="dev">
      <button className="btn sm" onClick={() => setOpen(!open)}>DEV</button>
      {open && (
        <div className="box"><div className="bd">
          <Field label={`LOOK & VIEW  z ${camera.zoom.toFixed(2)} / fit ${fitZoom.toFixed(2)} · ${lodLabel} · ${Math.round(elev)}°`}>
            <div className="seg">
              <button className={!isHd ? 'on' : ''} onClick={() => hd2d.set(false)}>PIXEL</button>
              <button className={isHd ? 'on' : ''} onClick={() => hd2d.set(true)}>HD-2D</button>
              <button className={bare ? 'on' : ''} onClick={() => stageOnly.set(!bare)}>STAGE ONLY</button>
              {view !== 'game' && <button className={controls.autoRotate ? 'on' : ''} onClick={() => { controls.autoRotate = !controls.autoRotate; bumpUi(); }}>ORBIT</button>}
            </div>
            <div className="seg">
              <button onClick={() => { controls.autoRotate = false; jumpTo(0, 0, 'fit'); loop.draw(); bumpUi(); }}>FIT</button>
              <button onClick={() => { controls.autoRotate = false; jumpTo(POS[tile].x, POS[tile].z, 2); loop.draw(); bumpUi(); }}>FOCUS TILE</button>
              <button onClick={() => { controls.autoRotate = false; void resetView(); bumpUi(); }}>RESET</button>
            </div>
          </Field>
          <Field label={`TIME OF DAY ${hhmm(hour)}`}>
            <input type="range" min={0} max={24} step="any" value={hour} onChange={(e) => seek(+e.target.value)} />
            <div className="seg">
              <button className={clock.stop !== null ? 'on' : ''} onClick={toggleStop}>PAUSE</button>
              <button className={clock.stop === null && !clock.shift ? 'on' : ''} onClick={() => setClock(0, null)}>LIVE</button>
              {[0, 6.2, 12, 18].map((h) => <button key={h} onClick={() => setClock(0, h)}>{hhmm(h)}</button>)}
            </div>
          </Field>
          <Field label="PACE & STAGE FX">
            <div className="seg">
              <button className={loop.paused ? 'on' : ''} onClick={() => setPace(!loop.paused)}>PAUSE</button>
              {[0.25, 1, 2].map((s) => <button key={s} className={!loop.paused && loop.scale === s ? 'on' : ''} onClick={() => setPace(false, s)}>{s}x</button>)}
              <button disabled={!loop.paused} onClick={() => { loop.step(0.2); bumpUi(); }}>+0.2s</button>
            </div>
          </Field>
          <Field label="TILE">
            <select value={tile} onChange={(e) => setTile(+e.target.value)}>{TILES.map((t) => <option key={t.i} value={t.i}>{t.i} {t.name}{t.variant ? ` (${t.variant})` : ''}</option>)}</select>
            <div className="pl-row">
              <button className="btn sm" onClick={() => { controls.autoRotate = false; jumpTo(POS[tile].x, POS[tile].z, 2); loop.draw(); bumpUi(); }}>LOOK</button>
              <button className="btn sm" onClick={fireStrike}>STRIKE</button>
              {!S && <button className="btn sm primary" disabled={busy} onClick={() => { setBusy(true); void quickGame(3).finally(() => setBusy(false)); }}>QUICK 4P</button>}
            </div>
            {room?.dev && S && (
              <>
                <div className="pl-row">
                  {btn('MOVE', { c: 'goto', pi: who, i: tile, land: false })}{btn('LAND', { c: 'goto', pi: who, i: tile, land: true }, 'primary')}
                  {btn('GIVE', { c: 'own', i: tile, o: { p: who, lv: level, m: mortgaged } })}{btn('CLEAR', { c: 'own', i: tile, o: null })}
                </div>
                <div className="seg">
                  {[0, 1, 2, 3].map((n) => <button key={n} className={level === n ? 'on' : ''} disabled={n > cap} onClick={() => setLv(n)}>Lv {n}</button>)}
                  <button className={mortgaged ? 'on' : ''} disabled={!aim.mort} onClick={() => setMort(!mort)}>MORT</button>
                </div>
              </>
            )}
          </Field>
          {room?.dev && S && (
            <>
              <div className="note">{run ? 'Commands run before the roll.' : 'Commands work while ROLL DICE is up.'}</div>
              <Field label="PLAYER"><div className="seg">{S.players.map((p, i) => <button key={i} className={who === i ? 'on' : ''} disabled={!!p.out} onClick={() => setWho(i)}>{p.name}</button>)}</div></Field>
              <Field label="NEXT DRAWS (dice, news card #...)">
                <div className="pl-row"><input value={draws} onChange={(e) => setDraws(e.target.value)} />{btn('SET', { c: 'draw', v: draws.split(/\D+/).filter(Boolean).map(Number) })}</div>
              </Field>
              <Field label="CASH">
                <div className="pl-row"><input inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} />{btn('SET', { c: 'cash', pi: who, v: Number(cash) })}</div>
              </Field>
            </>
          )}
          <Field label="CARD PREVIEW">
            <div className="pl-row">
              <select value={kind} onChange={(e) => { setKind(e.target.value); setJson(sample(e.target.value)); }}>{Object.keys(SAMPLES).map((k) => <option key={k}>{k}</option>)}</select>
              <button className="btn sm" onClick={() => preview(json)}>SHOW</button>
            </div>
            <textarea rows={6} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
          </Field>
        </div></div>
      )}
    </aside>
  );
}
