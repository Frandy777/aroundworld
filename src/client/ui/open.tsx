import type { CasinoView, NewsCard as News, Notice, OrderPass, Player, Prompt, RankRow } from '../../shared/types';
import { reply } from '../asks';
import { cell, openCard, type Open } from '../store';
import { Btn, Card, CasinoCard, ConfirmCard, DeedCard, NewsCard, NoticeCard, OrderCard, PickCard, ResultsCard, RulesCard, type Ctl } from './dialogs';

// Putting a card up is not a component, so it lives apart from the cards (dialogs.tsx): a module that exports anything but components can't be hot-refreshed in place.

export const openRules = () => openCard<string>((close) => <RulesCard close={close} />).done;

// Something to tell, or a refusal.
export const openAlert = (title: string, text: string) => openCard((close) => (
  <Card title={title} tone={0xb13e53} dismiss="ok" foot={<Btn id="ok" cls="primary" onClick={() => close()}>OK</Btn>}><div className="note">{text}</div></Card>
)).done;

export const openNotice = (n: Notice) => openCard((close) => <NoticeCard n={n} close={() => close()} />);

/** A story to read: for everybody on a news tile, and for the players who are not asked when the Media owner may keep it. */
export const openNews = (c: News) => openCard((close) => <NewsCard c={c} close={() => close()} />);

/** The card for a question to this player, or null for a question that has no card of its own (roll, casino). */
export function openAsk(id: number, p: Prompt): Open<void> | null {
  switch (p.k) {
    case 'deed': return openCard(() => <DeedCard id={id} p={p} />);
    case 'pick': return openCard(() => <PickCard id={id} p={p} />);
    case 'confirm': return openCard(() => <ConfirmCard id={id} p={p} />);
    case 'news': return openCard((close) => <NewsCard c={p.card} close={() => close()} redraw={(again) => reply(id, again)} />);
    default: return null;
  }
}

export const openOrder = (players: Player[], passes: OrderPass[], order: number[]) => openCard((close) => <OrderCard players={players} passes={passes} order={order} close={() => close()} />);

export const openResults = (rank: RankRow[]) => openCard<'menu' | 'again'>((close) => <ResultsCard rank={rank} close={close} />).done;

export const openMenu = (room: string, quit: () => void) => openCard((close) => (
  <Card title="MENU" sub={`Room ${room}`} dismiss="resume" foot={<>
    <Btn id="quit" cls="danger" onClick={() => { close(); quit(); }}>QUIT TO TITLE</Btn>
    <Btn id="rules" onClick={() => void openRules()}>HOW TO PLAY</Btn>
    <Btn id="resume" cls="primary" onClick={() => close()}>RESUME</Btn>
  </>} />
));

// ---- Casino: the card of the visit in progress, if any ----
let casino: Ctl | null = null;

/** Put a view on the casino card (the first one opens it). Settles when the card has closed. */
export function showCasino(view: CasinoView, ask: { id: number; mine: boolean } | null): Promise<void> {
  if (casino && casino.cid === view.cid) { casino.view.set(view); casino.ask.set(ask); return casino.card.done; }
  const ctl: Ctl = { cid: view.cid, view: cell(view), ask: cell(ask), card: null as unknown as Open<void> };
  ctl.card = openCard((close) => <CasinoCard ctl={ctl} close={() => close()} />);
  ctl.card.done.then(() => { if (casino === ctl) casino = null; });
  casino = ctl;
  return ctl.card.done;
}
export const dropCasinoAsk = (id: number) => { if (casino?.ask.get()?.id === id) casino.ask.set(null); };
export const closeCasino = () => casino?.card.close();
export const forgetCasino = () => { casino = null; };
