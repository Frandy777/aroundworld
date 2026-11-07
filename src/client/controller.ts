import * as director from './director';
import * as net from './net';
import { enterDemo } from './stage';
import { G, clearCards, hudLive, selectedTile, session } from './store';
import { openAlert } from './ui/open';

// Where this tab is: the title, a room's lobby, or a game. The room it is in survives a reload (the same seat comes back).
const KEY = 'room';

/** Back to the title's board. */
function toTitle() {
  director.reset();
  G.S = null;
  hudLive.set(false);
  selectedTile.set(-1);
  clearCards();
  enterDemo();
  session.set({ view: 'title', room: null });
}

/** Create a room (no code) or join one. Resolves null once in, else why not. */
export const enter = (code: string, name: string) => net.open(code, name);

export function leaveRoom() {
  net.leave();
  sessionStorage.removeItem(KEY);
  toTitle();
}
director.hooks.leave = leaveRoom;

/** Starts the client's conversation with the server; returns what ends it. */
export function boot() {
  const stopDirector = director.start();
  net.listen({
    room(r) {
      sessionStorage.setItem(KEY, r.code);
      const { view } = session.get();
      if (r.started) return session.set({ view, room: r }); // the game's own messages move the view on
      if (view === 'game') { director.reset(); G.S = null; hudLive.set(false); clearCards(); enterDemo(); } // the game is over: everyone back to the lobby
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
