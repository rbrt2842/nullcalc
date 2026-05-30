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
