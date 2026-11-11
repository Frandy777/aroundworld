# AGENTS.md

## Module Map

- `src/shared/` — Pure TypeScript shared by client and worker (`data.ts` board/tile definitions, `state.ts` event reducer & command validation, `protocol.ts` wire messages, `types.ts`).
- `src/worker/` — Cloudflare Worker entry (`index.ts`), hibernating SQLite Durable Object (`room.ts`), authoritative turn/event engine (`game.ts`), and news deck (`news.ts`).
- `src/client/` — Browser app:
  - `store.ts` — Minimal `cell` store (`useCell`, `G.S` screen state).
  - `net.ts` / `controller.ts` — WebSocket session, room lifecycle, and dev `quickGame()`.
  - `director.ts` — Plays server events sequentially onto the screen so UI and animations stay in lockstep.
  - `stage.ts` & `render/` — 3D stage, camera/post-processing, lighting, sky, voxel builder, and tile/token/effect models. Rendering and material details evolve actively—always read the header comments of the specific `render/*.ts` files you touch rather than assuming fixed rendering internals.
  - `ui/` — Pixel-art HUD, cards/dialogs, and `?dev=1` debug panel (`debug.tsx`). Keep `.tsx` component files exporting components only so Vite Fast Refresh works in place.
  - `dev.ts` — Dev-only URL flag parser and `window.__aw` automation bridge (tree-shaken out of production builds).

## Commands & Verification

- `npm run check` — Primary fast check (<1s): runs native TypeScript 7 (`tsc -b`, ~300–400ms is normal—no `--force` needed) plus `scripts/check.mjs` (verifies Three.js `#include` / shader patch anchors, board data, reducer, and pure math).
- `npm run build` — Full typecheck + client & Cloudflare Worker production build.
- `npm run shots` — Runs `scripts/shot-matrix.mjs` against the running dev server (`http://localhost:5173`) via headless Chrome, checks for WebGL/GLSL/console errors, and writes a labeled comparison sheet to `/tmp/aw-shots/matrix.png`.
- **Dev server**: Do **not** start a dev server unless explicitly asked. Probe `http://localhost:5173` first when visual checks are needed.

## Scene Automation & Visual Testing (Dev Builds)

Avoid clicking through Lobby UI, monkey-patching `Date.now`, or calling `import('/src/...')` from the console (which loads duplicate HMR module instances). Use URL query flags or `window.__aw` instead:

### URL Query Flags
Open `http://localhost:5173/?dev=1` with any combination of:
- `dev=1` — Enables the `DEV` panel across Title, Lobby, and Game screens (and drops stale non-dev lobbies).
- `autostart=1` / `bots=1..3` / `fresh=1` — Creates a fresh dev room with bots and skips the turn-order modal straight to the live HUD.
- `hd=1|0` — Selects lighting mode on boot.
- `hour=0..24` — Freezes time-of-day sky/sun at an exact hour (`0` midnight, `6.2` sunrise, `12` noon, `18` dusk).
- `tile=0..91`, `x=N`, `z=N`, `zoom=fit|N`, `elev=deg`, `az=deg`, `rot=0|1` — Jumps camera immediately with zero damping lag.
- `clean=1` — Hides Title/Lobby/HUD chrome while keeping the `DEV` button; `ui=0` hides `#root` completely for bare-canvas screenshots.

### `window.__aw` Runtime Bridge
```js
await window.__aw.ready; // fonts, lighting pass, optional autostart, and initial frame settled
window.__aw.state();     // { view, look, hour, zoom, fitZoom, lod, lodName, target, elev, az, ... }

// Instant, damping-free camera / look / clock / chrome control (resolves on next painted frame):
await window.__aw.setView({ hd: true, hour: 0, tile: 1, zoom: 2.2, elev: 52, az: 0, ui: false });

// Deterministic animation & effect scrubbing (camera stays interactive while world is paused):
await window.__aw.strike(6, 28, 4.9);          // launch missile and freeze at t = 4.9s (terminal dive)
await window.__aw.step(0.2);                   // advance simulation & tweens by 0.2s
window.__aw.setLoop({ paused: false, scale: 1 });

// Room & in-game dev commands (commands run while ROLL DICE is active):
await window.__aw.quickGame(3);
window.__aw.cmd({ c: 'own', i: 1, o: { p: 0, lv: 3, m: false } });
```

### Batch Visual Comparison (`npm run shots`)
For shader, lighting, camera, model, or effect changes, prefer one matrix capture over ad-hoc `/tmp` simulators or dozens of manual browser calls:
```bash
# Default: (pixel, hd2d) x (12:00, 18:00, 00:00) whole-board sheet -> /tmp/aw-shots/matrix.png
npm run shots

# Close-up on tile 1 across dawn/noon/dusk/night:
node scripts/shot-matrix.mjs --tile=1 --zoom=2.2 --hours=0,6.2,12,18

# Freeze a missile strike during terminal dive (t=4.9s):
node scripts/shot-matrix.mjs --tile=28 --zoom=1.6 --looks=hd2d --hours=0,12 --strike=6,28,4.9
```
Read the resulting `/tmp/aw-shots/matrix.png` directly to inspect visual output.

## Style & Conventions

- Keep code compact and direct; match surrounding naming, concisely typed helpers, and `strict` / `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax`.
- Preserve existing explanatory comments (which explain *why* a design choice exists); do not overwrite user-tuned constants or style parameters unasked.
- When asked to create git commits, use concise single-line imperative subjects matching `git log --oneline` without extra trailers unless requested.
