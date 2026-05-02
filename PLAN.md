# Pi notebook package

## Decisions

- Package form: root-level Pi package, not only project-local `.pi/extensions`.
- Scope: edit existing `.ipynb` files only. No notebook execution. No custom TUI/UI.
- Discovery: no notebook listing tool. Use normal file tools / shell for finding notebooks.
- Backend: TypeScript, parse notebook JSON directly.
  - no `@jupyterlab/nbformat` dependency; just local minimal types/helpers for the subset we support
  - keep notebook operations in pure functions, extension glue thin
- Format support:
  - support only `nbformat === 4`
  - expose synthetic ids for missing-id cells as `generated-<index>`
  - persist missing cell ids on first mutation
  - when needed, bump notebook minor to support cell ids (`4.5` semantics)
  - no support for older major notebook versions
- Cell addressing:
  - default to `cellId`
  - allow index-based addressing where it helps insertion/placement
  - one-cell-at-a-time for write/edit/insert/delete/move/merge/clear_outputs
  - `notebook_insert` supports exactly one anchor selector: `cellId` or `index`
- Output policy:
  - preserve outputs by default
  - outputs only changed by explicit clear tool
  - write should confirm success concisely, not echo source back
  - edit should confirm success concisely, not echo source back
- Metadata:
  - separate metadata tool later if needed; not folded into source write
- Read policy:
  - concise summary tool
  - summary output should show both `index` and `cellId`
  - summary output should prefer sparse key=value rows over dense CSV
  - summary preview should show escaped source snippets compactly, truncated with `...` when needed
  - summary/read formatting must preserve literal notebook backslashes in source; summary previews should escape them explicitly
  - read output should use XML-ish metadata headers plus raw source blocks
  - read supports full notebook, one `cellId`, multiple `cellIds`, or an inclusive `startIndex`/`endIndex` range
- Move/insert/merge semantics:
  - move: absolute final index placement
  - insert: anchor by `cellId` or `index`, plus `direction: before|after`
  - merge: one anchor cell plus `direction: up|down`, keep the anchor id, require same cell type, and insert one boundary newline when needed
- Images/attachments: ignore for now
- Testing:
  - test notebook logic as pure TS functions with `bun test`
  - prefer a small set of real `.ipynb` fixtures for file-level behavior
  - keep a lightweight local tool runner for fast raw-output checks without launching Pi
  - keep Pi integration thin, validate extension wiring separately via Pi/manual integration checks

## Plan

- [x] Establish the repo as a real Pi package with a notebook extension entrypoint.
- [~] Build notebook tooling in thin vertical slices: read-only first, then cell mutation tools.
- [ ] Finish structural notebook operations and selectors.
- [ ] Verify against real notebooks through Pi.

## Todo

- [x] Package scaffold
  - [x] Turn repo root into a Pi package
  - [x] Add extension entry under `extensions/notebook/`
  - [x] Set up minimal `bun test` checks
- [x] Read-only notebook support
  - [x] Implement notebook parse/summary/read core
  - [x] Implement `notebook_summary`
  - [x] Implement `notebook_read`
- [~] Cell source mutation support
  - [x] Implement load/save mutation path
  - [x] Implement `notebook_write`
  - [x] Implement `notebook_edit`
  - [x] Define/implement cell id normalization helpers
- [x] Structural notebook operations
  - [x] Implement `notebook_insert`
  - [x] Implement `notebook_delete`
  - [x] Implement `notebook_move`
  - [x] Implement `notebook_merge`
  - [x] Implement `notebook_clear_outputs`
  - [x] Expand `notebook_read` to multi/range selectors
- [~] Verification
  - [x] Add tests for existing parse/read/write/edit operations
  - [x] Add real `.ipynb` fixture coverage for current behavior
  - [x] Add tests for remaining mutation operations
  - [~] Verify current tools on real notebooks through Pi / local runner
