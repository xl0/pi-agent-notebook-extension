# Pi notebook package

## Plan

- [ ] Finish notebook core mutation helpers.
- [ ] Add mutation tools incrementally.
- [ ] Verify behavior with tests after each tool family.
- [ ] Do a thin Pi runtime/manual check once core tools exist.

## Todo

- [x] Turn repo root into a Pi package
- [x] Add extension entry under `extensions/notebook/`
- [x] Set up minimal `bun test` checks
- [x] Implement notebook parse/summary/read core
- [x] Implement `notebook_summary`
- [x] Implement `notebook_read`
- [ ] Define/implement cell id normalization helpers
- [ ] Implement load/save mutation path
- [ ] Implement `notebook_write`
- [ ] Implement `notebook_edit`
- [ ] Implement `notebook_insert`
- [ ] Implement `notebook_delete`
- [ ] Implement `notebook_move`
- [ ] Implement `notebook_merge`
- [ ] Implement `notebook_clear_outputs`
- [ ] Expand `notebook_read` to multi/range selectors
- [ ] Add tests for all mutation operations
- [ ] Verify on real notebooks through Pi
