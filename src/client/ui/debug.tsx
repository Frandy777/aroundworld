import { useEffect, useState, type ReactNode } from 'react';
import { TILES } from '../../shared/data';
import type { Cmd, NewsCard, Notice, Prompt } from '../../shared/types';
import { hold } from '../asks';
import { G, actionBtn, selectedTile, session, useCell } from '../store';
import { openAlert, openAsk, openNews, openNotice } from './open';

// ---- The dev panel: in a dev room (made from a page opened with ?dev=1) ----
// Its commands go to the server as answers to the roll question (see `Game.debug`), so they work while ROLL DICE is up. The preview is local: it shows a card the game knows nothing of.

// What the preview starts from. Anything of these shapes can be put in its place: a Prompt has `k`, a NewsCard has `cat`, the rest is a Notice.
const SAMPLES: Record<string, Notice | NewsCard | Prompt> = {
  notice: {
    title: 'PAY RENT', sub: [{ t: 1 }], tone: 0xb13e53, label: 'PAY $160', danger: true,
    body: [{ k: 'owner', p: 1, text: 'collects' }, { k: 'rows', rows: [{ l: ['Base rent'], v: ['$160'] }, { l: ['Total due'], v: ['$160'], sum: true, tone: 'bad' }] }],
  },
  news: { cat: 'Money', title: 'Lost Wallet', text: 'You found an unclaimed wallet on the street.', amt: 100 },
  deed: { k: 'deed', tile: 1, mode: 'buy', price: 1600 },
  pick: {
    k: 'pick', of: 'tile', title: 'MORTGAGE TO PAY', sub: ['Ruby owes $1,200'], tone: 0x3b7bd9, hint: "You can't afford this. Mortgage properties to raise at least $1,100.",
    items: [{ i: 1, amt: 800 }, { i: 2, amt: 900 }], rule: { k: 'raise', cash: 100, need: 1200 }, label: 'MORTGAGE & PAY',
  },
  confirm: { k: 'confirm', title: "DEVIL'S ISLAND", sub: ['Ruby'], tone: 0x2d7d6f, body: [{ k: 'note', m: ['Pay $700 bail and only visit the Jail tile, with no stay?'] }], yes: 'PAY $700', no: 'GO TO JAIL' },
};
const sample = (k: string) => JSON.stringify(SAMPLES[k], null, 1);

let fake = 0; // a previewed question has an id that no real one has
function preview(text: string) {
  try {
    const x = JSON.parse(text);
    if ('k' in x) { const id = --fake, card = openAsk(id, x as Prompt); if (card) hold(id, () => card.close()); } // its buttons answer to nobody: the server ignores an id it never asked
    else if ('cat' in x) openNews(x as NewsCard);
    else openNotice(x as Notice);
  } catch (err) { void openAlert('PREVIEW', String(err)); }
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;

export function Debug() {
  const room = useCell(session).room, run = useCell(actionBtn)?.reply, sel = useCell(selectedTile); // run: there while the roll question is open
  const [open, setOpen] = useState(false), [who, setWho] = useState(0), [draws, setDraws] = useState('3,4'), [cash, setCash] = useState('1000');
  const [tile, setTile] = useState(0), [lv, setLv] = useState(0), [mort, setMort] = useState(false), [kind, setKind] = useState('notice'), [json, setJson] = useState(() => sample('notice'));
  useEffect(() => { if (sel >= 0) setTile(sel); }, [sel]); // a tile clicked on the board is the one aimed at
  const S = G.S;
  if (!room?.dev || !S) return null;
  const btn = (label: string, c: Cmd, cls = '') => <button className={`btn sm ${cls}`} disabled={!run} onClick={() => run?.(c)}>{label}</button>;
  return (
    <aside id="dev">
      <button className="btn sm" onClick={() => setOpen(!open)}>DEV</button>
      {open && (
        <div className="box"><div className="bd">
          <div className="note">{run ? 'Commands run before the roll.' : 'Commands work while ROLL DICE is up.'}</div>
          <Field label="PLAYER"><div className="seg">{S.players.map((p, i) => <button key={i} className={who === i ? 'on' : ''} onClick={() => setWho(i)}>{p.name}</button>)}</div></Field>
          <Field label="NEXT DRAWS (dice, news card #...)">
            <div className="pl-row"><input value={draws} onChange={(e) => setDraws(e.target.value)} />{btn('SET', { c: 'draw', v: draws.split(/\D+/).filter(Boolean).map(Number) })}</div>
          </Field>
          <Field label="CASH">
            <div className="pl-row"><input inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} />{btn('SET', { c: 'cash', pi: who, v: Number(cash) })}</div>
          </Field>
          <Field label="TILE">
            <select value={tile} onChange={(e) => setTile(+e.target.value)}>{TILES.map((t) => <option key={t.i} value={t.i}>{t.i} {t.name}{t.variant ? ` (${t.variant})` : ''}</option>)}</select>
            <div className="pl-row">
              {btn('MOVE', { c: 'goto', pi: who, i: tile, land: false })}{btn('LAND', { c: 'goto', pi: who, i: tile, land: true }, 'primary')}
              {btn('GIVE', { c: 'own', i: tile, o: { p: who, lv, m: mort } })}{btn('CLEAR', { c: 'own', i: tile, o: null })}
            </div>
            <div className="seg">
              {[0, 1, 2, 3].map((n) => <button key={n} className={lv === n ? 'on' : ''} onClick={() => setLv(n)}>Lv {n}</button>)}
              <button className={mort ? 'on' : ''} onClick={() => setMort(!mort)}>MORT</button>
            </div>
          </Field>
          <Field label="PREVIEW">
            <div className="pl-row">
              <select value={kind} onChange={(e) => { setKind(e.target.value); setJson(sample(e.target.value)); }}>{Object.keys(SAMPLES).map((k) => <option key={k}>{k}</option>)}</select>
              <button className="btn sm" onClick={() => preview(json)}>SHOW</button>
            </div>
            <textarea rows={8} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
          </Field>
        </div></div>
      )}
    </aside>
  );
}
