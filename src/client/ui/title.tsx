import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MAX_PLAYERS, PLAYER_DEFS, START_CASH } from '../../shared/data';
import { CODE_RE, NAME_MAX, ROUNDS_MAX, ROUNDS_MIN, type SeatInfo } from '../../shared/protocol';
import type { Settings } from '../../shared/types';
import { enter, leaveRoom } from '../controller';
import { send } from '../net';
import { PAL, logo } from '../render/art';
import { session, useCell } from '../store';
import { Face, FullBtn, Icon, SoundBtn, VolumeRow, hex, money } from './bits';
import { Btn, Card } from './dialogs';
import { openRules } from './open';

const P = PAL;
const RAMPS: [string[], string[]][] = [[[P.w, P.a, P.b, P.c], [P.e, P.O, P.O, P.o]], [[P.y, P.Y, P.g, P.G], [P.H, P.H, P.o, P.o]]];

function Banner({ text, i }: { text: string; i: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = logo(text, ...RAMPS[i], '41px "Jersey 25"');
    c.style.setProperty('--w', String(c.width));
    c.style.setProperty('--h', String(c.height));
    ref.current!.replaceChildren(c);
  }, [text, i]);
  return <span ref={ref} />;
}

function takeInvite() {
  const url = new URL(location.href), code = url.searchParams.get('room');
  if (code === null) return '';
  url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
  return CODE_RE.test(code) ? code : '';
}

const NAME_KEY = 'name';

function RoomCard({ join, invite, back }: { join: boolean; invite: string; back(): void }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? ''), [code, setCode] = useState(invite), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const ok = !busy && (!join || CODE_RE.test(code));
  const go = async () => {
    if (!ok) return;
    setBusy(true);
    setError('');
    localStorage.setItem(NAME_KEY, name);
    const err = await enter(join ? code : '', name);
    setBusy(false);
    if (err) setError(err);
  };
  const enterKey = (e: KeyboardEvent) => { if (e.key === 'Enter') void go(); };
  return (
    <Card title={join ? 'JOIN ROOM' : 'CREATE ROOM'} sub={join ? (invite ? `Joining room ${invite}` : 'Enter the room number') : 'Up to 4 players'} dismiss="back" foot={<>
      <Btn id="back" onClick={back}>BACK</Btn>
      <Btn id="go" cls="primary" disabled={!ok} onClick={() => void go()}>{join ? 'JOIN' : 'CREATE'}</Btn>
    </>}>
      {join && (
        <div className="field"><label>ROOM NUMBER</label>
          <div className="pl-row"><input autoFocus={!invite} inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={enterKey} /></div>
        </div>
      )}
      <div className="field"><label>YOUR NAME</label>
        <div className="pl-row"><input autoFocus={!join || !!invite} maxLength={NAME_MAX} placeholder="Leave empty for a default name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={enterKey} /></div>
      </div>
      {error && <div className="note bad">{error}</div>}
    </Card>
  );
}

export function Title() {
  const { view } = useCell(session);
  const [invite, setInvite] = useState(takeInvite), [dialog, setDialog] = useState<'create' | 'join' | null>(invite ? 'join' : null);
  const back = () => { setDialog(null); setInvite(''); };
  useEffect(() => { if (view !== 'title') back(); }, [view]);
  return (
    <>
      <section id="title" className="screen">
        <h1 className="logo" aria-label="AroundWorld"><Banner text="AROUND" i={0} /><Banner text="WORLD" i={1} /></h1>
        <p className="tagline">Buy cities. Build empires. Bankrupt your friends.</p>
        {view === 'title' && (
          <nav className="menu">
            <button className="btn primary big" onClick={() => setDialog('create')}>CREATE ROOM</button>
            <button className="btn big" onClick={() => setDialog('join')}>JOIN ROOM</button>
            <button className="btn big" onClick={() => void openRules()}>HOW TO PLAY</button>
          </nav>
        )}
        <p className="hint">Drag: pan &nbsp;|&nbsp; Right-drag: rotate &nbsp;|&nbsp; Wheel: zoom</p>
        <small className="ver">AROUNDWORLD v0.1</small>
      </section>
      <div className="corner-tools"><SoundBtn /><FullBtn /></div>
      {view === 'title' && dialog && <RoomCard join={dialog === 'join'} invite={invite} back={back} />}
    </>
  );
}

const NAME_DELAY_MS = 300;

function NameInput({ name }: { name: string }) {
  const [text, setText] = useState(name), focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { if (!focused.current) setText(name); }, [name]); // follow the name the room assigned (it may differ from what was sent), but never while typing
  const put = (v: string) => { clearTimeout(timer.current); timer.current = undefined; localStorage.setItem(NAME_KEY, v); send({ t: 'name', name: v }); };
  return (
    <input maxLength={NAME_MAX} value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => put(v), NAME_DELAY_MS); }}
      onBlur={(e) => { focused.current = false; if (timer.current) put(e.target.value); else setText(name); }} />
  );
}

function Seat({ i, s, me, bots }: { i: number; s?: SeatInfo; me: boolean; bots: boolean }) {
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
  const { seats, settings } = room, host = !!seats.find((s) => s.seat === room.mySeat)?.host;
  const put = (s: Partial<Settings>) => send({ t: 'settings', settings: { ...settings, ...s } });
  const step = (d: number) => put({ rounds: Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, settings.rounds + d)) });
  return (
    <Card title="LOBBY" cls="wide" peek={false} foot={<>
      <Btn id="rules" cls="peek" onClick={() => void openRules()}>HOW TO PLAY</Btn>
      <Btn id="leave" onClick={leaveRoom}>LEAVE</Btn>
      {host
        ? <Btn id="go" cls="primary" disabled={seats.length < 2} onClick={() => send({ t: 'start' })}>{seats.length < 2 ? 'NEED 1 MORE PLAYER' : 'START GAME'}</Btn>
        : <Btn id="wait" disabled onClick={() => {}}>WAITING FOR HOST</Btn>}
    </>}>
      <div className="field"><label>ROOM NUMBER</label>
        <div className="invite">
          <b className="code">{room.code}</b>
          <CopyBtn id="code" text={room.code}>COPY CODE</CopyBtn>
          <CopyBtn id="link" text={`${location.origin}/?room=${room.code}`}>COPY LINK</CopyBtn>
        </div>
      </div>
      <div className="field"><label>PLAYERS {seats.length} / {MAX_PLAYERS}</label>
        {PLAYER_DEFS.map((_, i) => <Seat key={i} i={i} s={seats.find((s) => s.seat === i)} me={i === room.mySeat} bots={host && room.dev} />)}
      </div>
      {host ? (
        <>
          <div className="field"><label>GAME MODE</label>
            <div className="seg">{MODES.map(([m, l]) => <button key={m} className={settings.mode === m ? 'on' : ''} onClick={() => put({ mode: m })}>{l}</button>)}</div>
          </div>
          {settings.mode === 'limited' && (
            <div className="stepper">
              <button className="btn sm" onClick={() => step(-5)}><Icon n="minus" /></button><b>{settings.rounds} ROUNDS</b><button className="btn sm" onClick={() => step(5)}><Icon n="plus" /></button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row"><span>Game mode</span><b>{MODES.find(([m]) => m === settings.mode)![1]}</b></div>
          {settings.mode === 'limited' && <div className="row"><span>Rounds</span><b>{settings.rounds}</b></div>}
        </>
      )}
      <div className="row"><span>Starting cash</span><b className="gold">{money(START_CASH)}</b></div>
      <VolumeRow />
    </Card>
  );
}
