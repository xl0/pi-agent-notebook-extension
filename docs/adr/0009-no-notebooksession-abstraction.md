# No NotebookSession abstraction; simple mutation helper instead

A full `NotebookSession` class with filesystem adapters (for testability via in-memory FS) was considered and rejected. There is only one real adapter (disk), and existing tests already cover disk behavior through tempdir fixtures. Instead, mutation orchestration uses a simple `mutateNotebook()` helper that encapsulates the load → ensureIds → mutate → save pattern. A session abstraction may be revisited if id-assignment/save semantics keep leaking, or if a second filesystem backend emerges.
