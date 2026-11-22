import type { Answer, CasinoView, NewsCard as News, Notice, OrderPass, Player, Prompt, RankRow } from '../../shared/types';
import { reply } from '../asks';
import { autoFocus, cell, fullscreen, hd2d, openCard, type Open } from '../store';
import { VolumeRow } from './bits';
import { Btn, Card, CasinoCard, Check, ConfirmCard, DeedCard, DepCard, NewsCard, NoticeCard, OrderCard, PickCard, ResultsCard, RulesCard, type Ctl } from './dialogs';

export const openRules = () => openCard<string>((close) => <RulesCard close={close} />).done;

export const openAlert = (title: string, text: string) => openCard((close) => (
  <Card title={title} tone={0xb13e53} dismiss="ok" foot={<Btn id="ok" cls="primary" onClick={() => close()}>OK</Btn>}><div className="note">{text}</div></Card>
)).done;

export const openNotice = (n: Notice) => openCard((close) => <NoticeCard n={n} close={() => close()} />);

export const openNews = (c: News) => openCard((close) => <NewsCard c={c} close={() => close()} />);

export function openAsk(id: number, p: Prompt, onAnswer?: (v: Answer) => void): Open<void> | null {
  switch (p.k) {
    case 'deed': return openCard(() => <DeedCard id={id} p={p} />);
    case 'pick': return openCard(() => <PickCard id={id} p={p} />);
    case 'confirm': return openCard(() => <ConfirmCard id={id} p={p} />);
    case 'dep': return openCard(() => <DepCard id={id} p={p} />);
    case 'news': return openCard((close) => <NewsCard c={p.card} close={() => close()} redraw={(again) => { onAnswer?.(again); reply(id, again); }} />);
    default: return null;
  }
}

export const openOrder = (players: Player[], passes: OrderPass[], order: number[]) => openCard((close) => <OrderCard players={players} passes={passes} order={order} close={() => close()} />);

export const openResults = (rank: RankRow[]) => openCard<'menu' | 'again'>((close) => <ResultsCard rank={rank} close={close} />).done;

const openConfirm = (title: string, text: string, yes: string) => openCard<boolean>((close) => (
  <Card title={title} tone={0xb13e53} dismiss="no" foot={<>
    <Btn id="no" cls="primary" onClick={() => close(false)}>CANCEL</Btn>
    <Btn id="yes" cls="danger" onClick={() => close(true)}>{yes}</Btn>
  </>}><div className="note">{text}</div></Card>
)).done;

const quitConfirm = 'You forfeit the game. Everything you own goes back to the bank and you can\'t come back to this room.';

export const openMenu = (room: string, quit: () => void, bankrupt?: () => void) => openCard((close) => {
  const onQuit = bankrupt ? () => void openConfirm('QUIT TO TITLE?', quitConfirm, 'QUIT TO TITLE').then((yes) => { if (yes) { close(); quit(); } }) : () => { close(); quit(); };
  return (
    <Card title="MENU" sub={`Room ${room}`} dismiss="resume" foot={<>
      {!bankrupt && <Btn id="quit" onClick={onQuit}>QUIT TO TITLE</Btn>}
      <Btn id="rules" onClick={() => void openRules()}>HOW TO PLAY</Btn>
      <Btn id="resume" cls="primary" onClick={() => close()}>RESUME</Btn>
    </>}>
      <VolumeRow />
      <Check label="Auto-focus on current player" on={autoFocus} />
      <Check label="HD-2D lighting" on={hd2d} />
      {document.fullscreenEnabled && <Check label="Fullscreen" on={fullscreen} />}
      {bankrupt && <>
        <div className="grp">FORFEIT</div>
        <div className="pl-row">
          <Btn id="bankrupt" cls="danger" onClick={() => void openConfirm('GO BANKRUPT?', 'Everything you own goes back to the bank and you are out of the game. You stay in the room and can keep watching.', 'GO BANKRUPT').then((yes) => { if (yes) { close(); bankrupt(); } })}>GO BANKRUPT</Btn>
          <Btn id="quit" cls="danger" onClick={onQuit}>QUIT TO TITLE</Btn>
        </div>
      </>}
    </Card>
  );
});

export function openCasino(view: CasinoView, ask: { id: number; mine: boolean } | null) {
  const ctl: Ctl = { view: cell(view), ask: cell(ask) };
  return { ...ctl, card: openCard((close) => <CasinoCard ctl={ctl} close={() => close()} />) };
}
