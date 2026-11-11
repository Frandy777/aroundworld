import { session, stageOnly, useCell } from './store';
import { Debug } from './ui/debug';
import { Hud, Overlays, Tip } from './ui/hud';
import { Lobby, Title } from './ui/title';

export function App() {
  const { view } = useCell(session), bare = useCell(stageOnly);
  return (
    <>
      {!bare && view !== 'game' && <Title />}
      {!bare && view === 'lobby' && <Lobby />}
      {!bare && view === 'game' && <Hud />}
      {import.meta.env.DEV && <Debug />}
      {!bare && <Tip />}
      {!bare && <Overlays />}
    </>
  );
}
