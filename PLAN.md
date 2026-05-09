# Pi notebook package

## Status

- [x] Repo is a real Pi package with a notebook extension entrypoint.
- [x] Notebook tooling exists end-to-end: summary, cell reads, cell edits, structural ops, output/attachment reads.
- [x] Tests cover core logic, tool runners, and multi-step workflows.
- [ ] Verify against real notebooks through Pi, not just tests + local runner.

## Constraints / decisions

- Keep `index.ts` as the Pi adapter seam.
- Keep `tools.ts` as the runner/test seam. Do not merge it into `index.ts`.
- Queueing and path normalization are adapter concerns, not notebook-core concerns.
- Prefer one small internal mutation helper over a broader `NotebookSession` / fs adapter.
- `PLAN.md` is the main actionable plan. `IMPROVEMENTS-PLAN.md` remains as a more detailed improvement note.

## Why these priorities

- Main correctness risk: Pi can run sibling tool calls in parallel; unqueued notebook mutations can lose writes.
- Main locality issue: mutation runners repeat load → select → ensure ids → mutate → save → format confirmation.
- `tools.ts` vs `index.ts` is not the real problem. The existing split is useful because tests and the smoke runner call runners directly without booting Pi.

## Current priorities

### P0. Pi package / doc compliance

- [x] Add `@mariozechner/pi-ai: "*"` to `peerDependencies`.
  - note: `tools.ts` imports `@mariozechner/pi-ai` for `StringEnum`; Pi package docs want bundled Pi core imports declared as peers.
  - verify: `bun run check`
- [x] Normalize notebook path args at the adapter seam.
  - [x] strip one leading `@` (models sometimes include it — see pi docs extensions.md line 1670)
  - [x] resolve relative paths against `ctx.cwd`
  - [x] pass normalized absolute paths into runners / queueing
  - preferred shape: normalize once in `index.ts` `execute(..., ctx)` before calling runners
  - verify: focused tool/adapter test if practical, else local smoke + `bun run check`

### P1. Correctness under concurrent mutations

- [x] Wrap full read-modify-write windows in `withFileMutationQueue()` for:
  - [x] `notebook_write_cell`
  - [x] `notebook_edit_cell`
  - [x] `notebook_insert`
  - [x] `notebook_delete`
  - [x] `notebook_move`
  - [x] `notebook_merge`
  - [x] `notebook_clear_outputs`
- [x] Keep read-only tools unqueued.
- [x] Queue at the adapter seam, not in notebook-core.
  - preferred shape: `withFileMutationQueue(normalizedPath, () => runNotebookX({ ...params, path: normalizedPath }))`
- [x] Verification: `bun test` + `bun run check`.
  - concurrency regression test not added in this pass

### P2. Mutation orchestration cleanup

- [x] Introduce one internal helper for load → ensure ids → mutate → save.
  - target shape:
    ```ts
    async function mutateNotebook(path, mutate) {
      const notebook = await loadNotebook(path)
      const assigned = ensureCellIds(notebook)
      const result = mutate(notebook)
      await saveNotebook(path, notebook)
      return { assigned, result }
    }
    ```
- [x] Move repeated mutation runner boilerplate onto that helper.
- [x] Keep tool-specific selector validation / confirmation formatting in each runner.
- [x] Do not add a broader filesystem abstraction unless tests are actually blocked by disk I/O.
- [x] Verify existing mutation/workflow tests still pass unchanged.

### P3. Public interface trim

- [x] Remove `readCellsById` export unless an actual near-term tool needs it.
- [x] Remove `readCellRange` export unless an actual near-term tool needs it.
- [x] Update tests to cover supported read primitives instead:
  - [x] `readAllCells`
  - [x] `readCellById`
  - [x] index reads through tool runners
- [x] Verify: `bun test`

## Non-goals for this pass

- [x] Do not merge `tools.ts` into `index.ts`.
- [x] Do not build a full `NotebookSession` / filesystem adapter now.
- [x] Do not split formatting into a separate presentation module yet.
- [x] Do not normalize outputs into a new module yet.
- [x] Do not touch the `scripts/run-notebook-tool.ts` cast unless already nearby.

## Suggested execution order

- [x] 1. Package/doc compliance: peer dep, path normalization.
- [x] 2. Queue all mutation tools with `withFileMutationQueue()`.
- [x] 3. Consolidate mutation load/id/save helper.
- [x] 4. Remove dead read exports if still unused.
- [x] 5. Re-run `bun test` and `bun run check` after each meaningful step.

## Existing work, mostly done

### Tooling

- [x] Add Biome config + package scripts.
- [x] Add `typecheck`; make `check` run typecheck + Biome.
- [x] Install `bun-types` and wire TS to use it directly.
- [x] Tighten TS config; fix resulting type issues.
- [x] Migrate Biome config and clear current lint warnings.
- [ ] Refresh lockfile / verify CLI once Bun tempdir issue is gone.

### Package scaffold

- [x] Turn repo root into a Pi package.
- [x] Add extension entry under `extensions/notebook/`.
- [x] Set up minimal `bun test` checks.

### Read-only notebook support

- [x] Implement notebook parse/summary/read core.
- [x] Implement `notebook_summary`.
- [x] Implement `notebook_read_cell`.

### Mutation support

- [x] Implement load/save mutation path.
- [x] Implement `notebook_write_cell`.
- [x] Implement `notebook_edit_cell`.
- [x] Define / implement cell id normalization helpers.

### Structural notebook operations

- [x] Implement `notebook_insert`.
- [x] Implement `notebook_delete`.
- [x] Implement `notebook_move`.
- [x] Implement `notebook_merge`.
- [x] Implement `notebook_clear_outputs`.
- [x] Implement `notebook_read_cell_output`.
- [x] Implement `notebook_read_cell_attachment`.
- [x] Simplify reads to single-cell `notebook_read_cell` with optional line slicing.

### Verification

- [x] Add tests for parse/read/write/edit operations.
- [x] Add real `.ipynb` fixture coverage.
- [x] Add tests for remaining mutation operations.
- [x] Split tests by layer/tool/workflow.
- [x] Keep `bun test` green after TS/Biome tightening.
- [ ] Verify current tools on real notebooks through Pi / local runner.
