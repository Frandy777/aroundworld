import { MAX_PLAYERS } from '../shared/data';
import * as director from './director';
import * as net from './net';
import { cards, hudLive, session } from './store';
import { openAlert } from './ui/open';

// Where this tab is: the title, a room's lobby, or a game. The room it is in survives a reload (the same seat comes back).
const KEY = 'room';

/** Back to the title's board. */
function toTitle() {
  director.exitToDemo();
  session.set({ view: 'title', room: null });
}

/** Create a room (no code) or join one. Resolves null once in, else why not. */
export const enter = (code: string, name: string, dev?: boolean) => net.open(code, name, dev);

export function leaveRoom() {
  net.leave();
  sessionStorage.removeItem(KEY);
  toTitle();
}

/** Dev: open a fresh dev room, fill `bots` seats and skip the opening order card. */
export async function quickGame(bots = 3): Promise<string | null> {
  leaveRoom();
  const err = await enter('', '', true);
  if (err) return err;
  const me = session.get().room?.me ?? 0, cap = Math.max(1, Math.min(MAX_PLAYERS - 1, bots));
  for (let i = 0, n = 0; i < MAX_PLAYERS && n < cap; i++) if (i !== me) { net.send({ t: 'bot', seat: i }); n++; }
  net.send({ t: 'start' });
  await new Promise<void>((res) => {
    const done = () => { clearTimeout(timer); unCards(); unHud(); res(); };
    const check = () => { queueMicrotask(director.dismissShown); if (hudLive.get()) done(); };
    const unCards = cards.sub(check), unHud = hudLive.sub(check), timer = setTimeout(done, 5000);
    check();
  });
  return null;
}

/** Starts the client's conversation with the server; returns what ends it. */
export function boot() {
  const stopDirector = director.start(leaveRoom);
  net.listen({
    room(r) {
      if (net.devUrl && !r.dev && !r.started) return leaveRoom(); // ?dev=1 asked for a dev room, not an old plain lobby from before
      sessionStorage.setItem(KEY, r.code);
      const { view } = session.get();
      if (r.started) return session.set({ view, room: r }); // the game's own messages move the view on
      if (view === 'game') director.exitToDemo(); // the game is over: everyone back to the lobby
      session.set({ view: 'lobby', room: r });
    },
    game: director.restore,
    ev: director.push,
    end(why) {
      sessionStorage.removeItem(KEY);
      toTitle();
      void openAlert('DISCONNECTED', why);
    },
  });
  const code = sessionStorage.getItem(KEY);
  if (code) void net.open(code, '').then((err) => err && sessionStorage.removeItem(KEY));
  return () => { stopDirector(); net.leave(1000); }; // closed as a page is closed, not with LEAVE: the seat (and a game under way) waits for the next boot to take it back
}
