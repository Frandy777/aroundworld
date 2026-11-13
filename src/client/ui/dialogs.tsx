import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DEP_MAX, DEP_MIN, DEP_STEP, START_CASH, TILES, depInterest, depRate, maxLevel, type Tile } from '../../shared/data';
import { READ } from '../../shared/protocol';
import { canPick } from '../../shared/state';
import type { CasinoView, NewsCard as News, Notice, OrderPass, Player, Prompt, RankRow } from '../../shared/types';
import { reply } from '../asks';
import { pace } from '../render/scene';
import { state, useCell, G, peeking, type Cell } from '../store';
import { Blocks, Die, Face, Flag, Icon, Pips, Rich, hex, money, tileHead } from './bits';
import { TileBody } from './tile';

const d6 = () => 1 + Math.floor(Math.random() * 6);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms / pace.speed));

// ---- Card frame ----
// A card covers the whole window, so the board and the panels can't be reached while it is up. One that has no button of its own to be taken down by (`dismiss`) can be set aside
// instead (`peek`): VIEW BOARD, or Escape, puts every card away with its state kept, and SHOW CARD in the action bar (the HUD, see hud.tsx) brings them back. `peek={false}`: a card with no HUD behind it.
export function Card({ title, sub = '', tone = 0x333b66, ink = '#fff', cls = '', dismiss, peek = !dismiss, foot, auto, children }: {
  title: ReactNode; sub?: ReactNode; tone?: number; ink?: string; cls?: string; dismiss?: string; peek?: boolean; foot?: ReactNode; auto?: ReturnType<typeof useAuto>; children?: ReactNode;
}) {
  return (
    <div className="modal" data-dismiss={dismiss}>
      <div className={`card box ${cls}`} onPointerEnter={auto?.hold} onPointerLeave={auto?.free}>
        <div className="hd" style={{ '--tone': hex(tone), color: ink } as CSSProperties}><span>{title}</span><small>{sub}</small></div>
        <div className="bd">{children}</div>
        <div className="ft">{peek && <Btn id="peek" cls="peek" onClick={() => { auto?.free(); peeking.set(true); }}>VIEW BOARD</Btn>}{foot}</div>
        {auto && <div className="bar fuse"><i style={{ width: `${auto.left}%` }} /></div>}
      </div>
    </div>
  );
}
export const Btn = ({ id, cls = '', disabled, onClick, children }: { id: string; cls?: string; disabled?: boolean; onClick(): void; children: ReactNode }) => (
  <button className={`btn ${cls}`} data-id={id} disabled={disabled} onClick={onClick}>{children}</button>
);
/** A yes / no option: a box that is ticked while `on` holds true, and flips with a click. */
export function Check({ label, on }: { label: string; on: Cell<boolean> }) {
  const v = useCell(on);
  return <div className={`item ${v ? 'sel' : ''}`} onClick={() => on.set(!v)}><span className="check" /><span className="grow">{label}</span></div>;
}
const TICKS = 20; // the steps a card's wait is counted down in: its bar loses one at a time, like a 16-bit gauge
/** Run `fn` once, `ms` after the card is up (less while the screen is catching up, see `pace`): a card with nothing to decide closes itself.
 *  The wait is counted down in TICKS steps, and `left` (percent) is what is still to go, for the card to show as a bar. The count stands still while the pointer
 *  is on the card, or while the card is set aside (see Card), so a slow reader is not hurried, and goes on when it leaves. Without `ms` there is no count, and the card gets nothing back. */
function useAuto(ms: number, fn: () => void) {
  const f = useRef(fn);
  f.current = fn;
  const [ticks, setTicks] = useState(TICKS);
  const held = useRef(false); // the count stands still while the pointer is on the card (a ref: the timer below is not restarted for it)
  useEffect(() => {
    if (!ms) return;
    let last = performance.now(), gone = 0; // `gone`: the share of the wait already over, by the clock — however seldom the timer runs
    const t = setInterval(() => {
      const now = performance.now(), dt = now - last;
      last = now;
      if (held.current || peeking.get() || document.hidden) return; // ... or while the cards are set aside, or the tab is away
      gone += (dt * pace.speed) / ms;
      setTicks(Math.max(0, Math.ceil((1 - gone) * TICKS)));
    }, 50);
    const wake = () => { last = performance.now(); }; // hidden time does not count: the clock starts fresh when the page is seen again
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', wake); };
  }, [ms]);
  useEffect(() => { if (!ticks) f.current(); }, [ticks]);
  return ms ? { left: (ticks * 100) / TICKS, hold: () => (held.current = true), free: () => (held.current = false) } : undefined;
}

// ---- Rules ----
const RULES: Record<string, ReactNode> = {
  GOAL: <>
    <h4>THE GOAL</h4><p>Buy cities and investments, collect rent, and push everyone else into bankruptcy. Everyone starts on START with {money(START_CASH)}.</p>
    <h4>TURN ORDER</h4><p>Each player rolls two dice. The <b>lower</b> total goes first. Ties re-roll.</p>
    <h4>HOW IT ENDS</h4><ul><li><b>Limited rounds:</b> ranked by total assets (cash + deposits + lot value of unmortgaged properties). If only one player is left, they win early.</li><li><b>Endless:</b> last player standing wins. Rank follows bankruptcy order.</li></ul>
  </>,
  TURN: <>
    <h4>YOUR TURN</h4><ul><li><b>1. Redeem</b> (optional): pay a mortgaged property's full lot value to restore it.</li><li><b>2. Roll</b> two dice.</li><li><b>3. Move</b> tile by tile. Passing START or a chokepoint can trigger effects.</li><li><b>4. Stop</b> on the target tile and resolve it.</li></ul>
    <p><b>Normal moves</b> pass every tile on the way. <b>Event moves</b> (news, jail, Area 51) jump straight to the target.</p>
  </>,
  CITIES: <>
    <h4>REGULAR CITIES</h4><ul><li>Rent: 10% / 25% / 50% / 100% of price (empty, Lv 1, Lv 2, Lv 3).</li><li>Upgrade cost: 25% of price. Lot value: price + paid upgrade costs.</li><li>Own a whole region: <b>+50% rent</b>. Special cities do not count.</li></ul>
    <h4>SPECIAL CITIES</h4><p>Eight landmark cities with unique passive effects such as taxing passers-by, boosting rent or paying out on dice doubles.</p>
  </>,
  DEBT: <>
    <h4>MORTGAGE</h4><p>You cannot mortgage by choice — only when you can't pay (each property pays half its lot value), or at the Bank (the full lot value). Mortgaged properties stop working: no rent, no upgrades, no effects. Redeeming one costs its full lot value.</p>
    <h4>FIXED DEPOSIT</h4><p>At the Bank, lock cash away in whole thousands for {DEP_MIN}–{DEP_MAX} rounds: the rate per round is term × 0.02% + 0.2%. One deposit at a time, no auto-renew. Only a settlement you can't pay withdraws it early — principal back, no interest.</p>
    <h4>BANKRUPTCY</h4><p>If cash + deposit + what mortgaging raises cannot cover a debt, you are out. The creditor only receives what you could raise.</p>
    <h4>JAIL</h4><p>Jailed players skip their next turn and collect no fees. Stopping on the Jail tile does not jail you.</p>
  </>,
  TILES: <>
    <h4>INVESTMENTS</h4><p>Transport, Construction, Military, Chokepoints, Oil, Media and Prison Island. Own more of a group to make it stronger.</p>
    <h4>PUBLIC TILES</h4><ul><li><b>START:</b> collect $3,000 passing or stopping.</li><li><b>Exchanges:</b> investments owned {'\u00D7'} $500.</li><li><b>Tax Bureau:</b> properties {'\u00D7'} $30 + investments {'\u00D7'} $50 (1st); 3% of cash + 5% of deposit (2nd).</li><li><b>Casino:</b> gamble on the dice — a wrong roll can send you to jail.</li><li><b>Nightclub:</b> pay $100, stay one turn.</li><li><b>Bank:</b> mortgage at full lot value, or place a fixed deposit.</li><li><b>News Agency:</b> draw a random news event.</li><li><b>Area 51:</b> get teleported to a random other tile, and its effect applies.</li></ul>
  </>,
};
export function RulesCard({ close }: { close(v: string): void }) {
  const [k, setK] = useState('GOAL');
  return (
    <Card title="HOW TO PLAY" sub="AroundWorld rules" cls="wide rules" dismiss="ok" foot={<Btn id="ok" cls="primary" onClick={() => close('ok')}>GOT IT</Btn>}>
      <nav className="seg">{Object.keys(RULES).map((x) => <button key={x} className={x === k ? 'on' : ''} onClick={() => setK(x)}>{x}</button>)}</nav>
      <div>{RULES[k]}</div>
    </Card>
  );
}

// A card with nothing to decide (tax, exchange, rent, ...): its button is the default action (Space); it closes itself after a moment, counted down by its bar.
export function NoticeCard({ n, close }: { n: Notice; close(): void }) {
  const auto = useAuto(READ, close);
  return <Card title={n.title} sub={<Rich m={n.sub} />} tone={n.tone} auto={auto} foot={<Btn id="ok" cls={`primary ${n.danger ? 'danger' : ''}`} onClick={close}>{n.label}</Btn>}><Blocks blocks={n.body} /></Card>;
}

// ---- News ----
export function NewsCard({ c, close, redraw }: { c: News; close(): void; redraw?: (again: boolean) => void }) {
  const auto = useAuto(redraw ? 0 : READ, close);
  const foot = redraw
    ? <><Btn id="again" onClick={() => redraw(true)}>DRAW AGAIN</Btn><Btn id="keep" cls="primary" onClick={() => redraw(false)}>KEEP</Btn></>
    : <Btn id="ok" cls="primary" onClick={close}>GOT IT</Btn>;
  return (
    <Card title="NEWS" tone={0xf1e8cf} ink="#1a1c2c" cls="news" auto={auto} foot={foot}>
      <span className="pill" style={{ alignSelf: 'flex-start' }}>{c.cat.toUpperCase()}</span>
      <h3>{c.title}</h3>
      <p>{c.text}</p>
      {!!c.amt && <div className={`amt ${c.amt > 0 ? 'good' : 'bad'}`}>{c.amt > 0 ? '+' : ''}{money(c.amt)}</div>}
      {redraw && <div className="note">You own the Media group: keep this story, or throw it away and draw again.</div>}
    </Card>
  );
}

// ---- Questions to one player: each card answers through `reply` and closes itself; the director takes it down if the answer came from elsewhere (a timeout) ----
type Of<K extends Prompt['k']> = Extract<Prompt, { k: K }>;

export function DeedCard({ id, p }: { id: number; p: Of<'deed'> }) {
  const t = TILES[p.tile], hd = tileHead(t);
  return (
    <Card {...hd} foot={<>
      <Btn id="skip" onClick={() => reply(id, false)}>SKIP</Btn>
      <Btn id={p.mode} cls="primary spend" onClick={() => reply(id, true)}>{p.mode === 'buy' ? 'BUY' : 'UPGRADE'} {money(p.price)}</Btn>
    </>}>
      <TileBody t={t} bare={p.mode === 'buy'} />
    </Card>
  );
}

export function PickCard({ id, p }: { id: number; p: Of<'pick'> }) {
  const S = state(), r = p.rule;
  const [sel, setSel] = useState<number[]>([]);
  const sum = sel.reduce((s, i) => s + (p.items.find((x) => x.i === i)?.amt ?? 0), 0);
  const ok = canPick(r, sel.length, sum);
  const msg = r.k === 'one' ? r.msg : r.k === 'any' ? 'You receive' : r.k === 'redeem' ? `Cash ${money(r.cash)}. Cost` : `Cash ${money(r.cash)}. Need ${money(r.need)}`;
  const toggle = (i: number) => setSel(sel.includes(i) ? sel.filter((x) => x !== i) : r.k === 'one' ? [i] : [...sel, i]);
  const priced = p.items.some((x) => x.amt !== undefined);
  return (
    <Card title={p.title} sub={<Rich m={p.sub} />} tone={p.tone} foot={<>
      {p.skip && <Btn id="skip" onClick={() => reply(id, null)}>{p.skip}</Btn>}
      <Btn id="ok" cls="primary" disabled={!ok} onClick={() => reply(id, sel)}>{p.label}</Btn>
    </>}>
      <div className="note">{p.hint}</div>
      <div className="list">{p.items.map((x) => {
        const t: Tile | null = p.of === 'tile' ? TILES[x.i] : null, who: Player | null = p.of === 'player' ? S.players[x.i] : null;
        return (
          <div className={`item ${sel.includes(x.i) ? 'sel' : ''}`} key={x.i} onClick={() => toggle(x.i)}>
            <span className="check" />
            {t && <><span className="sw" style={{ background: hex(t.color) }} /><Flag name={t.name} /><span className="grow">{t.name}</span></>}
            {who && <><Face color={who.color} /><span className="grow">{who.name}</span></>}
            {x.lv !== undefined && <Pips n={x.lv} max={maxLevel(TILES[x.i])} />}
            {x.own ? <><Rich m={[{ p: x.own.p }]} /><Pips n={x.own.lv} max={maxLevel(TILES[x.i])} /></> : <b>{x.amt !== undefined ? money(x.amt) : x.note}</b>}
          </div>
        );
      })}</div>
      <div className="row sum"><span>{msg}</span>{priced && <b>{money(sum)}</b>}</div>
    </Card>
  );
}

export function ConfirmCard({ id, p }: { id: number; p: Of<'confirm'> }) {
  return (
    <Card title={p.title} sub={<Rich m={p.sub} />} tone={p.tone} foot={<>
      <Btn id="no" onClick={() => reply(id, false)}>{p.no}</Btn>
      <Btn id="yes" cls="primary spend" onClick={() => reply(id, true)}>{p.yes}</Btn>
    </>}><Blocks blocks={p.body} /></Card>
  );
}

// The bank's fixed deposit: a principal in whole thousands and a term of rounds, shown with the interest it earns.
export function DepCard({ id, p }: { id: number; p: Of<'dep'> }) {
  const [amt, setAmt] = useState(Math.min(5 * DEP_STEP, p.max));
  const [n, setN] = useState(10);
  const interest = depInterest(amt, n);
  return (
    <Card title="FIXED DEPOSIT" sub="Bank" tone={0x3b7bd9} foot={<>
      <Btn id="leave" onClick={() => reply(id, null)}>LEAVE</Btn>
      <Btn id="dep" cls="primary" onClick={() => reply(id, { amt, n })}>DEPOSIT {money(amt)}</Btn>
    </>}>
      <div className="note">Lock cash away for {DEP_MIN}–{DEP_MAX} rounds: it cannot be spent until it matures. A settlement you cannot pay withdraws the principal early, without interest.</div>
      <div className="stepper dep">
        <button className="btn sm" onClick={() => setAmt(Math.max(DEP_STEP, amt - DEP_STEP))}><Icon n="minus" /></button>
        <b>{money(amt)}</b>
        <button className="btn sm" onClick={() => setAmt(Math.min(p.max, amt + DEP_STEP))}><Icon n="plus" /></button>
        <button className="btn sm gold max" onClick={() => setAmt(p.max)}>MAX</button>
      </div>
      <div className="stepper dep">
        <button className="btn sm" onClick={() => setN(Math.max(DEP_MIN, n - 1))}><Icon n="minus" /></button>
        <b>{n} ROUNDS</b>
        <button className="btn sm" onClick={() => setN(Math.min(DEP_MAX, n + 1))}><Icon n="plus" /></button>
      </div>
      <div className="rows">
        <div className="row"><span>Rate per round</span><b>{(depRate(n) * 100).toFixed(1)}%</b></div>
        <div className="row"><span>Interest at maturity</span><b className="good">+{money(interest)}</b></div>
        <div className="row sum"><span>Payout after {n} rounds</span><b>{money(amt + interest)}</b></div>
      </div>
    </Card>
  );
}

// ---- Turn order: lowest total first, ties re-roll. Replays the rolls the server made ----
export function OrderCard({ players, passes, order, close }: { players: Player[]; passes: OrderPass[]; order: number[]; close(): void }) {
  const [rolls, setRolls] = useState<[number, number][]>(players.map(() => [0, 0]));
  const [tie, setTie] = useState<number[]>([]);
  const [rank, setRank] = useState<Record<number, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let dead = false;
    const put = (i: number, r: [number, number]) => setRolls((all) => all.map((x, k) => (k === i ? r : x)));
    (async () => {
      await sleep(500); // the card pops in, then the dice go by themselves
      for (const [k, pass] of passes.entries()) {
        if (k) { setTie(pass.group); await sleep(1000); }
        for (const [n, i] of pass.group.entries()) {
          setTie([]);
          for (let s = 0; s < 7; s++) { put(i, s < 6 ? [d6(), d6()] : pass.rolls[n]); await sleep(70); if (dead) return; }
          await sleep(250);
        }
      }
      setRank(Object.fromEntries(order.map((p, k) => [p, ['1ST', '2ND', '3RD', '4TH'][k]])));
      setReady(true);
    })();
    return () => { dead = true; };
  }, []);
  useAuto(ready ? READ : 0, close);
  return (
    <Card title="WHO GOES FIRST?" sub="Lowest total moves first" peek={false} foot={<Btn id="go" cls="primary" disabled={!ready} onClick={close}>LET{'\u2019'}S GO</Btn>}>
      <div className="list" id="ord">{players.map((p, i) => (
        <div className={`order-row ${tie.includes(i) ? 'tie' : ''}`} key={i}>
          <Face color={p.color} /><span className="nm" style={{ color: hex(p.color) }}>{p.name}</span>
          <Die v={rolls[i][0]} /><Die v={rolls[i][1]} /><b>{rolls[i][0] + rolls[i][1] || ''}</b>
          {rank[i] && <span className="pill gold">{rank[i]}</span>}
        </div>
      ))}</div>
      <div className="note">Everyone rolls two dice. The LOWEST total goes first. Ties re-roll automatically.</div>
    </Card>
  );
}

// ---- Results ----
export function ResultsCard({ rank, close }: { rank: RankRow[]; close(v: 'menu' | 'again'): void }) {
  const S = state(), rows = rank.map((r) => ({ ...S.players[r.p], net: r.net }));
  const pod = [1, 0, 2].filter((k) => rows[k]).map((k) => ({ r: rows[k], k }));
  return (
    <Card title="GAME OVER" sub={`${rows.length} players`} cls="wide" tone={0xb8860b} foot={<>
      <Btn id="menu" onClick={() => close('menu')}>MAIN MENU</Btn>
      <Btn id="again" cls="primary" onClick={() => close('again')}>PLAY AGAIN</Btn>
    </>}>
      <div className="podium">{pod.map(({ r, k }) => (
        <div className="pod" key={k}>
          {k === 0 && <span className="gold"><Icon n="crown" /></span>}
          <Face color={r.color} /><b style={{ color: hex(r.color) }}>{r.name}</b>
          <div className="blk" style={{ '--c': ['#ffd23f', '#c9d3f5', '#cd7f32'][k], height: [130, 96, 70][k] } as CSSProperties}>{k + 1}</div>
        </div>
      ))}</div>
      <div className="list">{rows.map((r, k) => (
        <div className="item" style={{ cursor: 'default' }} key={k}>
          <b>#{k + 1}</b><Face color={r.color} /><span className="grow">{r.name}</span>
          {r.out ? <span className="pill red">BANKRUPT R{r.out}</span> : <b className="gold">{money(r.net)}</b>}
        </div>
      ))}</div>
    </Card>
  );
}

// ---- Casino: one card for a whole visit, told in views (see CasinoView). Lucky is roll-or-leave, then the result; high stakes is up to 2 rolls, each staking a bet of its own, or cash out after the first ----
export interface Ctl { view: Cell<CasinoView>; ask: Cell<{ id: number; mine: boolean } | null> }

export function CasinoCard({ ctl, close }: { ctl: Ctl; close(): void }) {
  const v = useCell(ctl.view), ask = useCell(ctl.ask), lucky = v.v === 'lucky';
  const [bet, setBet] = useState(v.bet);
  useEffect(() => setBet(v.bet), [v.bet]); // the server re-suggests a wager at every betting stage
  const [shown, setShown] = useState(0); // rolls on the table
  const [rolling, setRolling] = useState(false); // the dice are in the air
  const [dice, setDice] = useState<[number, number]>([0, 0]);
  const [sent, setSent] = useState(false); // my answer is on its way
  const next = v.rolls[shown]; // the roll the server has told and the table has not
  const nextRef = useRef(next);
  nextRef.current = next;
  const mine = !!ask?.mine && !sent;

  useEffect(() => setSent(false), [ask?.id]);
  useEffect(() => { // dice nobody threw: the free roll goes by itself, a stranger's roll shows when it is told
    if (rolling || !next) return;
    const t = setTimeout(() => setRolling(true), lucky && !shown ? 700 : 0);
    return () => clearTimeout(t);
  }, [rolling, next, lucky, shown]);
  useEffect(() => { // in the air: shuffle, and land as the server said once at least 8 frames have gone
    if (!rolling) return;
    let n = 0;
    const t = setInterval(() => {
      const r = nextRef.current;
      if (++n >= 8 && r) { clearInterval(t); setDice([r[0], r[1]]); setShown((s) => s + 1); setRolling(false); }
      else setDice([d6(), d6()]);
    }, 70);
    return () => clearInterval(t);
  }, [rolling]);

  const done = !rolling && shown === v.rolls.length; // everything told is on the table
  const last = shown ? v.rolls[shown - 1] : null, won = v.rolls.slice(0, shown).reduce((s, r) => s + r[2], 0), stake = v.stage === 'bet' || v.stage === 'again' ? bet : v.bet;
  const betting = (v.stage === 'bet' && !shown) || (v.stage === 'again' && done); // a stake is being picked
  const finished = done && v.stage === 'end', me = state().order[state().turn] === G.me;
  useAuto(finished ? READ : 0, close); // a final result stays up a moment, then settles by itself
  useEffect(() => { if (done && v.stage === 'cash') close(); }, [done, v.stage]);

  const go = () => { setSent(true); setRolling(true); reply(ask!.id, { act: 'roll', bet: betting ? bet : v.bet }); };
  const cash = () => { setSent(true); reply(ask!.id, { act: 'cash' }); };
  const sgn = (n: number) => (n > 0 ? '+' : '') + money(n);
  const staked = v.rolls.slice(0, shown).reduce((s, r) => s + r[3], 0);
  const tally: [string, number][] = [['Bets', -staked], ['Won', won], ['Net', won - staked]];

  return (
    <Card title={lucky ? 'LUCKY CASINO' : 'HIGH STAKES CASINO'} sub={lucky ? 'Free roll' : 'Bet, roll, cash out'} cls="casino" foot={
      !rolling && (
        v.stage === 'play' && mine ? <><Btn id="roll" cls="primary" onClick={go}>ROLL</Btn><Btn id="cash" cls="gold" onClick={cash}>WALK AWAY</Btn></>
        : v.stage === 'bet' && mine ? <Btn id="roll" cls="primary" onClick={go}>ROLL 1/2</Btn>
        : v.stage === 'again' && done && mine ? <><Btn id="roll" cls="primary" onClick={go}>ROLL {money(bet)}</Btn><Btn id="cash" cls="gold" onClick={cash}>CASH OUT</Btn></>
        : finished ? <Btn id="done" cls={`primary ${v.jail ? 'danger' : ''}`} onClick={close}>{me ? (v.jail ? 'GO TO JAIL' : 'COLLECT') : 'OK'}</Btn>
        : null
      )
    }>
      <div className="note" style={{ background: '#2b1a47' }}>
        {lucky ? 'You may roll two dice. Doubles win dice total \u00D7 $1,000. Anything else sends you to JAIL.'
          : `Place a bet (multiples of $100): each roll stakes a bet of its own and pays (total - 2) \u00D7 ${money((stake - 100) / 5)}. Up to 2 rolls. Same pair twice with total above 7 = JAIL.`}
      </div>
      {!lucky && betting && mine && (
        <div className="stepper">
          <button className="btn sm" onClick={() => setBet(Math.max(200, bet - 100))}><Icon n="minus" /></button>
          <b>BET {money(bet)}</b>
          <button className="btn sm" onClick={() => setBet(Math.min(v.max, bet + 100))}><Icon n="plus" /></button>
          <button className="btn sm gold" onClick={() => setBet(v.max)}>ALL IN</button>
        </div>
      )}
      <div className="dice-row"><Die v={dice[0]} cls={rolling ? 'roll' : ''} n={32} /><Die v={dice[1]} cls={rolling ? 'roll' : ''} n={32} /></div>
      <div className="big-msg">
        {!last ? 'Feeling lucky?'
          : lucky ? (v.jail ? <span className="bad">No match! Off to jail!</span> : <span className="good">DOUBLES! {last[0] + last[1]} {'\u00D7'} $1,000 = {money(won)}</span>)
          : finished && v.jail ? <span className="bad">Same pair twice! Straight to jail!</span>
          : <>Total {last[0] + last[1]}: <span className="good">+{money(last[2])}</span></>}
      </div>
      {!lucky && (sent || shown > 0 || v.stage !== 'bet') && (
        <div className="rows">{tally.map(([k, n]) => <div className={`row${k === 'Net' ? ' sum' : ''}`} key={k}><span>{k}</span><b className={n > 0 ? 'good' : n < 0 ? 'bad' : ''}>{sgn(n)}</b></div>)}</div>
      )}
    </Card>
  );
}
