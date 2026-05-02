# Pi notebook package

Goal: Pi package exposing notebook-focused tools for safe `.ipynb` inspection and editing.

## Current state

- Repo root is now the Pi package.
- `package.json` declares a Pi package via `pi.extensions: ["./extensions"]`.
- Main extension entry: `extensions/notebook/index.ts`.
- Pure notebook logic lives in `extensions/notebook/notebook.ts`.
- Implemented tools:
  - `notebook_summary({ path })`
  - `notebook_read({ path, cellId? })`
  - `notebook_write({ path, cellId, source })`
  - `notebook_edit({ path, cellId, edits })`
- Current notebook support:
  - parse notebook JSON directly
  - require `nbformat === 4`
  - summarize kernel/language/cells
  - read all cells or one cell by id
  - replace full source of one cell
  - apply exact, unique, non-overlapping source edits within one cell
  - preserve other cell fields like outputs on source writes/edits
- Tests: `test/notebook.test.ts` now covers parse/validation, summary/read behavior, write/edit behavior, failure modes, load/save roundtrips, and real `.ipynb` fixture coverage.

## Decisions

- Package form: root-level Pi package, not only project-local `.pi/extensions`.
- Keep notebook operations in pure functions, extension glue thin.
- Start with small tool slices: read-only first, then mutation tools.
- No extra runtime deps for notebook parsing; use built-in JSON handling.

## Gaps

- No insert/delete/move/merge/clear_outputs yet.
- No cell id normalization/generation yet.
- `notebook_read` only supports `cellId` or full-read, not ranges/multi-select yet.
- No real Pi runtime/manual verification yet.
- Real notebook fixtures now live in `test/fixtures/`.
