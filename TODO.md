# Pi notebook extension

Goal: Pi extension for editing `.ipynb` notebooks via custom tools. No UI. Focus on safe structural/cell-level edits, concise reads, preserving notebook validity and outputs.

## Decisions

- Extension form: project-local Pi extension dir, likely `.pi/extensions/notebook/` with `index.ts` and helper modules as needed.
- Scope: edit existing `.ipynb` files only. No notebook execution. No custom TUI/UI.
- Discovery: no notebook listing tool. Use normal file tools / shell for finding notebooks.
- Backend: TypeScript, parse notebook JSON directly.
  - no `@jupyterlab/nbformat` dependency; just local minimal types/helpers for the subset we support
  - we own load/validate/normalize/save logic
- Format support:
  - support only `nbformat === 4`
  - normalize to cell ids on write
  - when needed, bump notebook minor to support cell ids (`4.5` semantics)
  - no support for older major notebook versions
- Cell addressing:
  - default to `cellId`
  - allow index-based addressing where it helps insertion/placement
  - one-cell-at-a-time for write/edit/insert/delete/move/merge/clear_outputs
- Output policy:
  - preserve outputs by default
  - outputs only changed by explicit clear tool
- Metadata:
  - separate metadata tool later if needed; not folded into source write
- Read policy:
  - concise summary tool
  - read tool can read one `cellId`, multiple `cellIds`, or a range
- Move/insert/merge semantics:
  - move: absolute placement
  - insert: anchor by `cellId` or `index`, plus `direction: before|after`
  - merge: one anchor cell plus `direction: up|down` only
- Images/attachments: ignore for now
- Testing:
  - no special Pi extension test harness
  - test notebook logic as pure TS functions with `bun test`
  - keep Pi integration thin, validate extension wiring separately via Pi/manual integration checks
  - local dev `package.json` in the extension dir is fine even if this is not a distributed package

## Planned tools

- `notebook_summary({ path })`
- `notebook_read({ path, cellId? , cellIds? , start? , end? })`
- `notebook_write({ path, cellId, source })`
- `notebook_edit({ path, cellId, edits })`
- `notebook_insert({ path, cellId? , index? , direction, cellType, source })`
- `notebook_delete({ path, cellId })`
- `notebook_move({ path, cellId, beforeCellId? , beforeIndex? })`
- `notebook_merge({ path, cellId, direction })`
- `notebook_clear_outputs({ path, cellId? , all? })`
- later maybe: `notebook_update_metadata({ path, cellId, metadata })`

## Notes on behavior

- `notebook_edit` should mirror Pi `edit`: exact source replacements within one cell, fail on missing/ambiguous matches.
- `notebook_summary` should be the default discovery/read tool:
  - notebook path, nbformat/minor
  - kernel/language if present
  - cell count
  - per-cell concise preview: index, id, type, preview, source line count, execution count/output count for code, maybe tags
- `notebook_read` should return source-centric content, not full raw notebook JSON.

## Todo

- [ ] Create `.pi/extensions/notebook/`
  - [ ] add local `package.json` for dev deps/tests
- [ ] Create/refresh `CODE.md` once implementation starts
- [ ] Define TS schemas for all MVP tools
  - [ ] enforce mutually exclusive selector shapes for `notebook_read`
  - [ ] define exact insert/move anchor semantics
  - [ ] define exact clear-outputs selector semantics
- [ ] Set up tests
  - [ ] choose minimal local test setup with `bun test`
  - [ ] keep notebook operations in pure functions, separate from Pi glue
  - [ ] add unit tests for parse/normalize/select/edit/insert/delete/move/merge/clear_outputs/summary
  - [ ] plan thin manual/integration checks through Pi runtime
- [ ] Define local notebook types/helpers
  - [ ] minimal notebook/cell/output types for supported operations
  - [ ] multiline source normalization helpers
  - [ ] cell id generation helper
- [ ] Implement notebook load/parse/save helpers
  - [ ] parse JSON
  - [ ] validate top-level notebook shape
  - [ ] validate cell shape enough for supported ops
  - [ ] preserve unknown fields/metadata/outputs
  - [ ] deterministic write formatting
- [ ] Implement normalization
  - [ ] reject non-v4 notebooks
  - [ ] ensure all cells have ids on write
  - [ ] bump minor as needed for cell-id semantics
  - [ ] ensure generated ids are unique
- [ ] Implement tools
  - [ ] `notebook_summary`
  - [ ] `notebook_read`
  - [ ] `notebook_write`
  - [ ] `notebook_edit`
  - [ ] `notebook_insert`
  - [ ] `notebook_delete`
  - [ ] `notebook_move`
  - [ ] `notebook_merge`
  - [ ] `notebook_clear_outputs`
- [ ] Verify behavior on real notebooks / through Pi
  - [ ] missing ids notebook
  - [ ] code + markdown notebook
  - [ ] output preservation after source edits
  - [ ] malformed notebook failure path
  - [ ] empty notebook insertion case
