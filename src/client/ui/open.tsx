import type { CasinoView, NewsCard as News, Notice, OrderPass, Player, Prompt, RankRow } from '../../shared/types';
import { reply } from '../asks';
import { autoFocus, cell, openCard, type Open } from '../store';
import { Btn, Card, CasinoCard, Check, ConfirmCard, DeedCard, NewsCard, NoticeCard, OrderCard, PickCard, ResultsCard, RulesCard, type Ctl } from './dialogs';

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
  </>}>
    <Check label="Auto-focus on current player" on={autoFocus} />
  </Card>
));

/** The card of a casino visit: one card for the whole visit, which stays up while `view` and `ask` (the question put to this player, if any) change under it. */
export function openCasino(view: CasinoView, ask: { id: number; mine: boolean } | null) {
  const ctl: Ctl = { view: cell(view), ask: cell(ask) };
  return { ...ctl, card: openCard((close) => <CasinoCard ctl={ctl} close={() => close()} />) };
}
