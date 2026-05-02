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
  - `notebook_read({ path, cellId? })`
  - `notebook_write({ path, cellId, source })`
  - `notebook_edit({ path, cellId, edits })`
- Current notebook support:
  - parse notebook JSON directly
  - require `nbformat === 4`
  - summarize kernel/language/cells
  - human-facing summary output uses one `meta` line plus sparse per-cell key=value rows with both index and cell id
  - code rows include `n_exec` only when execution count is present
  - summary preview is first 120 source chars with escaped backslashes/newlines and `...` when truncated
  - read all cells or one cell by id
  - read output uses XML-ish headers plus raw source blocks, not JSON-escaped source
  - replace full source of one cell
  - write returns concise confirmation text; use read to verify exact source
  - apply exact, unique, non-overlapping source edits within one cell
  - edit returns concise edit-style confirmation text; use read to verify exact source
  - preserve other cell fields like outputs on source writes/edits
- Tests: `test/notebook.test.ts` now covers parse/validation, summary/read/write/edit behavior, write-read source parity, failure modes, load/save roundtrips, tool-output formatting, and real `.ipynb` fixture coverage.
- Local tool smoke runner: `bun run tool -- <tool-name> '<json-args>'` prints raw tool text output without launching Pi.

## Decisions

- Package form: root-level Pi package, not only project-local `.pi/extensions`.
- Keep notebook operations in pure functions, extension glue thin.
- Start with small tool slices: read-only first, then mutation tools.
- No extra runtime deps for notebook parsing; use built-in JSON handling.

## Gaps

- No insert/delete/move/merge/clear_outputs yet.
- No cell id normalization/generation yet.
- `notebook_read` only supports `cellId` or full-read, not ranges/multi-select yet.
- Pi/manual verification done lightly for `notebook_summary`, `notebook_read`, and `notebook_edit` via `pi -p -e ./extensions/notebook/index.ts` on real fixtures.
- Current verified limitation: notebooks without cell ids can be summarized/read but not written/edited by cell id yet.
- Real notebook fixtures now live in `test/fixtures/`.
