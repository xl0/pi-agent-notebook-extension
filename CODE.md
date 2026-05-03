# Pi notebook package

Goal: Pi package exposing notebook-focused tools for safe `.ipynb` inspection and editing.

## Current state

- Repo root is now the Pi package.
- `package.json` declares a Pi package via `pi.extensions: ["./extensions"]`.
- Main extension entry: `extensions/notebook/index.ts`.
- Pure notebook logic lives in `extensions/notebook/notebook.ts`.
- Shared tool runners + schemas live in `extensions/notebook/tools.ts`.
- Implemented tools:
  - `notebook_summary({ path })`
  - `notebook_read({ path, cellId?, cellIds?, startIndex?, endIndex? })`
  - `notebook_write({ path, cellId?|index?, source })`
  - `notebook_edit({ path, cellId?|index?, edits })`
  - `notebook_insert({ path, cellId?|index?, direction, type, source })`
  - `notebook_delete({ path, cellId?|index? })`
  - `notebook_move({ path, cellId?|index?, targetCellId?|targetIndex?, direction })`
  - `notebook_merge({ path, cellId?|index?, direction })`
  - `notebook_clear_outputs({ path, cellId?|index? })`
- Current notebook support:
  - parse notebook JSON directly; require `nbformat === 4`
  - summarize kernel/language/cells via one `meta` line plus sparse per-cell key=value rows
  - summary/read omit `id` when the notebook cell has no stored id
  - code rows include `n_exec` only when execution count is present
  - summary preview is first 120 source chars with escaped backslashes/newlines and `...` when truncated
  - read all cells, one cell by id, multiple ids, or an inclusive index range
  - mutation tools accept id selectors for notebooks that already have ids, and index selectors for notebooks that do not
  - first mutation on a no-id notebook assigns short random 8-hex ids to all cells, bumps `nbformat_minor` to `5` when needed, and appends a concise index→id mapping to tool output
  - read output uses XML-ish headers plus raw source blocks, not JSON-escaped source
  - write/edit preserve other cell fields like metadata/outputs and return concise confirmation text
  - insert one code/markdown/raw cell before or after an anchor cell id or index; `index=-1` appends
  - move one cell before or after another cell by id or index
  - merge one cell with the adjacent same-type cell `above` or `below`, preserving the anchor id and inserting one boundary newline when needed
  - clear outputs from one code cell while preserving source and execution count
  - save path rewrites notebook JSON in Jupyter-style formatting: source as `string[]`, 1-space JSON indentation, trailing newline
- Tests split by layer:
  - `test/notebook-core.test.ts` covers parse/validation, pure cell ops, formatting helpers, id assignment, load/save roundtrips, save formatting, and fixture-level core behavior
  - `test/notebook-*.tool.test.ts` keeps one file per tool for runner/output/selector behavior
  - `test/notebook-*.workflow.test.ts` keeps one file per multi-step workflow (write→read parity, no-id mutation flow, real-fixture edit/save)
- Local tool smoke runner: `bun run tool -- <tool-name> '<json-args>'` prints raw tool text output without launching Pi.
- Biome config lives in `biome.json`.
  - schema migrated to match installed CLI `2.4.14`
  - formatter enabled with `lineWidth: 140`, LF endings, tabs, no trailing commas, semicolons `asNeeded`, arrow parens `asNeeded`
  - linter enabled with recommended rules
  - excludes `.ipynb`, `node_modules`, `.git`, and `bun.lock`
  - package scripts: `typecheck`, `check`, `lint`, `format`, `format:check`, `biome:check`
- Type-checking now uses the installed `bun-types` package via `tsconfig.json` `types: ["bun-types"]`.
- `tsconfig.json` is stricter now: `lib: ["ES2022"]`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, plus casing/interop/json-module checks.

## Decisions

- Package form: root-level Pi package, not only project-local `.pi/extensions`.
- Keep notebook operations in pure functions, extension glue thin.
- Start with small tool slices: read-only first, then mutation tools.
- No extra runtime deps for notebook parsing; use built-in JSON handling.

## Gaps

- Pi/manual verification is still light; most verification so far is tests plus local `bun run tool` smoke runs on real fixtures.
- `check` now runs type-checking plus Biome (`bun run typecheck && bun run biome:check`).
- `bun-types` is now installed and type-checking uses it directly.
- Notebook parse/summary/mutation code now satisfies stricter TS + current Biome without non-null assertions.
- Validation errors from Pi surface raw schema-validator messages instead of friendly allowed-value hints.
- Save/mutation path still normalizes notebook JSON shape/format on write, even though it now aims to match common Jupyter formatting.
- Mutation tools on no-id notebooks now rely on index selectors until ids are persisted; read-only id-based addressing is intentionally unavailable in that state.
- Real notebook fixtures live in `test/fixtures/`.
