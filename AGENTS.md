# AGENTS.md — Null Calc

## Project root

All commands assume this directory. This is a fork of `syl-rnb-calc` (itself a fork of smogon/damage-calc via dekzeh/calc), customized for the **Pokémon Null** ROM hack with trainer battle lookup, AI move prediction, and range visualization.

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
npm install          # installs root + calc/ deps
node build           # full build: compiles calc/ (TS→JS) + copies src/ to dist/
node build view      # UI-only build (skip calc/ recompilation)
npm run compile      # compile calc/ TS + build view
npm run lint         # lint calc/ TS + src/ JS
npm test             # calc/ Jest tests + full build + lint
```

## Architecture

### calc/ library (`calc/src/`)
- Entry: `calc/src/index.ts` — exports `calculate()`, `Pokemon`, `Move`, `Field`, `Result`, `Generations`, data tables
- Damage logic: `calc/src/calc.ts`
- Gen-specific mechanics: `calc/src/mechanics/gen12.ts` through `gen789.ts`
- Data (moves, species, abilities, etc.): `calc/src/data/`
- AI move prediction: `calc/src/ai.ts` (custom logic for Null's AI)

### src/ UI (`src/js/`)
- **No module system** — globals loaded via `<script>` tags in `.template.html`
- Key files: `shared_controls.js` (trainer battle UI, HP memory, state), `honkalculate_controls.js` (main calc), `moveset_import.js` (set import), `range_compare.js`
- `src/js/data/sets/gen9.js` — **Null's trainer sets** (`SETDEX_SV`). Generated from `scripts/data/Trainer Battles.txt`
- `src/js/data/sets/gen8.js` — legacy (unused for trainer lookup)
- Templates: `src/*.template.html` → `dist/*.html` with cache-busting

### Trainer data pipeline
- Raw trainer data: `scripts/data/Trainer Battles.txt` (format: `MonName Lv.XX @Item: Move1, Move2, ...  [Nature|Ability]`)
- Generate sets JS: `python3 scripts/generateSets.py` → produces `src/js/data/sets/gen9.js`
- No EVs in Null data (defaults to 0). All IVs are 31.

### Server
- `node server.js` — Express on port 3000
- IP-restricted access: `ALLOWED_IPS` env var

## Style conventions

| File type | Indent | Quotes | Notes |
|-----------|--------|--------|-------|
| `.js`, `.html` | tabs (width 3) | — | ES5, no `const`/`let`, no destructuring |
| `.ts`, `.json`, `.yml` | spaces (2) | — | TS compiles to ES3 |
| `.md` | spaces (4) | — | |

## This fork's custom features

- **Per-slot HP memory** (player + opponent) — two toggle checkboxes (`#slotHpMemory` / `#slotHpMemoryOpp`). Player HP memory is party-only. Implementation in `shared_controls.js`.
- **AI move prediction** (`calc/src/ai.ts`) — move scoring based on Pokémon Null's AI behavior. See `Pokémon Null AI.txt` for the full documentation.
  - Post-KO Switch AI and Mid-Turn Switch AI are **not yet implemented** (documentation exists in `Pokémon Null AI.txt` but needs to be coded).
- **Range compare / visualizer** (`src/js/range_compare.js`) — crit rate display, health distribution chart.
- **Dark theme toggle**
- **HP inputs** — all `type="number"` with `min="0"` / `step="1"` / `max="100"` constraints.
- **GitHub Pages** — deploy workflow in `.github/workflows/pages.yml`, triggered on push to `per-slot-hp`.
