import { Fragment, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';
import { LEVEL_NAMES, REGIONS, TILES, depositInterest, maxLevel } from '../../shared/data';
import { maxRounds } from '../../shared/state';
import { leaveRoom } from '../controller';
import { send } from '../net';
import { CAM, focusTok, lookAtTile } from '../stage';
import { G, actionBtn, activeTab, cards, cardsSetAside, cashEls, countdown, floats, fullscreen, hoveredTileTip, hudLive, lastRoll, paused, selectedTile, session, statsOf, toasts, useCell, useGame, viewedPlayer, waitingFor, type Tab } from '../store';
import { Die, Face, Flag, FullBtn, Icon, Named, Pips, Rich, hex, money, tileHead } from './bits';
import { openMenu, openRules } from './open';
import { TileBody } from './tile';

function Topbar() {
  const S = useGame(), room = useCell(session).room, last = maxRounds(S), p = useCell(paused), me = G.myPlayer >= 0 ? S.players[G.myPlayer] : null;
  return (
    <header id="topbar" className="box">
      <div id="round">ROUND <b>{S.round}</b> {last === Infinity ? <>&middot; ENDLESS</> : `/ ${last}`}{p && <> <span className="badge blue">PAUSED</span></>}</div>
      <div className="tools">
        <button className="btn sm" id="btn-help" onClick={() => void openRules()}><Icon n="help" /></button>
        <button className="btn sm" id="btn-menu" onClick={() => void openMenu(room!.code, leaveRoom, me && !me.bankruptRound && !S.over ? () => send({ t: 'bankrupt' }) : undefined)}><Icon n="menu" /></button>
        <FullBtn />
      </div>
    </header>
  );
}

function useRoll(cash: number) {
  const [shown, setShown] = useState(cash);
  const at = useRef(cash);
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

function Clock({ i }: { i: number }) {
  const c = useCell(countdown), p = useCell(paused);
  if (c?.player !== i) return null;
  return <div className="clock" key={c.expiresAt}><i style={{ '--w': `${(c.remainingMs * 100) / c.totalMs}%`, '--t': `${c.remainingMs}ms`, animationPlayState: p ? 'paused' : undefined } as CSSProperties} /></div>;
}

function PCard({ i, on, viewing }: { i: number; on: boolean; viewing: boolean }) {
  const S = useGame(), p = S.players[i], s = statsOf(i), v = useRoll(p.cash), room = useCell(session).room;
  const offline = room?.seats.find((x) => x.playerIndex === i)?.online === false;
  return (
    <div className={`pcard box ${on ? 'on' : ''} ${viewing ? 'viewing' : ''} ${p.bankruptRound ? 'out' : ''} ${v < p.cash ? 'gain' : v > p.cash ? 'loss' : ''}`}
      onClick={() => { viewedPlayer.set(i); activeTab.set('assets'); focusTok(i); }}>
      <Face color={p.color} />
      <div className="nm">
        <span style={{ color: hex(p.color) }}>{p.name}</span>
        <span>
          {i === G.myPlayer && <span className="badge gold">YOU</span>}
          {offline && <span className="badge dim">OFFLINE</span>}
          {!!p.bankruptRound && <span className="badge">OUT</span>}
          {p.jail && <span className="badge">JAIL</span>}
          {p.party && <span className="badge blue">PARTY</span>}
          {p.stay && <span className="badge blue">STAY</span>}
          {p.deposit && <span className="badge blue" title={`Fixed deposit ${money(p.deposit.principal)} · ${p.deposit.termRounds} rounds`}>DEP</span>}
        </span>
      </div>
      <div className="cash" ref={(c) => { cashEls[i] = c; }}>{money(v)}</div>
      <div className="sub">
        <span title="Cities"><Icon n="city" />{s.cities}</span><span title="Investments"><Icon n="brief" />{s.investments}</span><span title="Mortgaged"><Icon n="lock" />{s.mortgaged}</span>
        <span title="Total assets" className="gold"><Icon n="coin" />{money(s.netWorth)}</span>
      </div>
      <Clock i={i} />
    </div>
  );
}

function Players() {
  const S = useGame(), act = S.turnOrder[S.turnIndex], tab = useCell(activeTab), view = useCell(viewedPlayer);
  return <aside id="players">{S.turnOrder.map((i) => <PCard key={i} i={i} on={i === act} viewing={tab === 'assets' && view === i} />)}</aside>;
}

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
  const mine = Object.entries(S.ownedByTile).filter(([, o]) => o.owner === pi).map(([k, o]) => [TILES[+k], o] as const);
  const keys = [...new Set(mine.map(([t]) => t.region || 'inv'))];
  return (
    <>
      <div className="row sum"><span>{p.name}'s total assets</span><b className="gold">{money(st.netWorth)}</b></div>
      <div className="note">Cash {money(p.cash)} + deposit {money(st.deposit)} + lot value {money(st.propertyValue)}</div>
      {p.deposit && <div className="note">Fixed deposit {money(p.deposit.principal)}: pays {money(p.deposit.principal + depositInterest(p.deposit.principal, p.deposit.termRounds))} in {p.deposit.placedRound + p.deposit.termRounds - S.round} round{p.deposit.placedRound + p.deposit.termRounds - S.round === 1 ? '' : 's'}.</div>}
      {!mine.length && <div className="empty">No properties yet.</div>}
      {keys.map((k) => (
        <Fragment key={k}>
          <div className="grp">{(k === 'inv' ? 'INVESTMENTS' : REGIONS[k][0]).toUpperCase()}</div>
          <div className="list">{mine.filter(([t]) => (t.region || 'inv') === k).map(([t, o]) => (
            <div className="item" key={t.i} data-tile={t.i} onClick={() => lookAtTile(t.i)}>
              <span className="sw" style={{ background: hex(t.color) }} /><Flag name={t.name} /><span className="grow">{t.name}</span>
              {o.mortgaged && <span className="pill red">MORT</span>}
              {t.type !== 'invest' && <Pips n={o.level} max={maxLevel(t) || 1} />}
            </div>
          ))}</div>
        </Fragment>
      ))}
    </>
  );
}

const Log = () => <>{useGame().log.map((l) => <div className="logline" key={l.id}><i>R{l.round}</i><Rich m={l.message} z={1} /></div>)}</>;

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

function Actions() {
  const S = useGame();
  const chip = useCell(lastRoll), btn = useCell(actionBtn), aside = useCell(cardsSetAside), waiting = useCell(waitingFor), who = waiting >= 0 ? S.players[waiting] : null;
  const me = G.myPlayer, spectating = me >= 0 && !S.over && !!S.players[me].bankruptRound;
  return (
    <footer id="actions">
      {chip && <div className="dice-chip box"><Die v={chip[0]} /><Die v={chip[1]} /><span>= {chip[0] + chip[1]}</span></div>}
      {btn && <button className="btn big primary" onClick={btn.click}>{btn.label}{btn.spaceShortcut && <> <kbd>SPACE</kbd></>}</button>}
      {aside && <button className="btn big primary" onClick={() => cardsSetAside.set(false)}>SHOW CARD <kbd>SPACE</kbd></button>}
      {(spectating || who) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {spectating && <div className="dice-chip box">OUT IN ROUND {S.players[me].bankruptRound} · WATCHING</div>}
          {who && <div className="dice-chip box">WAITING FOR <b style={{ color: hex(who.color) }}>{who.name}</b></div>}
        </div>
      )}
    </footer>
  );
}

const CAMS = [['in', 'plus', 'Zoom in (or mouse wheel)'], ['out', 'minus', 'Zoom out (or mouse wheel)'], ['follow', 'focus', 'Focus on current player'], ['map', 'globe', 'Whole board']] as const;

export function Hud() {
  const live = useCell(hudLive);
  if (!live) return null;
  return (
    <div id="hud">
      <Topbar />
      <div id="col">
        <Players />
        <Side />
      </div>
      <Actions />
      <div id="camctl">
        {CAMS.map(([c, ic, title]) => <button key={c} className="btn sm" data-cam={c} title={title} onClick={CAM[c]}><Icon n={ic} /></button>)}
      </div>
    </div>
  );
}

export function Tip() {
  const t = useCell(hoveredTileTip);
  if (!t || !G.S) return null;
  const S = G.S, tile = TILES[t.tile], o = S.ownedByTile[t.tile], p = o && S.players[o.owner];
  const left = Math.round(Math.min(t.x + 18, innerWidth - 282)), top = Math.round(Math.min(t.y + 18, innerHeight - 140));
  return (
    <div id="tip" className="box" style={{ left, top }}>
      <b><Named name={tile.name} /></b>{tile.type !== 'public' && money(tile.price)}
      {p && <><br /><span style={{ color: hex(p.color) }}>{p.name}</span> {'\u00B7'} {LEVEL_NAMES[o.level]}{o.mortgaged && ` \u00B7 MORT.`}</>}
    </div>
  );
}

export function Overlays() {
  const ts = useCell(toasts), fs = useCell(floats), cs = useCell(cards), aside = useCell(cardsSetAside);
  return (
    <>
      <div id="toasts">{ts.map((t) => <div key={t.id} className={`toast box ${t.tone}`}><Rich m={t.message} /></div>)}</div>
      <div id="floats">{fs.map((f) => <div key={f.id} className={`float ${f.cls}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}</div>
      <div id="modals" hidden={aside}>{cs.map((c) => <Fragment key={c.key}>{c.node}</Fragment>)}</div>
    </>
  );
}

export function Narrow() {
  const fs = useCell(fullscreen);
  return (
    <div id="narrow">
      <div className="card box">
        <div className="hd"><span>WIDER SCREEN NEEDED</span></div>
        <div className="bd"><div className="note">AroundWorld is made for a wide screen. Widen the window or go fullscreen, or play on a wider display.</div></div>
        <div className="ft">{!fs && document.fullscreenEnabled && <button className="btn primary" onClick={() => fullscreen.set(true)}>FULLSCREEN <kbd>F</kbd></button>}</div>
      </div>
    </div>
  );
}
