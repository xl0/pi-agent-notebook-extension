# Dual cellId + index selectors

Cell tools accept either a `cellId` or an `index` selector, never both. `cellId` provides stable addressing across insertions and deletions — the LLM can hold onto an id it saw in a summary. `index` works on older notebooks that lack stored cell ids, and is the natural selector for positional operations (move/insert relative to another cell). Ids are not auto-assigned on read — that would mutate the file, violating the principle that reads are side-effect-free. Instead, ids are assigned on the first write mutation.
