import { CODE_RE } from '../shared/protocol';
import type { Env } from './room';

export { Room } from './room';

const randomCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname !== '/api/ws') return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });

    // Joining: the room is its code. Creating: draw codes until a free one is claimed.
    const code = url.searchParams.get('code');
    if (code) return CODE_RE.test(code) ? env.ROOM.getByName(code).fetch(req) : new Response('Bad room code', { status: 400 });
    for (let k = 0; k < 8; k++) {
      const fresh = randomCode(), room = env.ROOM.getByName(fresh);
      if (await room.create(fresh)) return room.fetch(req);
    }
    return new Response('No room available', { status: 503 });
  },
} satisfies ExportedHandler<Env>;
