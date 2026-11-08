import { Fragment, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';
import { LEVEL_NAMES, REGIONS, TILES, maxLevel } from '../../shared/data';
import { maxRounds } from '../../shared/state';
import { leaveRoom } from '../controller';
import { CAM, focusTok, lookAtMap, lookAtTile, setMinimap } from '../stage';
import { G, actionBtn, activeTab, cards, cashEls, floats, hudLive, lastRoll, selectedTile, session, showMinimap, state, statsOf, tip, toasts, useCell, useGame, viewedPlayer, waitingFor, type Tab } from '../store';
import { Die, Face, Flag, Icon, Named, Pips, Rich, hex, money, tileHead } from './bits';
import { minimapToWorld } from './minimap';
import { openMenu, openRules } from './open';
import { TileBody } from './tile';

// ---- Top bar ----
function Topbar() {
  const S = useGame(), room = useCell(session).room, last = maxRounds(S);
  return (
    <header id="topbar" className="box">
      <div id="round">ROUND <b>{S.round}</b> {last === Infinity ? <>&middot; ENDLESS</> : `/ ${last}`}</div>
      <div className="tools">
        <button className="btn sm" id="btn-help" onClick={() => void openRules()}><Icon n="help" /></button>
        <button className="btn sm" id="btn-menu" onClick={() => void openMenu(room!.code, leaveRoom)}><Icon n="menu" /></button>
      </div>
    </header>
  );
}

// ---- Player cards: the cash on a card rolls to its real value (all but 1e-5 of the gap in a second) and the card blinks green / red meanwhile ----
function useRoll(cash: number) {
  const [shown, setShown] = useState(cash);
  const at = useRef(cash); // where the number is now, kept apart from the real one so a change in the middle of a roll carries on from there
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const k = 1 - Math.pow(1e-5, Math.min((now - last) / 1000, 0.1));
      last = now;
      at.current = Math.abs(cash - at.current) < 1 ? cash : at.current + (cash - at.current) * k;
      setShown(at.current);
      if (at.current !== cash) raf = requestAnimationFrame(tick);
    };
    if (at.current !== cash) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cash]);
  return shown;
}

function PCard({ i, on, viewing }: { i: number; on: boolean; viewing: boolean }) {
  const S = useGame(), p = S.players[i], s = statsOf(i), v = useRoll(p.cash), room = useCell(session).room;
  const offline = room?.seats.find((x) => x.pi === i)?.online === false;
  return (
    <div className={`pcard box ${on ? 'on' : ''} ${viewing ? 'viewing' : ''} ${p.out ? 'out' : ''} ${v < p.cash ? 'gain' : v > p.cash ? 'loss' : ''}`}
      onClick={() => { viewedPlayer.set(i); activeTab.set('assets'); focusTok(i, 2.5); }}>
      <Face color={p.color} />
      <div className="nm">
        <span style={{ color: hex(p.color) }}>{p.name}</span>
        <span>
          {i === G.me && <span className="badge gold">YOU</span>}
          {offline && <span className="badge dim">OFFLINE</span>}
          {!!p.out && <span className="badge">OUT</span>}
          {p.jail && <span className="badge">JAIL</span>}
          {p.party && <span className="badge blue">PARTY</span>}
          {p.stay && <span className="badge blue">STAY</span>}
        </span>
      </div>
      <div className="cash" ref={(c) => { cashEls[i] = c; }}>{money(v)}</div>
      <div className="sub">
        <span title="Cities"><Icon n="city" />{s.city}</span><span title="Investments"><Icon n="brief" />{s.inv}</span><span title="Mortgaged"><Icon n="lock" />{s.mort}</span>
        <span title="Total assets" className="gold"><Icon n="coin" />{money(s.net)}</span>
      </div>
    </div>
  );
}

function Players() {
  const S = useGame(), act = S.order[S.turn], tab = useCell(activeTab), view = useCell(viewedPlayer);
  return <aside id="players">{S.order.map((i) => <PCard key={i} i={i} on={i === act} viewing={tab === 'assets' && view === i} />)}</aside>;
}

// ---- Side panel ----
function TilePane() {
  const sel = useCell(selectedTile);
  if (sel < 0) return <div className="empty">Click any tile to inspect it.<br />Hover for a quick look.</div>;
  const t = TILES[sel], hd = tileHead(t);
  return (
    <>
      <div className="hd" style={{ '--tone': hex(hd.tone), color: hd.ink, margin: '-12px -12px 12px' } as CSSProperties}><span>{hd.title}</span><small>{hd.sub}</small></div>
      <div className="bd" style={{ padding: 0, overflow: 'visible' }}><TileBody t={t} /></div>
    </>
  );
}

function Assets() {
  const S = useGame(), pi = useCell(viewedPlayer), p = S.players[pi], st = statsOf(pi);
  const mine = Object.entries(S.own).filter(([, o]) => o.p === pi).map(([k, o]) => [TILES[+k], o] as const);
  const keys = [...new Set(mine.map(([t]) => t.region || 'inv'))];
  return (
    <>
      <div className="row sum"><span>{p.name}'s total assets</span><b className="gold">{money(st.net)}</b></div>
      <div className="note">Cash {money(p.cash)} + mortgage value {money(st.val)}</div>
      {!mine.length && <div className="empty">No properties yet.</div>}
      {keys.map((k) => (
        <Fragment key={k}>
          <div className="grp">{(k === 'inv' ? 'INVESTMENTS' : REGIONS[k][0]).toUpperCase()}</div>
          <div className="list">{mine.filter(([t]) => (t.region || 'inv') === k).map(([t, o]) => (
            <div className="item" key={t.i} data-tile={t.i} onClick={() => lookAtTile(t.i)}>
              <span className="sw" style={{ background: hex(t.color) }} /><Flag name={t.name} /><span className="grow">{t.name}</span>
              {t.type !== 'invest' && <Pips n={o.lv} max={maxLevel(t) || 1} />}
              {o.m && <span className="pill red">MORT</span>}
            </div>
          ))}</div>
        </Fragment>
      ))}
    </>
  );
}

const Log = () => <>{useGame().log.map((l) => <div className="logline" key={l.id}><i>R{l.r}</i><Rich m={l.m} /></div>)}</>;

const TABS: [Tab, () => JSX.Element][] = [['tile', TilePane], ['assets', Assets], ['log', Log]];
function Side() {
  const tab = useCell(activeTab);
  return (
    <aside id="side" className="box">
      <nav className="tabs">{TABS.map(([t]) => <button key={t} data-tab={t} className={tab === t ? 'on' : ''} onClick={() => activeTab.set(t)}>{t.toUpperCase()}</button>)}</nav>
      {TABS.map(([t, Pane]) => <div key={t} id={`pane-${t}`} className="pane" hidden={tab !== t}>{tab === t && <Pane />}</div>)}
    </aside>
  );
}

// ---- Action bar: the last roll, the one button there is to press, or who the game is waiting for ----
function Actions() {
  const chip = useCell(lastRoll), btn = useCell(actionBtn), waiting = useCell(waitingFor), who = waiting >= 0 ? state().players[waiting] : null;
  return (
    <footer id="actions">
      {chip && <div className="dice-chip box"><Die v={chip[0]} /><Die v={chip[1]} /><span>= {chip[0] + chip[1]}</span></div>}
      {btn && <button className="btn big primary" onClick={btn.click}>{btn.label}{btn.kbd && <> <kbd>SPACE</kbd></>}</button>}
      {who && <div className="dice-chip box">WAITING FOR <b style={{ color: hex(who.color) }}>{who.name}</b></div>}
    </footer>
  );
}

// ---- Camera ----
const CAMS = [['rotl', 'left', 'Rotate view left'], ['reset', 'home', 'Reset view'], ['in', 'plus', 'Zoom in'], ['out', 'minus', 'Zoom out'], ['follow', 'focus', 'Focus on current player'], ['map', 'globe', 'Whole board']] as const;

export function Hud() {
  if (!useCell(hudLive)) return null; // only whether it is up: each part below subscribes to what it shows
  const mm = useCell(showMinimap);
  return (
    <div id="hud">
      <Topbar />
      <div id="col">
        <Players />
        <Side />
        {mm && <div id="minimap" className="box"><canvas ref={(c) => { setMinimap(c); }} onClick={(e) => lookAtMap(...minimapToWorld(e))} /></div>}
      </div>
      <Actions />
      <div id="camctl">{CAMS.map(([c, ic, title]) => <button key={c} className="btn sm" data-cam={c} title={title} onClick={CAM[c]}><Icon n={ic} /></button>)}</div>
    </div>
  );
}

// ---- Over everything: the tile under the pointer, toasts, floating numbers, cards ----
export function Tip() {
  const t = useCell(tip);
  if (!t || !G.S) return null;
  const S = G.S, tile = TILES[t.i], o = S.own[t.i], p = o && S.players[o.p];
  const left = Math.round(Math.min(t.x + 18, innerWidth - 282)), top = Math.round(Math.min(t.y + 18, innerHeight - 140)); // room for the widest name with its flag (Saint Petersburg)
  return (
    <div id="tip" className="box" style={{ left, top }}>
      <b><Named name={tile.name} /></b>{tile.type !== 'public' && money(tile.price)}
      {p && <><br /><span style={{ color: hex(p.color) }}>{p.name}</span> {'\u00B7'} {LEVEL_NAMES[o.lv]}{o.m && ` \u00B7 MORT.`}</>}
    </div>
  );
}

export function Overlays() {
  const ts = useCell(toasts), fs = useCell(floats), cs = useCell(cards);
  return (
    <>
      <div id="toasts">{ts.map((t) => <div key={t.id} className={`toast box ${t.tone}`}><Rich m={t.m} /></div>)}</div>
      <div id="floats">{fs.map((f) => <div key={f.id} className={`float ${f.cls}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}</div>
      <div id="modals">{cs.map((c) => <Fragment key={c.key}>{c.node}</Fragment>)}</div>
    </>
  );
}
