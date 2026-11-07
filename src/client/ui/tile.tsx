import { INVEST, LEVEL_NAMES, PUBLIC, SPECIAL, TILES, cityRent, maxLevel, type InvestKind, type PublicKind, type Tile } from '../../shared/data';
import { hasMonopoly } from '../../shared/state';
import { useGame } from '../store';
import { Face, Pips, Rows, hex, money } from './bits';

const CASINO = {
  lucky: 'Roll two dice. Doubles send you to jail; otherwise win dice total \u00D7 $1,000.',
  stakes: 'Bet any amount (multiples of $100), then roll: win (total - 2) \u00F7 5 \u00D7 (bet - 100). Play up to 2 rolls. If both rolls show the same pair with a total above 7, you go to jail.',
};
const fxText = (t: Tile) => (t.type === 'special' ? SPECIAL[t.name] : t.type === 'invest' ? INVEST[t.kind as InvestKind].fx : t.kind === 'casino' ? CASINO[t.variant!] : PUBLIC[t.kind as PublicKind].fx);

export function TileBody({ t, bare = false }: { t: Tile; bare?: boolean }) {
  const S = useGame(), o = S.own[t.i], p = o && S.players[o.p];
  const mono = hasMonopoly(S, t);
  return (
    <>
      {t.type === 'city' && (
        <>
          <Rows a={[['Price', money(t.price)], ['Upgrade', money(t.up)], ['Mortgage value', money(t.mort)]]} />
          <table className="tbl"><tbody>
            <tr><th>LEVEL</th><th>RENT</th></tr>
            {cityRent(t).map((v, i) => <tr key={i} className={o?.lv === i ? 'cur' : ''}><td>{LEVEL_NAMES[i]}</td><td>{money(v)}</td></tr>)}
          </tbody></table>
          {mono && <div className="note">Region monopoly achieved: <b className="gold">+50% rent</b>.</div>}
        </>
      )}
      {t.type === 'special' && (
        <>
          <Rows a={[['Price', money(t.price)], ['Upgrade', t.up ? money(t.up) : 'Not upgradable'], ['Mortgage value', money(t.mort)]]} />
          <div className="note">{fxText(t)}{t.up > 0 && <><br /><span className="dim">Values listed by level: Empty / Lv 1 / Lv 2</span></>}</div>
        </>
      )}
      {t.type === 'invest' && (() => {
        const group = TILES.filter((x) => x.kind === t.kind), mine = o ? group.filter((x) => S.own[x.i]?.p === o.p).length : 0;
        return (
          <>
            <Rows a={[['Price', money(t.price)], ['Group', `${group.length} tiles`]]} />
            <div className="note">{fxText(t)}</div>
            {o && <><div className="row"><span>{p!.name} owns</span><b>{mine} / {group.length}</b></div><div className="bar"><i style={{ width: `${(mine / group.length) * 100}%` }} /></div></>}
          </>
        );
      })()}
      {t.type === 'public' && <div className="note">{fxText(t)}</div>}
      {!bare && t.type !== 'public' && (
        <div className="owner">
          {p ? <><Face color={p.color} /><b style={{ color: hex(p.color) }}>{p.name}</b></> : <span className="dim">Unowned</span>}
          <span style={{ flex: 1 }} />
          {o && <Pips n={o.lv} max={maxLevel(t) || 1} />}
          {o?.m && <span className="pill red">MORTGAGED</span>}
        </div>
      )}
    </>
  );
}
