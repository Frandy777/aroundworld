import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MAX_PLAYERS, PLAYER_DEFS, START_CASH } from '../../shared/data';
import { CODE_RE, NAME_MAX, ROUNDS_MAX, ROUNDS_MIN, type SeatInfo } from '../../shared/protocol';
import type { Settings } from '../../shared/types';
import { enter, leaveRoom } from '../controller';
import { send } from '../net';
import { PAL, logo } from '../render/art';
import { session, useCell } from '../store';
import { Face, Icon, hex, money } from './bits';
import { Btn, Card } from './dialogs';
import { openRules } from './open';

// ---- The title: a pixel logo over the live board, and the way into a room ----
const P = PAL;
const RAMPS: [string[], string[]][] = [[[P.w, P.a, P.b, P.c], [P.e, P.O, P.O, P.o]], [[P.y, P.Y, P.g, P.G], [P.H, P.H, P.o, P.o]]];

function Banner({ text, i }: { text: string; i: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = logo(text, ...RAMPS[i], '41px "Jersey 25"'); // 41px: one font step = one canvas pixel, shown at 2px (--z)
    c.style.setProperty('--w', String(c.width));
    c.style.setProperty('--h', String(c.height));
    ref.current!.replaceChildren(c);
  }, [text, i]);
  return <span ref={ref} />;
}

/** The room number an invite link names (`?room=123456`). It leaves the address as it is read, so it is offered once: not again after a game, and a reload (which goes back to its room by itself, see boot) does not flash it. */
function takeInvite() {
  const url = new URL(location.href), code = url.searchParams.get('room');
  if (code === null) return '';
  url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
  return CODE_RE.test(code) ? code : '';
}

const NAME_KEY = 'name'; // localStorage: the name you last went in with is already in the field

/** Create a room, or join one by its number (`invite`: the one an invite link named). */
function RoomCard({ join, invite, back }: { join: boolean; invite: string; back(): void }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? ''), [code, setCode] = useState(invite), [why, setWhy] = useState(''), [busy, setBusy] = useState(false);
  const ok = !busy && (!join || CODE_RE.test(code));
  const go = async () => {
    if (!ok) return;
    setBusy(true);
    setWhy('');
    localStorage.setItem(NAME_KEY, name);
    const err = await enter(join ? code : '', name);
    setBusy(false);
    if (err) setWhy(err);
  };
  const enterKey = (e: KeyboardEvent) => { if (e.key === 'Enter') void go(); };
  return (
    <Card title={join ? 'JOIN ROOM' : 'CREATE ROOM'} sub={join ? 'Enter the room number' : 'Up to 4 players'} dismiss="back" foot={<>
      <Btn id="back" onClick={back}>BACK</Btn>
      <Btn id="go" cls="primary" disabled={!ok} onClick={() => void go()}>{join ? 'JOIN' : 'CREATE'}</Btn>
    </>}>
      {join && (
        <div className="field"><label>ROOM NUMBER</label>
          <div className="pl-row"><input autoFocus inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={enterKey} /></div>
        </div>
      )}
      <div className="field"><label>YOUR NAME</label>
        <div className="pl-row"><input autoFocus={!join} maxLength={NAME_MAX} placeholder="Leave empty for a default name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={enterKey} /></div>
      </div>
      {why && <div className="note bad">{why}</div>}
    </Card>
  );
}

export function Title() {
  const { view } = useCell(session);
  const [invite, setInvite] = useState(takeInvite), [dlg, setDlg] = useState<'create' | 'join' | null>(invite ? 'join' : null); // an invite link opens JOIN ROOM with its number in, once
  const back = () => { setDlg(null); setInvite(''); };
  useEffect(() => { if (view !== 'title') back(); }, [view]);
  return (
    <>
      <section id="title" className="screen">
        <h1 className="logo" aria-label="AroundWorld"><Banner text="AROUND" i={0} /><Banner text="WORLD" i={1} /></h1>
        <p className="tagline">Buy cities. Build empires. Bankrupt your friends.</p>
        <nav className="menu">
          <button className="btn primary big" onClick={() => setDlg('create')}>CREATE ROOM</button>
          <button className="btn big" onClick={() => setDlg('join')}>JOIN ROOM</button>
          <button className="btn big" onClick={() => void openRules()}>HOW TO PLAY</button>
        </nav>
        <p className="hint">Drag: pan &nbsp;|&nbsp; Right-drag: rotate &nbsp;|&nbsp; Wheel: zoom</p>
        <small className="ver">AROUNDWORLD v0.1</small>
      </section>
      {view === 'title' && dlg && <RoomCard join={dlg === 'join'} invite={invite} back={back} />}
    </>
  );
}

// ---- The lobby: who is here, and (for the host) the rules of the game ----
const NAME_DELAY_MS = 300; // quiet after the last key before a name goes out

/** The name of your own seat. Each name sent is broadcast to the whole room: it goes out once typing pauses, or at once when the field is left (so that START right after typing cannot beat it). */
function NameInput({ name }: { name: string }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const put = (v: string) => { clearTimeout(timer.current); timer.current = undefined; localStorage.setItem(NAME_KEY, v); send({ t: 'name', name: v }); };
  return (
    <input maxLength={NAME_MAX} defaultValue={name}
      onChange={(e) => { const v = e.target.value; clearTimeout(timer.current); timer.current = setTimeout(() => put(v), NAME_DELAY_MS); }}
      onBlur={(e) => { if (timer.current) put(e.target.value); }} />
  );
}

function Seat({ i, s, me, bots }: { i: number; s?: SeatInfo; me: boolean; bots: boolean }) { // bots: the host may seat them
  const def = PLAYER_DEFS[i], toggle = (label: string) => <button className="btn sm" onClick={() => send({ t: 'bot', seat: i })}>{label}</button>;
  if (!s) return <div className="pl-row"><Face color={def.color} /><span className="nm dim">Waiting for a player...</span>{bots && toggle('+ BOT')}</div>;
  return (
    <div className="pl-row">
      <Face color={def.color} />
      {me
        ? <NameInput name={s.name} />
        : <span className="nm" style={{ color: hex(def.color) }}>{s.name}</span>}
      {me && <span className="badge gold">YOU</span>}
      {s.host && <span className="badge blue">HOST</span>}
      {!s.online && <span className="badge dim">OFFLINE</span>}
      {bots && s.bot && toggle('REMOVE')}
    </div>
  );
}

/** Puts `text` on the clipboard; the label says COPIED! for a moment (a toast would sit under the card, see .modal). */
function CopyBtn({ id, text, children }: { id: string; text: string; children: string }) {
  const [done, setDone] = useState(false), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1500);
  };
  return <Btn id={id} cls="sm" onClick={() => void copy()}>{done ? 'COPIED!' : children}</Btn>;
}

const MODES: [Settings['mode'], string][] = [['limited', 'LIMITED ROUNDS'], ['endless', 'ENDLESS']];

export function Lobby() {
  const room = useCell(session).room;
  if (!room) return null;
  const { seats, settings: set } = room, host = !!seats.find((s) => s.seat === room.me)?.host;
  const put = (s: Partial<Settings>) => send({ t: 'settings', s: { ...set, ...s } });
  const step = (d: number) => put({ rounds: Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, set.rounds + d)) });
  return (
    <Card title="LOBBY" sub={`Room ${room.code}`} cls="wide" peek={false} foot={<>
      <Btn id="leave" onClick={leaveRoom}>LEAVE</Btn>
      {host
        ? <Btn id="go" cls="primary" disabled={seats.length < 2} onClick={() => send({ t: 'start' })}>START GAME</Btn>
        : <Btn id="wait" disabled onClick={() => {}}>WAITING FOR HOST</Btn>}
    </>}>
      <div className="invite">
        <div className="note">Friends join with the room number <b className="gold">{room.code}</b>.</div>
        <CopyBtn id="code" text={room.code}>COPY CODE</CopyBtn>
        <CopyBtn id="link" text={`${location.origin}/?room=${room.code}`}>COPY LINK</CopyBtn>
      </div>
      <div className="field"><label>PLAYERS {seats.length} / {MAX_PLAYERS}</label>
        {PLAYER_DEFS.map((_, i) => <Seat key={i} i={i} s={seats.find((s) => s.seat === i)} me={i === room.me} bots={host && room.dev} />)}
      </div>
      {host ? (
        <>
          <div className="field"><label>GAME MODE</label>
            <div className="seg">{MODES.map(([m, l]) => <button key={m} className={set.mode === m ? 'on' : ''} onClick={() => put({ mode: m })}>{l}</button>)}</div>
          </div>
          {set.mode === 'limited' && (
            <div className="stepper">
              <button className="btn sm" onClick={() => step(-5)}><Icon n="minus" /></button><b>{set.rounds} ROUNDS</b><button className="btn sm" onClick={() => step(5)}><Icon n="plus" /></button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row"><span>Game mode</span><b>{MODES.find(([m]) => m === set.mode)![1]}</b></div>
          {set.mode === 'limited' && <div className="row"><span>Rounds</span><b>{set.rounds}</b></div>}
        </>
      )}
      <div className="row"><span>Starting cash</span><b className="gold">{money(START_CASH)}</b></div>
    </Card>
  );
}
