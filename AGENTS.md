# AGENTS.md

## Module Map

- `src/shared/` — Pure TypeScript shared by client and worker (`data.ts` board/tiles, `state.ts` reducer & command validation, `protocol.ts` wire messages, `types.ts`).
- `src/worker/` — Cloudflare Worker entry (`index.ts`), hibernating SQLite Durable Object (`room.ts`), authoritative turn/event engine (`game.ts`), news deck (`news.ts`).
- `src/client/` — Browser app:
  - `store.ts` (`useCell`, `G.S`), `net.ts` / `controller.ts` (WS session, room lifecycle, dev `quickGame()`), `director.ts` (plays server events sequentially in lockstep with UI/animations).
  - `stage.ts` & `render/` — 3D stage, camera/post, lighting, sky, voxel builder, tile/token/effect models.
  - `render/models/{special,invest,public}/<key>.ts` — One `ModelDef` default-export per file, auto-collected by `models/index.ts` via `import.meta.glob` (no registry edits). Supports `props`, `scale`, `levels`, `owner` (`switchOf` in `light.ts`), and `lamps` (`render/lamps.ts`); see `builder.ts` and `special/hong-kong.ts`. Ordinary cities dispatch by level via `models/city.ts` + `models/city/*` over `kit.ts`.
  - `ui/` — Pixel-art HUD, cards/dialogs, `?dev=1` panel (`debug.tsx`). `.tsx` files must export components only so Vite Fast Refresh works.
  - `dev.ts` — Dev-only URL flags and `window.__aw` bridge (tree-shaken in production).

## Commands & Verification

- `npm run check` — TypeScript check only (`tsc -b`; `typecheck` is an alias).
- `npm run inspect -- <model...>` — Opt-in model diagnostics (e.g. `las-vegas hong-kong`): per-level mesh/triangle counts, bounds and overhangs. Requires explicit model names; no assertions or full-scene sweep.
- `npm run build` — Full typecheck + client & Worker production build.
- `npm run shots` — Runs `scripts/shot-matrix.mjs` via headless Chrome (probes `localhost:5173`–`5176`, checks WebGL/GLSL/console errors, writes `/tmp/aw-shots/matrix[-<tile>].png` + `.json`). Run `node scripts/shot-matrix.mjs --help` for all flags and `--list` JSON schema.
- `npm test` — Runs the game-rules unit tests in `test/` via `node --test` (Node ≥ 26 strips the `.ts` types natively).
- `node --test test/special.test.ts` — Runs only the named rule suite; pass several file paths for related rules.
- **Dev server**: Do **not** start one unless asked. Probe `http://localhost:5173` first; if none is running (worktree/checkout), pass `--serve` to `shot-matrix.mjs` for a throwaway `vite --port 0`.

Choose verification by the behavior affected, not just the filename (`game.ts` contains both isolated effects and shared settlement). Never run check, test, build and shots as a default completion checklist.

| Change | Verification |
| --- | --- |
| Docs, comments, wording only | No rules tests or build. |
| UI, styles, animation, models | No rules tests; use `check` for TypeScript changes and targeted inspection/shots when the visual change needs them. |
| One tile rule or effect | Its test file, plus suites for affected interactions. |
| News effect | `test/news.test.ts`, plus affected tile suites. |
| Shared payments, rent, movement, bankruptcy, turns, rule data/reducer, or test harness | Full rules suite (`npm test`). |
| Tests only | Changed test files. |
| Build config, dependencies, deployment preparation | Build when relevant; rules tests only if their execution or game behavior is affected. |

- Run `check` for production TypeScript changes; a build already includes it, so do not run both for the same revision.
- After verification passes, rerun only if relevant code changes, a failure, or a new concern warrants it. Report what ran and any relevant limitation.

## Testing

- Scope: game rules and tile effects only — buying/upgrading, rent, passing vs landing, abilities and their interactions, legal player choices, deposits, bankruptcy, turns and final ranking. Each test must describe a player-visible rule or a concrete rule regression.
- Never add or expand tests outside this scope unless the user explicitly requests that scope expansion; general requests to implement, fix, refactor, verify, or improve coverage don't authorize it. This covers new test files, assertions added to existing tests, and test-like checks in scripts/CI (renaming them diagnostics doesn't exempt them). Don't add out-of-scope tests as precautionary regressions or incidental cleanup. Continue under the verification policy above.
- Do not add tests for UI/copy, rendering/shaders, model budgets, logs, simple reducer assignments, dev-panel commands, or transport/storage internals. Recovery scenarios belong here only when they verify a specific game consequence (e.g. bankruptcy persists or a payment occurs once).
- Keep coverage restrained: a representative normal case and meaningful boundaries/interactions. No coverage targets, exhaustive combinations, snapshots of whole state/event logs, or duplicate coverage of the same rule at every implementation layer.
- **Rules/effects changes are test-first:** before editing business code, add or update the focused rule test with the intended outcome, then run it and confirm it fails for the expected behavioral reason (not setup/import errors). Only then change the implementation and rerun the affected suites above. Bug fixes first reproduce the rule regression. Behavior-preserving refactors use existing tests; do not invent a failing test just to satisfy the workflow.
- Tests live in `test/` as `*.test.ts`; `test/harness.ts` is the shared setup, not a test. Never put tests in `src/` — and never `import` a test from there.
- Each test file opens with a comment block stating the rules it verifies. Rule/feature descriptions belong there, not in `src/` comments (which stay *why*-comments).
- `test/harness.ts` (each helper is commented there) bundles `src/worker` + `src/shared` with esbuild and exposes:
  - `start(n, { dev, settings, rig })` — boots a game and waits for the first ask; default rig makes turn order = seat order. `h.pending` is the open ask, `h.evs` the event log.
  - Setup via events: `give` / `seize`, `setCash`, `putAt`, `setDep`, `setFlag`; readers `cash` / `cur`.
  - Driving via the roll question's dev commands: `draw`, `idle`, `goto` (lands a tile as the whole turn), `roll(dice)` (walks for real, pass effects apply); prompts via `answer`, `asked`, `playUntil` with `benign` / `idler` answerers.
- Drive games deterministically through these — never stub `Math.random` or `Date.now`. Assert on rule outcomes (`cash`, `ownedByTile`, flags, `tile`) and relevant gameplay events, not on copy, log/toast text, or replay/transport details. Expected outcomes must come from the rule, not recompute the implementation under test.

## Scene Automation & Visual Testing

Never click through Lobby UI, monkey-patch `Date.now`, `import('/src/...')` from console (loads duplicate HMR modules), or hand-write CDP capture scripts. Use URL flags, `window.__aw` (`src/client/dev.ts`), or `shot-matrix.mjs`.

- **URL flags** (`/?dev=1&...`): `dev=1` (DEV panel; drops stale non-dev lobbies), `autostart=1` / `bots=1..3` / `fresh=1` (fresh bot game straight to HUD), `hd=1|0`, `hour=0..24` (`0` midnight, `6.2` sunrise, `12` noon, `18` dusk), `speed=N`, `paused=1`, `tile=0..91`, `x=N`, `z=N`, `lift=N`, `zoom=fit|N`, `elev=deg`, `az=deg`, `rot=0|1` (instant camera jump), `clean=1` (hide chrome, keep DEV), `ui=0` (hide `#root`), `scenario=<name>` (boot into a named HUD scene).
- **Window size**: the UI has one layout, for a wide window (`width ≥ 348px + 110vh` and `height ≥ 760px`); any other window is covered by the `#narrow` mask (`Narrow` in `ui/hud.tsx`, `style.css`). Drive or shoot the HUD at a size that clears it — HUD shots (`--autostart`, `--scene`, a `scene`/`ui` list entry) default to `1600x900`, while the bare matrix default `960x540` only shows the mask; `clean=1` and `ui=0` hide the mask too.

- **`window.__aw` runtime bridge**:
```js
await window.__aw.ready; // fonts, lighting, optional autostart settled
window.__aw.state(); // { view, look, hour, zoom, lod, target, elev, az, gamePaused, ... }
await window.__aw.setView({ hd: true, hour: 0, tile: 1, zoom: 2.2, elev: 52, az: 0, ui: false });
await window.__aw.strike(6, 28, 4.9); // launch & freeze missile; also step(dt), scrub(t), setLoop({ paused, scale })
await window.__aw.setLot(28, { owner: 0, level: 3 }); // preview lot without a room (`{ owner: -1, sign: false }` hides SALE); also rebuild(i), isolate(i | null)
await window.__aw.quickGame(3); window.__aw.pause(true); // dev room; pause(true) freezes server question clocks
await window.__aw.cmd({ c: 'goto', player: 0, tile: 1, resolveLanding: true }, { wait: 30000 }); // runs on ROLL DICE ({ wait } waits for it to open)
await window.__aw.idle(); window.__aw.ui(); // event-driven HUD/card waits & state (no fixed sleeps)
await window.__aw.click('SKIP'); // data-id, text/prefix, or selector on top modal/screen; also until(pred, ms)
window.__aw.diag(); // where the page stands: view, me/turn, waiting, action, top card, pauses, visibility, viewport, narrow, ws
await window.__aw.scenario('buy'); // named HUD scene (window.__aw.scenarios lists all): fresh dev room played to a resting card/state, then frozen
```
- A failed `until`/`idle`/`click`/`cmd` ends with one error carrying that `diag()` (e.g. `waiting Bot Azure, gamePaused:true`) — no follow-up console queries.
- Named scenes (`src/client/scenarios.ts`): `buy` · `news` · `mortgage` · `casino` · `spectate`. `?scenario=<name>` boots into one, `__aw.scenario(name)` runs one anytime; each ends with the room's question clocks paused (`pause`, not `setLoop`), so the card stays.

- **Batch visual sheets (`scripts/shot-matrix.mjs`)** — `--tile(s)`, `--iso`, and `--lots` accept tile indices, names, or kind slugs; read output PNGs directly to inspect visuals. The server is checked against `/__aw-id` (the checkout it serves): a probed or `--url` server of another worktree — or an older build without the endpoint — is refused (restart it, or `--serve`); `--vs` baselines serve their own tree, so old commits without the endpoint still compare. HUD shots (`--autostart`, `--scene`, or a `scene`/`ui` list entry) default to `1600x900`. A failed run writes `fail.json` (+ `fail.png`) beside the output: phase, error, server identity, the page's `diag()`:
```bash
node scripts/shot-matrix.mjs --tile=28 --iso=1 --nosign=1 --az=-35,0,35,145 --zooms=0.6,2.4 --hours=12 # isolated turntable + LOD
node scripts/shot-matrix.mjs --tile="Las Vegas" --lx=-0.3 --ly=1.5 --lz=0.45 --zoom=3 --crop=420x340 --scale=2 # lot-space close-up (--lot=1 for origin; or --tx/--tz/--lift)
node scripts/shot-matrix.mjs --tile=13 --lv=3 --m=1 --lots=14:1:2,15:-1:0:0:0 --time=0,1 --q=vol=1 # neighbour context, clock poses, extra URL query
node scripts/shot-matrix.mjs --out=/tmp/aw-shots/hk --list=shots.json # named PNGs + sheet.png + run.json (--out=x.png for sheet only)
node scripts/shot-matrix.mjs --scene=mortgage --out=/tmp/aw-shots/mort # one named HUD scene (or a "scene" key on a --list shot)
node scripts/shot-matrix.mjs --looks=pixel --hours=0,12,18 --vs --expect=same # BEFORE | AFTER | DIFF vs HEAD (or --vs=ref / --cmp=dir); check table first, open CHANGED shots
```

## Style & Conventions

- Keep code compact and direct; match local naming/helpers and `strict` / `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax`.
- **Naming**:
  - Name fields, state cells, constants, and module/class variables so their role, domain type, and unit are clear without a decoder comment (`bankruptRound`, `principal`/`termRounds`/`placedRound`, `remainingMs`/`totalMs`, `dropSeatAt`, `idleDissolveAt`, `pongTimeout`, `activeAutoCard` — never `out`, `amt`/`n`/`made`, `ms`/`of`, `drop`, `idle`, `dead`, `shown` explained by `//`). When renaming an opaque identifier, delete the comment that only explained its name.
  - Keep distinct index spaces unambiguous on shared, wire, and stored shapes: lobby seat (`seat`, `mySeat`) vs in-game player (`player`, `playerIndex`, `myPlayer`) vs turn cursor (`turnIndex` into `turnOrder`) vs board tile (`tile`). Never overload `me`, `turn`, `p`, or `i` across them.
  - Encode units on durations/counts (`*Ms`, `*Rounds`) and `*At` on epoch-ms deadlines (`pausedAt`, `deadlineAt`, `expiresAt`). Numeric sentinels where `0` means "none/active" must name the stored quantity (`bankruptRound`), never read like a boolean (`out`).
  - Tagged-union discriminants (`t`, `k`, `c`) and short local loop/math bindings (`x`, `y`, `i`, `dt`) may stay terse; exported/interface fields, wire/event/command payloads, class properties, and module state use full domain words.
- Trailing `//` comments take a single natural space — never pad spaces to align columns or rewrap untouched lines.
- Preserve explanatory (*why*) comments (invariants, replay/hibernation/wire subtleties); never add or keep *what*-comments that restate an identifier, and do not overwrite user-tuned constants or style parameters unasked.
- Git commits: concise single-line imperative subjects matching `git log --oneline`, without extra trailers unless requested.
