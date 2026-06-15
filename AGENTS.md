# AGENTS.md — Syl R&B Calc

## Project root

All commands assume `syl-rnb-calc/` as working directory. This is a fork of smogon/damage-calc (via dekzeh/calc), customized for Pokémon Run and Bun with AI move prediction and range visualization.

## Multi-package structure (subpkg)

Three directories managed by `subpkg`:

| Dir | Language | Purpose |
|-----|----------|---------|
| `calc/` | TypeScript (ES3 target) | `@smogon/calc` damage calculation library |
| `src/` | Vanilla JS (ES5 target) | Browser UI (jQuery + DataTables, no modules) |
| `import/` | TypeScript | Data importer for Pokémon sets (not needed for dev) |

Root scripts delegate to subpackages via `subpkg`. Dependencies: root has a `file:calc` dep and postinstall runs `subpkg install`.

## Essential commands

```sh
# First time setup
npm install          # installs root + calc/ deps (postinstall runs subpkg install)
                     # import/ has separate deps, install only if updating sets

# Building
node build           # full build: compiles calc/ (TS→JS) + copies src/ to dist/ + cache-busts HTML
node build view      # UI-only build (skip calc/ recompilation): copies src/ to dist/

# Testing
npm run compile      # compile calc/ TS + build view (runs subpkg run compile && node build view)
npm run lint         # lint calc/ TS + src/ JS
npm test             # calc/ Jest tests + full build + lint

# Calc subpackage only
npm --prefix calc run test      # Jest (ts-jest)
npm --prefix calc run compile   # tsc only
npm --prefix calc run bundle    # Babel + terser production bundle
```

**Build order matters:** If you change anything in `calc/`, run `node build` (or `npm run compile`). If you change only HTML/JS/CSS in `src/`, `node build view` is enough and much faster.

## Architecture

### calc/ library (`calc/src/`)
- Entry: `calc/src/index.ts` — exports `calculate()`, `Pokemon`, `Move`, `Field`, `Result`, `Generations`, data tables
- Damage logic: `calc/src/calc.ts`
- Gen-specific mechanics: `calc/src/mechanics/gen12.ts` through `gen789.ts` (gaps are combined files: gen1+2, gen5+6, gen7+8+9)
- Data (moves, species, abilities, etc.): `calc/src/data/`
- Compiles to `calc/dist/` which gets copied to `dist/calc/`

### src/ UI (`src/js/`)
- **No module system** — everything is global, loaded via `<script>` tags in `.template.html`
- Loading order matters. See `calc/src/index.ts` comment for exact browser `<script>` ordering.
- Key files: `shared_controls.js` (2235 lines, shared state), `honkalculate_controls.js` (main calc page), `moveset_import.js` (set loading), `range_compare.js` (fork's range viz feature)
- `src/js/data/sets/` — **generated files**, do not edit manually. Updated via import/ pipeline.
- Templates: `src/*.template.html` are processed by `build` script → `dist/*.html` with cache-busting hashes

### Server
- `node server.js` — Express on port 3000
- IP-based access control: `ALLOWED_IPS=ip1,ip2` in `.env` restricts `dist/` to those IPs; others see `untrusted-site/`
- API: `GET /calculate` with JSON body for headless damage calc

## Style conventions

| File type | Indent | Quotes | Notes |
|-----------|--------|--------|-------|
| `.js`, `.html` | tabs (width 3) | — | ES5, no `const`/`let`, no destructuring (`no-restricted-syntax`) |
| `.ts`, `.json`, `.yml` | spaces (2) | — | TS compiles to ES3 |
| `.md` | spaces (4) | — | |

- ESLint config targets ES5 for `src/` (ecmaVersion: 5, sourceType: "script")
- `.ts` linted by calc's own eslint (extends `@pkmn/eslint-config`)
- Semicolons required, brace style 1tbs, `space-before-function-paren` = anonymous:always, named:never
- No trailing whitespace (except `.md`)

## Git workflow

- PRs target `dev` branch, CI runs on `master`
- CI simply runs `npm install && npm test` on Node 18

## Data update pipeline (infrequent)

When Pokémon usage stats change and `@smogon/sets` updates:
1. Clone `smogon/pokemon-showdown` as sibling directory
2. `cd import/ && ncu -u` to bump `@smogon/sets` version, then `npm install && npm run compile`
3. Run `./ps-import` then `./import` to regenerate `src/js/data/sets/` files
4. Full `node build`, verify in browser, commit

## This fork's custom features

- AI move prediction (configurable percentages via UI)
- Range compare/visualizer tool (`src/js/range_compare.js`)
- Dark theme toggle
- IP-restricted deployment (`ALLOWED_IPS` env var, `server.js`, `untrusted-site/`)
- Changelog popup (`src/js/data/changelog.js`)
- Per-species HP memory (player + opponent) — two toggle checkboxes in the credits, persisted via localStorage. Player saves/restores HP per species when switching party members. Opponent same mechanic but resets on trainer switch (Next/Previous/🚚). Implementation in `shared_controls.js` (`slotHPStorage`/`slotHPStorageOpp`, save/restore in `.set-selector` handler, `_trainerSwitch` guard, `data-set`/`data-prev` clear), `moveset_import.js` (clear on remove-all), and `index.template.html` (checkbox HTML). Loose notes moved to sibling `rnbcalc-notes/`.

## Post-KO Switch-in AI

Implemented — core logic in `calc/src/switchAi.ts`, UI in `src/js/switchin_ai.js`.

### Calc logic (`calc/src/switchAi.ts`)

Two exported functions:

- `getRollInfo(gen, attacker, defender, move, field)` → `number[]` — Computes damage rolls.
  Uses max damage roll for all moves except guaranteed crits (Wicked Blow, Surging
  Strikes, Frost Breath, Storm Throw, Merciless) which return the full roll array
  for random selection.

- `getSwitchInDist(gen, playerMon, playerMoves, benchMons, setIdentifiers,
  fieldForPlayer, fieldForOpponent)` → `[{setIdentifier, score, pct}]` — Scores
  each bench mon using the rubric below. Normalizes positive scores into switch-in
  probabilities (`pct`).

Exported from `calc/src/index.ts` as `calc.getSwitchInDist`.

Scoring rubric:

| Score | Condition |
|-------|-----------|
| +5 | AI faster and OHKOs |
| +4 | AI slower, OHKOs, not OHKO'd back |
| +3 | AI faster, deals more % than it takes |
| +2 | AI slower, takes more % than it deals; Ditto; Wynaut/Wobbuffet faster & OHKO'd |
| +1 | AI faster (default good) |
| 0 | Default |
| -1 | AI slower and OHKO'd |

### UI (`src/js/switchin_ai.js`)

`window.SwitchInAI` object with:

- `performSwitchInCalc()` — Reads opponent's bench from `CURRENT_TRAINER_POKS`,
  pulls stored HP from `slotHPStorageOpp`, creates `calc.Pokemon` objects via
  `createPokemon()`, calls `calc.getSwitchInDist()`, renders results.
- `renderSwitchInResults()` — Renders a table in the `#switchin-results` div with
  columns: Pokémon name, HP (from memory), score, switch-in %.

### Integration

- **Auto-trigger** in `index_randoms_controls.js` `performCalculations()` — when
  opponent current HP is 0 (fainted), auto-runs switch-in calc.
- **Manual** — "Recalc Switch-in" button in the panel.
- **Toggle** — Checkbox in credits (`#switchInAI`) shows/hides the panel.
- **Panel** added to `index.template.html` after Range Compare, as a `.switchin-ai`
  panel div.

### HP memory integration

The feature reads from `slotHPStorageOpp` (per-species HP memory for opponent).
Without it, bench mons are assumed at full HP, making OHKO checks and damage %
comparisons inaccurate. `slotHPStorageOpp` → `getSwitchInDist()` → UI display.

## Doubles support (future, low priority)

Run and Bun has mixed battle types: standard singles, doubles, tag battles (2v1),
and 3-mon battles. The calc engine already handles doubles mechanics (spread
damage reduction, screen modifiers, Helping Hand, Friend Guard, Battery, Power
Spot, Flower Gift, etc.) — the gaps are in the UI, AI, and trainer data.

### Trainer data annotation

Trainer sets are in `src/js/data/sets/gen8.js` (the `SETDEX_SS` object). Currently
there's no `battleType` field — doubles trainers are identified by a `"Double"`
suffix convention (e.g., `"Elite Four GlaciaDouble"`). Each trainer entry would
need a battle type flag:

```js
"battleType": "singles" | "doubles" | "tag" | "3mon"
```

Would be added to the species-level entries (e.g. one per trainer name) or
derived from a new lookup. When battle type is set, the Singles/Doubles format
toggle in the UI would auto-select instead of requiring manual toggle.

### Tag partner mini-panel

Instead of full second Pokemon panels (p3/p4), add a compact "Tag Partner"
dropdown under each team section (PKCalc-style). Shows a simplified Pokemon
selector with its own HP field and move controls. Visible when battle type
isn't `"singles"`. In 3-mon battles, bench is limited to 3 slots.

### Move targeting (doubles)

Each move row needs a target picker in doubles mode:
- Adjacent foe (single target)
- Opposite adjacent foe (other opponent)
- Ally
- Both adjacent foes (spread)

The calc engine already supports `move.target` types (`adjacentFoe`,
`allAdjacentFoes`, `adjacentAlly`, etc.) — just needs UI wiring to set the
right target on the Move object before calculation.

### HP memory (4-slot)

Expand from 2 slots (`slotHPStorage` / `slotHPStorageOpp`) to 4:
- `slotHPStorageP1` — Player's primary
- `slotHPStorageP2` — Player's partner
- `slotHPStorageO1` — Opponent's primary
- `slotHPStorageO2` — Opponent's partner

Values are keyed by full set name, same as current implementation.

### Doubles AI (`calc/src/ai.ts`)

Address ~10 existing TODO comments:
- Spread move bonuses for Icy Wind, Electroweb
- Helping Hand / Follow Me scoring
- Redirect mechanics
- Doubles-specific item/ability scoring
- Target selection weighting

### Doubles switch-in AI

When one active mon faints in a multi-mon format, score the replacement
considering both:
- The other active mon still on the field
- Bench mons available for the second slot
