# AGENTS.md

## Module Map

- `src/shared/` — Pure TypeScript shared by client and worker (`data.ts` board/tile definitions, `state.ts` event reducer & command validation, `protocol.ts` wire messages, `types.ts`).
- `src/worker/` — Cloudflare Worker entry (`index.ts`), hibernating SQLite Durable Object (`room.ts`), authoritative turn/event engine (`game.ts`), and news deck (`news.ts`).
- `src/client/` — Browser app:
  - `store.ts` — Minimal `cell` store (`useCell`, `G.S` screen state).
  - `net.ts` / `controller.ts` — WebSocket session, room lifecycle, and dev `quickGame()`.
  - `director.ts` — Plays server events sequentially onto the screen so UI and animations stay in lockstep.
  - `stage.ts` & `render/` — 3D stage, camera/post-processing, lighting, sky, voxel builder, and tile/token/effect models. Rendering and material details evolve actively—always read the header comments of the specific `render/*.ts` files you touch rather than assuming fixed rendering internals.
  - `render/models/{special,invest,public}/<key>.ts` — One registered tile model per file: a `ModelDef` (`key` = tile name or kind, `props`, optional `scale`; for a special city optional `levels`: the landmarks each upgrade adds over its standing `props`, drawn into the building group in place of the gold level sign, and optional `owner`: called with the owner's colour, or null while for sale or mortgaged, so the model can switch its lamps (`switchOf` in `light.ts`) and tint what shows its owner; see `special/hong-kong.ts` for both; optional `lamps`: the tile's landmark point lights `{at, color, power, reach, final, owned, flicker}` that `render/lamps.ts` collects into the fixed `PointLight` slots, `owned` dimmed by `lotLit`) default-exported and auto-collected by `models/index.ts` via `import.meta.glob` (no shared registry edits). Ordinary cities are drawn by ownership, not a model file: `models/city.ts` dispatches `building()` to one file per level under `models/city/` over the shared `kit.ts`.
  - `ui/` — Pixel-art HUD, cards/dialogs, and `?dev=1` debug panel (`debug.tsx`). Keep `.tsx` component files exporting components only so Vite Fast Refresh works in place.
  - `dev.ts` — Dev-only URL flag parser and `window.__aw` automation bridge (tree-shaken out of production builds).

## Commands & Verification

- `npm run check` — Primary fast check (<1s): runs native TypeScript 7 (`tsc -b`, ~300–400ms is normal—no `--force` needed) plus `scripts/check.mjs` (verifies Three.js `#include` / shader patch anchors, board data, reducer, pure math, and every model in `render/models/{special,invest,public}`: builds, bakes, ticks movers, exercises `owner()` callbacks, asserts the declared fixed lamps fit their `light.ts` slots, and lints NaN vertices, plot bounds, ground contact, and draw-call/triangle budgets under Node—no browser needed). `npm run check -- <model...>` (e.g. `npm run check -- las-vegas hong-kong`, names slug-matched) prints a per-level inspection report instead—meshes/tris budgets, bounding box, and plot overhang per level—then exits.
- `npm run build` — Full typecheck + client & Cloudflare Worker production build.
- `npm run shots` — Runs `scripts/shot-matrix.mjs` against the dev server (probes `localhost:5173`–`5176`, or `--url`/`--serve`) via headless Chrome, checks for WebGL/GLSL/console errors, and writes a labeled comparison sheet to `/tmp/aw-shots/matrix.png`. `npm run typecheck` is just the `tsc -b` half of `check` — prefer `check`.
- **Dev server**: Do **not** start a dev server unless explicitly asked. Probe `http://localhost:5173` first when visual checks are needed; in a worktree or checkout with no server running, `shot-matrix.mjs --serve` spawns a throwaway `vite --port 0` for the run and tears it down after.

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
await window.__aw.scrub(2.0);                  // seek the world clock to t outright (poses `tick`-driven models exactly)
window.__aw.setLoop({ paused: false, scale: 1 });

// Model workbench & lot previews (no room, no turn needed):
await window.__aw.setLot(28, { p: 0, lv: 3 });       // owner, level, mortgaged; `{ p: -1, sign: false }` hides a vacant SALE board
await window.__aw.rebuild(28);                     // re-draw tile 28's props from its model file (board state untouched)
await window.__aw.isolate(28);                     // tile 28 alone over its plot-outline bound (null: whole board again)

// Room & in-game dev commands (commands run while ROLL DICE is active):
await window.__aw.quickGame(3);
window.__aw.cmd({ c: 'own', i: 1, o: { p: 0, lv: 3, m: false } });
```

### Batch Visual Comparison (`npm run shots`)
For shader, lighting, camera, model, or effect changes, prefer one matrix capture over ad-hoc `/tmp` simulators or dozens of manual browser calls. Close-ups, owner-colour comparisons, neighbour lots and scripted single shots are all built in — never hand-write a CDP capture script:
```bash
# Default: (pixel, hd2d) x (12:00, 18:00, 00:00) whole-board sheet -> /tmp/aw-shots/matrix.png
npm run shots

# Close-up on tile 1 across dawn/noon/dusk/night:
node scripts/shot-matrix.mjs --tile=1 --zooms=2.2 --hours=0,6.2,12,18

# Freeze a missile strike during terminal dive (t=4.9s):
node scripts/shot-matrix.mjs --tile=28 --zooms=1.6 --looks=hd2d --hours=0,12 --strike=6,28,4.9

# Model turntable: one tile alone, four azimuths, no SALE board, two zooms (LOD far/near):
node scripts/shot-matrix.mjs --tile=28 --iso=1 --nosign=1 --az=-35,0,35,145 --zooms=0.6,2.4 --hours=12

# Level comparison and a paused animation frame (world clock t in seconds):
node scripts/shot-matrix.mjs --tile=10 --lv=0,1,2,3 --hours=12 --looks=pixel
node scripts/shot-matrix.mjs --tile=77 --time=0,1.0,2.0 --az=0,145 --hours=12

# Building close-up: aim the camera at the building (tx/tz shift the target off the lot
# centre in world units, lift raises it), crop each cell to WxH centred + dx/dy (css px),
# NEAREST-upscale by --scale:
node scripts/shot-matrix.mjs --tiles=1,20 --owners=0,1 --lv=2 --az=0,-35 --zoom=3 --tx=1.6 --tz=1 --lift=0.9 --crop=420x340 --scale=2

# Same, in the model's own LOT space (lx/lz measured from the props origin, ly up from
# the plot top — the coordinates the model files use; --lot=1 is a bare centre aim;
# tiles also take a name or kind slug):
node scripts/shot-matrix.mjs --tile=jerusalem --lot=1 --zoom=3 --crop=420x340 --scale=2
node scripts/shot-matrix.mjs --tile="Las Vegas" --lx=-0.3 --ly=1.5 --lz=0.45 --zoom=3 --hours=0

# Neighbour lots for context (t:p:lv[:m[:sign]], names work too), mortgaged lot, keep the uncropped frames:
node scripts/shot-matrix.mjs --tile=13 --lv=3 --m=1 --lots=14:1:2,15:-1:0:0:0 --raw

# Scripted single shots — a JSON array (inline or a file path), one named PNG per entry,
# --out is the directory. Shot: {name, tile, tx, tz, x, z, lift, lot, lx, ly, lz, zoom,
# elev, az, hour, hd, ui, time, iso, setlot:{p,lv,m,sign}, lots:[[t,p,lv,m,sign]],
# strike:[f,t,s], crop, scale}:
node scripts/shot-matrix.mjs --out=/tmp/aw-shots/hk --list='[{"name":"hk-nite","tile":13,"hour":0,"zoom":3,"tx":1.35,"tz":0.75,"lift":2.6,"crop":{"w":360,"h":420},"scale":2}]'

# Same, stitched into ONE labeled contact sheet (--out ending .png, or --sheet[=file]);
# cells keep their own crop/scale and the grid sizes to the largest:
node scripts/shot-matrix.mjs --out=/tmp/aw-shots/hk.png --list=shots.json --cols=2

# No dev server where you're running (worktree, delegated checkout): spawn a throwaway one
node scripts/shot-matrix.mjs --serve --tile=28 --iso=1 --hours=0,12
```
Rows = looks × zooms × elevs × tiles × owners × levels, columns = hours × azimuths × times; `--cols` overrides the column count. Intermediate frames go to a per-run temp dir, and the default output picks up the tile tag (`matrix-rio.png`, `matrix-t1-t20.png`; only a tileless run writes `matrix.png`), so parallel runs sharing a directory cannot overwrite each other.
Read the resulting `/tmp/aw-shots/matrix.png` directly to inspect visual output.

## Style & Conventions

- Keep code compact and direct; match surrounding naming, concisely typed helpers, and `strict` / `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax`.
- Trailing `//` comments take a single natural space — never pad spaces to align them at a fixed column, and never rewrap untouched lines just to keep an alignment.
- Preserve existing explanatory comments (which explain *why* a design choice exists); do not overwrite user-tuned constants or style parameters unasked.
- When asked to create git commits, use concise single-line imperative subjects matching `git log --oneline` without extra trailers unless requested.
