import { session, useCell } from './store';
import { Debug } from './ui/debug';
import { Hud, Overlays, Tip } from './ui/hud';
import { Lobby, Title } from './ui/title';

export function App() {
  const { view } = useCell(session);
  return (
    <>
      {view !== 'game' && <Title />}
      {view === 'lobby' && <Lobby />}
      {view === 'game' && <Hud />}
      {view === 'game' && <Debug />}
      <Tip />
      <Overlays />
    </>
  );
}
