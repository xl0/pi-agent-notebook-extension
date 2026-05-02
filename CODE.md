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
- Current notebook support:
  - parse notebook JSON directly
  - require `nbformat === 4`
  - summarize kernel/language/cells
  - read all cells or one cell by id
- Tests: `test/notebook.test.ts` covers parse/summary/read basics.

## Decisions

- Package form: root-level Pi package, not only project-local `.pi/extensions`.
- Keep notebook operations in pure functions, extension glue thin.
- Start with read-only tools first, then add mutation tools.
- No extra runtime deps for notebook parsing; use built-in JSON handling.

## Gaps

- No write/edit/insert/delete/move/merge/clear_outputs yet.
- No cell id normalization/generation yet.
- `notebook_read` only supports `cellId` or full-read, not ranges/multi-select yet.
- No real Pi runtime/manual verification yet.
