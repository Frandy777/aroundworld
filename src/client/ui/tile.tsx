import { INVEST, LEVEL_NAMES, PUBLIC, SPECIAL, TILES, cityRent, maxLevel, type InvestKind, type PublicKind, type Tile } from '../../shared/data';
import { hasMonopoly, lotValue } from '../../shared/state';
import { useGame } from '../store';
import { Face, Pips, Rows, hex, money } from './bits';

const CASINO = {
  lucky: 'Pick a number 1\u20136 and stake at least $100 on it: one die on the number pays bet \u00D7 2 \u2212 $10, both pay bet \u00D7 5 \u2212 $100. Up to 2 plays, each with a fresh bet. Two jackpots send you to jail.',
  stakes: 'Bet any amount (multiples of $100): each roll stakes a bet of your choosing and wins (total - 2) \u00F7 5 \u00D7 (bet - 100), settling on its own. Up to 2 rolls. If both rolls show the same pair with a total above 7, you go to jail.',
};
const effectText = (t: Tile) => (t.type === 'special' ? SPECIAL[t.name] : t.type === 'invest' ? INVEST[t.kind as InvestKind].effect : t.kind === 'casino' ? CASINO[t.variant!] : PUBLIC[t.kind as PublicKind].effect);

export function TileBody({ t, bare = false }: { t: Tile; bare?: boolean }) {
  const S = useGame(), o = S.ownedByTile[t.i], p = o && S.players[o.owner];
  const mono = hasMonopoly(S, t);
  return (
    <>
      {t.type === 'city' && (
        <>
          <Rows a={[['Price', money(t.price)], ['Upgrade', money(t.upgradeCost)], ['Lot value', money(lotValue(t, o))]]} />
          <table className="tbl"><tbody>
            <tr><th>LEVEL</th><th>RENT</th></tr>
            {cityRent(t).map((v, i) => <tr key={i} className={o?.level === i ? 'cur' : ''}><td>{LEVEL_NAMES[i]}</td><td>{money(v)}</td></tr>)}
          </tbody></table>
          {mono && <div className="note">Region monopoly achieved: <b className="gold">+50% rent</b>.</div>}
        </>
      )}
      {t.type === 'special' && (
        <>
          <Rows a={[['Price', money(t.price)], ['Upgrade', t.upgradeCost ? money(t.upgradeCost) : 'Not upgradable'], ['Lot value', money(lotValue(t, o))]]} />
          <div className="note">{effectText(t)}{t.upgradeCost > 0 && <><br /><span className="dim">Values listed by level: Empty / Lv 1 / Lv 2</span></>}</div>
        </>
      )}
      {t.type === 'invest' && (() => {
        const group = TILES.filter((x) => x.kind === t.kind), mine = o ? group.filter((x) => S.ownedByTile[x.i]?.owner === o.owner).length : 0;
        return (
          <>
            <Rows a={[['Price', money(t.price)], ['Group', `${group.length} tiles`]]} />
            <div className="note">{effectText(t)}</div>
            {o && <><div className="row"><span>{p!.name} owns</span><b>{mine} / {group.length}</b></div><div className="bar"><i style={{ width: `${(mine / group.length) * 100}%` }} /></div></>}
          </>
        );
      })()}
      {t.type === 'public' && <div className="note">{effectText(t)}</div>}
      {!bare && t.type !== 'public' && (
        <div className="owner">
          {p ? <><Face color={p.color} /><b style={{ color: hex(p.color) }}>{p.name}</b></> : <span className="dim">Unowned</span>}
          <span style={{ flex: 1 }} />
          {o && <Pips n={o.level} max={maxLevel(t) || 1} />}
          {o?.mortgaged && <span className="pill red">MORTGAGED</span>}
        </div>
      )}
    </>
  );
}
