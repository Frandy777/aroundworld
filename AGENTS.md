# AGENTS.md

## Module Map

- `src/shared/` — Pure TypeScript shared by client and worker (`data.ts` board/tiles, `state.ts` reducer & command validation, `protocol.ts` wire messages, `types.ts`).
- `src/worker/` — Cloudflare Worker entry (`index.ts`), hibernating SQLite Durable Object (`room.ts`), authoritative turn/event engine (`game.ts`), news deck (`news.ts`).
- `src/client/` — Browser app:
  - `store.ts` (`useCell`, `G.S`), `net.ts` / `controller.ts` (WS session, room lifecycle, dev `quickGame()`), `director.ts` (plays server events sequentially in lockstep with UI/animations).
  - `stage.ts` & `render/` — 3D stage, camera/post, lighting, sky, voxel builder, tile/token/effect models. Read the header comments of any `render/*.ts` file you touch before assuming internals.
  - `render/models/{special,invest,public}/<key>.ts` — One `ModelDef` default-export per file, auto-collected by `models/index.ts` via `import.meta.glob` (no registry edits). Supports `props`, `scale`, `levels`, `owner` (`switchOf` in `light.ts`), and `lamps` (`render/lamps.ts`); see `builder.ts` and `special/hong-kong.ts`. Ordinary cities dispatch by level via `models/city.ts` + `models/city/*` over `kit.ts`.
  - `ui/` — Pixel-art HUD, cards/dialogs, `?dev=1` panel (`debug.tsx`). `.tsx` files must export components only so Vite Fast Refresh works.
  - `dev.ts` — Dev-only URL flags and `window.__aw` bridge (tree-shaken in production).

## Commands & Verification

- `npm run check` — Primary fast check (<1s; prefer over `typecheck`): `tsc -b` + `scripts/check.mjs` (shader `#include`/patch anchors, board/reducer/math, and headless build/bake/tick/owner/lamp/bounds/budget checks for every registered model). `npm run check -- <model...>` (slug-matched, e.g. `las-vegas hong-kong`) prints a per-level mesh/tri budget, bounds, and overhang report.
- `npm run build` — Full typecheck + client & Worker production build.
- `npm run shots` — Runs `scripts/shot-matrix.mjs` via headless Chrome (probes `localhost:5173`–`5176`, checks WebGL/GLSL/console errors, writes `/tmp/aw-shots/matrix[-<tile>].png` + `.json`). Run `node scripts/shot-matrix.mjs --help` for all flags and `--list` JSON schema.
- **Dev server**: Do **not** start one unless asked. Probe `http://localhost:5173` first; if none is running (worktree/checkout), pass `--serve` to `shot-matrix.mjs` for a throwaway `vite --port 0`.

## Scene Automation & Visual Testing

Never click through Lobby UI, monkey-patch `Date.now`, `import('/src/...')` from console (loads duplicate HMR modules), or hand-write CDP capture scripts. Use URL flags, `window.__aw` (`src/client/dev.ts`), or `shot-matrix.mjs`.

- **URL flags** (`/?dev=1&...`): `dev=1` (DEV panel; drops stale non-dev lobbies), `autostart=1` / `bots=1..3` / `fresh=1` (fresh bot game straight to HUD), `hd=1|0`, `hour=0..24` (`0` midnight, `6.2` sunrise, `12` noon, `18` dusk), `speed=N`, `paused=1`, `tile=0..91`, `x=N`, `z=N`, `lift=N`, `zoom=fit|N`, `elev=deg`, `az=deg`, `rot=0|1` (instant camera jump), `clean=1` (hide chrome, keep DEV), `ui=0` (hide `#root`).

- **`window.__aw` runtime bridge**:
```js
await window.__aw.ready; // fonts, lighting, optional autostart settled
window.__aw.state(); // { view, look, hour, zoom, lod, target, elev, az, gamePaused, ... }
await window.__aw.setView({ hd: true, hour: 0, tile: 1, zoom: 2.2, elev: 52, az: 0, ui: false });
await window.__aw.strike(6, 28, 4.9); // launch & freeze missile; also step(dt), scrub(t), setLoop({ paused, scale })
await window.__aw.setLot(28, { p: 0, lv: 3 }); // preview lot without a room (`{ p: -1, sign: false }` hides SALE); also rebuild(i), isolate(i | null)
await window.__aw.quickGame(3); window.__aw.pause(true); // dev room; pause(true) freezes server question clocks
await window.__aw.cmd({ c: 'goto', pi: 0, i: 1, land: true }, { wait: 30000 }); // runs on ROLL DICE ({ wait } waits for it to open)
await window.__aw.idle(); window.__aw.ui(); // event-driven HUD/card waits & state (no fixed sleeps)
await window.__aw.click('SKIP'); // data-id, text/prefix, or selector on top modal/screen; also until(pred, ms)
```

- **Batch visual sheets (`scripts/shot-matrix.mjs`)** — `--tile(s)`, `--iso`, and `--lots` accept tile indices, names, or kind slugs; read output PNGs directly to inspect visuals:
```bash
npm run shots # (pixel, hd2d) x (12, 18, 0h) -> /tmp/aw-shots/matrix.png
node scripts/shot-matrix.mjs --tile=28 --iso=1 --nosign=1 --az=-35,0,35,145 --zooms=0.6,2.4 --hours=12 # isolated turntable + LOD
node scripts/shot-matrix.mjs --tile="Las Vegas" --lx=-0.3 --ly=1.5 --lz=0.45 --zoom=3 --crop=420x340 --scale=2 # lot-space close-up (--lot=1 for origin; or --tx/--tz/--lift)
node scripts/shot-matrix.mjs --tile=13 --lv=3 --m=1 --lots=14:1:2,15:-1:0:0:0 --time=0,1 --q=vol=1 # neighbour context, clock poses, extra URL query
node scripts/shot-matrix.mjs --out=/tmp/aw-shots/hk --list=shots.json # named PNGs + sheet.png + run.json (--out=x.png for sheet only)
node scripts/shot-matrix.mjs --looks=pixel --hours=0,12,18 --vs --expect=same # BEFORE | AFTER | DIFF vs HEAD (or --vs=ref / --cmp=dir); check table first, open CHANGED shots
```

## Style & Conventions

- Keep code compact and direct; match local naming/helpers and `strict` / `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax`.
- Trailing `//` comments take a single natural space — never pad spaces to align columns or rewrap untouched lines.
- Preserve explanatory (*why*) comments; do not overwrite user-tuned constants or style parameters unasked.
- Git commits: concise single-line imperative subjects matching `git log --oneline`, without extra trailers unless requested.
