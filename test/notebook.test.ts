import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FIXTURE_DIR = join(import.meta.dir, "fixtures");
import {
  applyExactSourceEdits,
  deleteCell,
  editCellSource,
  ensureCellIds,
  formatNotebookRead,
  insertCell,
  mergeCell,
  moveCell,
  formatNotebookSummary,
  loadNotebook,
  normalizeSource,
  parseNotebook,
  readAllCells,
  readCellById,
  saveNotebook,
  summarizeNotebook,
  writeCellSource,
} from "../extensions/notebook/notebook";
import { runNotebookDelete, runNotebookEdit, runNotebookInsert, runNotebookMerge, runNotebookMove, runNotebookRead, runNotebookWrite } from "../extensions/notebook/tools";

async function copyFixture(name: string) {
  const dir = await mkdtemp(join(tmpdir(), "notebook-test-"));
  const path = join(dir, name);
  await Bun.write(path, await readFile(join(FIXTURE_DIR, name)));
  return {
    dir,
    path,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

function createNotebookText() {
  return JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: "python3" },
      language_info: { name: "python" },
      custom: { keep: true },
    },
    cells: [
      {
        cell_type: "markdown",
        id: "intro",
        source: ["# Title\n", "More text\n"],
        metadata: { tags: ["lead"] },
      },
      {
        cell_type: "code",
        id: "code-1",
        source: "print(1)\nprint(2)\n",
        execution_count: 7,
        outputs: [{ output_type: "stream" }],
        metadata: { trusted: true },
      },
    ],
  });
}

describe("notebook core", () => {
  test("parse + summary", () => {
    const notebook = parseNotebook(createNotebookText());
    const summary = summarizeNotebook("demo.ipynb", notebook);

    expect(summary.cellCount).toBe(2);
    expect(summary.kernelName).toBe("python3");
    expect(summary.language).toBe("python");
    expect(summary.cells[0]).toEqual({
      index: 0,
      id: "intro",
      type: "markdown",
      sourceLines: 3,
      preview: "# Title\\nMore text\\n",
      executionCount: undefined,
      outputCount: undefined,
    });
    expect(summary.cells[1]?.outputCount).toBe(1);
  });

  test("read cells", () => {
    const notebook = parseNotebook(createNotebookText());
    expect(readAllCells(notebook)).toHaveLength(2);
    expect(readCellById(notebook, "code-1").source).toBe("print(1)\nprint(2)\n");
  });

  test("normalizes string array source", () => {
    expect(normalizeSource(["a", "b"])).toBe("ab");
  });

  test("rejects non-v4 notebooks", () => {
    expect(() => parseNotebook(JSON.stringify({ nbformat: 3, cells: [] }))).toThrow(
      "Only nbformat 4 notebooks are supported",
    );
  });

  test("writeCellSource replaces full source", () => {
    const notebook = parseNotebook(createNotebookText());
    writeCellSource(notebook, "code-1", "print(42)\n");
    expect(readCellById(notebook, "code-1").source).toBe("print(42)\n");
    expect(notebook.cells[1]?.outputs).toEqual([{ output_type: "stream" }]);
  });

  test("applyExactSourceEdits applies non-overlapping exact edits", () => {
    expect(
      applyExactSourceEdits("alpha beta gamma", [
        { oldText: "alpha", newText: "one" },
        { oldText: "gamma", newText: "three" },
      ]),
    ).toBe("one beta three");
  });

  test("applyExactSourceEdits rejects ambiguous matches", () => {
    expect(() => applyExactSourceEdits("x x", [{ oldText: "x", newText: "y" }])).toThrow(
      'Edit text is ambiguous: "x"',
    );
  });

  test("applyExactSourceEdits rejects missing matches", () => {
    expect(() => applyExactSourceEdits("abc", [{ oldText: "z", newText: "y" }])).toThrow(
      'Edit text not found: "z"',
    );
  });

  test("applyExactSourceEdits rejects overlapping ranges", () => {
    expect(() =>
      applyExactSourceEdits("abcdef", [
        { oldText: "abc", newText: "x" },
        { oldText: "bcd", newText: "y" },
      ])).toThrow("Edit ranges overlap");
  });

  test("readCellById fails on missing id", () => {
    const notebook = parseNotebook(createNotebookText());
    expect(() => readCellById(notebook, "missing")).toThrow("Cell not found: missing");
  });

  test("writeCellSource preserves metadata and fails on missing id", () => {
    const notebook = parseNotebook(createNotebookText());
    writeCellSource(notebook, "code-1", "print(42)\n");
    expect(notebook.cells[1]?.metadata).toEqual({ trusted: true });
    expect(() => writeCellSource(notebook, "missing", "x")).toThrow("Cell not found: missing");
  });

  test("editCellSource updates one cell in place and preserves outputs", () => {
    const notebook = parseNotebook(createNotebookText());
    editCellSource(notebook, "code-1", [{ oldText: "print(1)", newText: "print(10)" }]);
    expect(readCellById(notebook, "code-1").source).toBe("print(10)\nprint(2)\n");
    expect(notebook.cells[1]?.outputs).toEqual([{ output_type: "stream" }]);
  });

  test("insertCell inserts a code cell after an anchor and initializes code fields", () => {
    const notebook = parseNotebook(createNotebookText());
    const inserted = insertCell(notebook, { cellId: "intro", direction: "after" }, { type: "code", source: "print(3)\n" });
    expect(inserted.index).toBe(1);
    expect(inserted.type).toBe("code");
    expect(inserted.source).toBe("print(3)\n");
    expect(inserted.id).toBeTruthy();
    expect(notebook.cells[1]?.execution_count).toBeNull();
    expect(notebook.cells[1]?.outputs).toEqual([]);
  });

  test("insertCell inserts by index and rejects invalid selectors", () => {
    const notebook = parseNotebook(createNotebookText());
    const inserted = insertCell(notebook, { index: 1, direction: "before" }, { type: "markdown", source: "note\n" });
    expect(inserted.index).toBe(1);
    expect(readAllCells(notebook)[1]?.source).toBe("note\n");
    expect(() => insertCell(notebook, { cellId: "intro", index: 0, direction: "after" }, { type: "raw", source: "x" })).toThrow(
      "Provide exactly one of cellId or index",
    );
    expect(() => insertCell(notebook, { index: 99, direction: "after" }, { type: "raw", source: "x" })).toThrow(
      "Cell index out of range: 99",
    );
  });

  test("deleteCell removes one cell and returns its prior read view", () => {
    const notebook = parseNotebook(createNotebookText());
    const deleted = deleteCell(notebook, "code-1");
    expect(deleted.id).toBe("code-1");
    expect(deleted.source).toBe("print(1)\nprint(2)\n");
    expect(notebook.cells).toHaveLength(1);
    expect(() => readCellById(notebook, "code-1")).toThrow("Cell not found: code-1");
  });

  test("moveCell reorders one cell to an absolute index", () => {
    const notebook = parseNotebook(createNotebookText());
    const moved = moveCell(notebook, "code-1", 0);
    expect(moved.index).toBe(0);
    expect(moved.id).toBe("code-1");
    expect(readAllCells(notebook).map((cell) => cell.id)).toEqual(["code-1", "intro"]);
    expect(() => moveCell(notebook, "code-1", 99)).toThrow("Cell index out of range: 99");
  });

  test("mergeCell merges adjacent same-type cells and preserves the anchor id", () => {
    const notebook = parseNotebook(JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        { cell_type: "markdown", id: "a", source: "one" },
        { cell_type: "markdown", id: "b", source: "two\n" },
      ],
    }));
    const result = mergeCell(notebook, "a", "down");
    expect(result.merged.id).toBe("a");
    expect(result.removed.id).toBe("b");
    expect(result.merged.source).toBe("one\ntwo\n");
    expect(notebook.cells).toHaveLength(1);
  });

  test("mergeCell rejects missing neighbors and mixed cell types", () => {
    const notebook = parseNotebook(createNotebookText());
    expect(() => mergeCell(notebook, "intro", "up")).toThrow("No cell to merge up from intro");
    expect(() => mergeCell(notebook, "intro", "down")).toThrow("Cannot merge markdown cell with code cell");
  });

  test("formatNotebookSummary uses sparse key value rows", () => {
    const summary = summarizeNotebook("demo.ipynb", parseNotebook(createNotebookText()));
    const formatted = formatNotebookSummary(summary);
    expect(formatted).toContain("meta nbformat=4.5 kernel=python3 cells=2 language=python");
    expect(formatted).toContain('0 id=intro type=md lines=3 preview="# Title\\nMore text\\n"');
    expect(formatted).toContain('1 id=code-1 type=code lines=3 n_exec=7 outputs=1 preview="print(1)\\nprint(2)\\n"');
  });

  test("summary omits null execution counts from formatted rows", async () => {
    const notebook = await loadNotebook(join(FIXTURE_DIR, "lovely-history.ipynb"));
    const formatted = formatNotebookSummary(summarizeNotebook("lovely-history.ipynb", notebook));
    expect(formatted).toContain("1 id=57d6942b type=code lines=3 outputs=0");
    expect(formatted).not.toContain("exec=null");
    expect(formatted).not.toContain("n_exec=null");
  });

  test("markdown preview escapes literal trailing backslashes and newlines", async () => {
    const notebook = await loadNotebook(join(FIXTURE_DIR, "lovely-history.ipynb"));
    const summary = summarizeNotebook("lovely-history.ipynb", notebook);
    const preview = summary.cells[7]?.preview ?? "";
    const start = preview.indexOf("deleted it.");
    expect(preview.slice(start, start + 15)).toBe("deleted it.\\\\\\n");
  });

  test("summary preview truncates long source with ellipsis", () => {
    const notebook = parseNotebook(JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: "markdown", id: "a", source: "x".repeat(130) }],
    }));
    expect(summarizeNotebook("long.ipynb", notebook).cells[0]?.preview).toBe(`${"x".repeat(120)}...`);
  });

  test("summary handles missing metadata and missing source", () => {
    const notebook = parseNotebook(
      JSON.stringify({
        nbformat: 4,
        nbformat_minor: 2,
        cells: [{ cell_type: "markdown", id: "a" }],
      }),
    );
    expect(summarizeNotebook("empty.ipynb", notebook)).toEqual({
      path: "empty.ipynb",
      nbformat: 4,
      nbformatMinor: 2,
      kernelName: null,
      language: null,
      cellCount: 1,
      cells: [
        {
          index: 0,
          id: "a",
          type: "markdown",
          sourceLines: 0,
          preview: "",
          executionCount: undefined,
          outputCount: undefined,
        },
      ],
    });
  });

  test("saveNotebook writes deterministic json with trailing newline", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-test-"));
    const path = join(dir, "demo.ipynb");

    try {
      const notebook = parseNotebook(createNotebookText());
      await saveNotebook(path, notebook);
      const written = await readFile(path, "utf8");
      expect(written.endsWith("\n")).toBe(true);
      expect(JSON.parse(written)).toEqual(notebook);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("loadNotebook roundtrips saved notebook", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-test-"));
    const path = join(dir, "demo.ipynb");

    try {
      const notebook = parseNotebook(createNotebookText());
      await saveNotebook(path, notebook);
      expect(await loadNotebook(path)).toEqual(notebook);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("loads real fixture with cell ids and mixed cell types", async () => {
    const notebook = await loadNotebook(join(FIXTURE_DIR, "lovely-history.ipynb"));
    const summary = summarizeNotebook("lovely-history.ipynb", notebook);

    expect(summary.nbformatMinor).toBe(5);
    expect(summary.cellCount).toBe(12);
    expect(summary.kernelName).toBe("python3");
    expect(summary.language).toBe(null);
    expect(summary.cells[0]?.type).toBe("markdown");
    expect(summary.cells[1]?.type).toBe("code");
    expect(summary.cells[1]?.id).toBeTruthy();
    expect(summary.cells.some((cell) => cell.outputCount === 1)).toBe(true);
  });

  test("formatNotebookRead emits notebook header and raw cell blocks", async () => {
    const notebook = await loadNotebook(join(FIXTURE_DIR, "lovely-history.ipynb"));
    const formatted = formatNotebookRead("lovely-history.ipynb", readAllCells(notebook));
    expect(formatted).toContain('<notebook path="lovely-history.ipynb" cells="12" />');
    expect(formatted).toContain('<cell index="4" id="95cca932" type="code" lines="3" />');
    expect(formatted).toContain('t = torch.tensor(10, device="cuda")');
    expect(formatted).toContain('deleted it.\\\nI did not use Lovely Tensors');
  });

  test("runNotebookRead returns raw single-cell source block", async () => {
    const result = await runNotebookRead({ path: join(FIXTURE_DIR, "lovely-history.ipynb"), cellId: "95cca932" });
    expect(result.content[0]?.text).toContain('<cell index="4" id="95cca932" type="code" lines="3" />');
    expect(result.content[0]?.text).toContain('# |eval: false\nt = torch.tensor(10, device="cuda")\nt');
  });

  test("runNotebookRead returns notebook wrapper for full read", async () => {
    const result = await runNotebookRead({ path: join(FIXTURE_DIR, "lovely-test-no-ids.ipynb") });
    expect(result.content[0]?.text).toContain('<notebook path=');
    expect(result.content[0]?.text).toContain('<cell index="0" id="generated-0" type="code" lines="1" n_exec="1" />');
    expect(result.content[0]?.text).toContain('# %matplotlib inline');
  });

  test("runNotebookRead fails on missing cell id", async () => {
    await expect(runNotebookRead({ path: join(FIXTURE_DIR, "lovely-history.ipynb"), cellId: "missing" })).rejects.toThrow(
      "Cell not found: missing",
    );
  });

  test("runNotebookWrite returns concise confirmation", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const result = await runNotebookWrite({ path: fixture.path, cellId: "95cca932", source: "x\n" });
      expect(result.content[0]?.text).toBe(`Wrote cell 95cca932 in ${fixture.path}.`);
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookWrite followed by runNotebookRead preserves exact code source", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const source = '# |eval: false\nt = torch.tensor(42, device="cuda")\nt\n';
      await runNotebookWrite({ path: fixture.path, cellId: "95cca932", source });
      const result = await runNotebookRead({ path: fixture.path, cellId: "95cca932" });
      expect(result.content[0]?.text).toBe(`<cell index="4" id="95cca932" type="code" lines="4" />\n${source}`);
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookWrite followed by runNotebookRead preserves exact markdown source", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const source = "line 1\\\nline 2\n\n> quote\n";
      await runNotebookWrite({ path: fixture.path, cellId: "9fd3e324", source });
      const result = await runNotebookRead({ path: fixture.path, cellId: "9fd3e324" });
      expect(result.content[0]?.text).toBe(`<cell index="7" id="9fd3e324" type="md" lines="5" />\n${source}`);
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookWrite fails on missing cell id", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      await expect(runNotebookWrite({ path: fixture.path, cellId: "missing", source: "x" })).rejects.toThrow(
        "Cell not found: missing",
      );
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookInsert returns concise confirmation and inserts readable cell", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const result = await runNotebookInsert({
        path: fixture.path,
        cellId: "95cca932",
        direction: "after",
        type: "markdown",
        source: "Inserted note\n",
      });
      const inserted = result.details as { id: string };
      expect(result.content[0]?.text).toBe(`Inserted cell ${inserted.id} after 95cca932 in ${fixture.path}.`);

      const readResult = await runNotebookRead({ path: fixture.path, cellId: inserted.id });
      expect(readResult.content[0]?.text).toBe(`<cell index="5" id="${inserted.id}" type="md" lines="2" />\nInserted note\n`);
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookInsert works by index on notebooks without ids", async () => {
    const fixture = await copyFixture("lovely-test-no-ids.ipynb");

    try {
      const result = await runNotebookInsert({
        path: fixture.path,
        index: 0,
        direction: "after",
        type: "code",
        source: "print(123)\n",
      });
      const inserted = result.details as { id: string };
      expect(result.content[0]?.text).toBe(`Inserted cell ${inserted.id} after index 0 in ${fixture.path}.`);
      expect(readCellById(await loadNotebook(fixture.path), inserted.id).source).toBe("print(123)\n");
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookInsert fails on ambiguous selector", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      await expect(runNotebookInsert({
        path: fixture.path,
        cellId: "95cca932",
        index: 4,
        direction: "after",
        type: "markdown",
        source: "x",
      })).rejects.toThrow("Provide exactly one of cellId or index");
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookDelete returns concise confirmation and removes the cell", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const result = await runNotebookDelete({ path: fixture.path, cellId: "95cca932" });
      expect(result.content[0]?.text).toBe(`Deleted cell 95cca932 from ${fixture.path}.`);
      await expect(runNotebookRead({ path: fixture.path, cellId: "95cca932" })).rejects.toThrow("Cell not found: 95cca932");
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookDelete works on synthetic ids", async () => {
    const fixture = await copyFixture("lovely-test-no-ids.ipynb");

    try {
      const result = await runNotebookDelete({ path: fixture.path, cellId: "generated-0" });
      expect(result.content[0]?.text).toBe(`Deleted cell generated-0 from ${fixture.path}.`);
      const remaining = await runNotebookRead({ path: fixture.path });
      expect(remaining.content[0]?.text).toContain('cells="1"');
      expect(remaining.content[0]?.text).toContain('id="generated-1"');
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookDelete fails on missing cell id", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      await expect(runNotebookDelete({ path: fixture.path, cellId: "missing" })).rejects.toThrow("Cell not found: missing");
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookMove returns concise confirmation and reorders cells", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const result = await runNotebookMove({ path: fixture.path, cellId: "95cca932", index: 1 });
      expect(result.content[0]?.text).toBe(`Moved cell 95cca932 to index 1 in ${fixture.path}.`);
      const summary = await runNotebookRead({ path: fixture.path });
      expect(summary.content[0]?.text).toContain('<cell index="1" id="95cca932" type="code" lines="3" />');
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookMove works on synthetic ids", async () => {
    const fixture = await copyFixture("lovely-test-no-ids.ipynb");

    try {
      const result = await runNotebookMove({ path: fixture.path, cellId: "generated-1", index: 0 });
      expect(result.content[0]?.text).toBe(`Moved cell generated-1 to index 0 in ${fixture.path}.`);
      const readResult = await runNotebookRead({ path: fixture.path });
      expect(readResult.content[0]?.text).toContain('<cell index="0" id="generated-1" type="code" lines="17" n_exec="2" />');
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookMove fails on invalid index", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      await expect(runNotebookMove({ path: fixture.path, cellId: "95cca932", index: 99 })).rejects.toThrow("Cell index out of range: 99");
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookMerge returns concise confirmation and merged source", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const result = await runNotebookMerge({ path: fixture.path, cellId: "ffd208cf", direction: "down" });
      expect(result.content[0]?.text).toBe(`Merged cell 95cca932 into ffd208cf in ${fixture.path}.`);
      const readResult = await runNotebookRead({ path: fixture.path, cellId: "ffd208cf" });
      expect(readResult.content[0]?.text).toContain('torch.cuda.memory_allocated()\n# |eval: false');
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookMerge works on synthetic ids", async () => {
    const fixture = await copyFixture("lovely-test-no-ids.ipynb");

    try {
      const result = await runNotebookMerge({ path: fixture.path, cellId: "generated-0", direction: "down" });
      expect(result.content[0]?.text).toBe(`Merged cell generated-1 into generated-0 in ${fixture.path}.`);
      const readResult = await runNotebookRead({ path: fixture.path, cellId: "generated-0" });
      expect(readResult.content[0]?.text).toContain('# %matplotlib inline\n#!/usr/bin/env python3');
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookMerge fails at notebook boundaries", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      await expect(runNotebookMerge({ path: fixture.path, cellId: "20735603", direction: "up" })).rejects.toThrow(
        "No cell to merge up from 20735603",
      );
    } finally {
      await fixture.cleanup();
    }
  });

  test("reads and edits a real fixture cell while preserving outputs", async () => {
    const fixture = await copyFixture("lovely-history.ipynb");

    try {
      const notebook = await loadNotebook(fixture.path);
      const target = readCellById(notebook, "95cca932");
      expect(target.source).toContain('t = torch.tensor(10, device="cuda")');

      editCellSource(notebook, "95cca932", [{ oldText: 'tensor(10, device="cuda")', newText: 'tensor(11, device="cuda")' }]);
      await saveNotebook(fixture.path, notebook);

      const updated = await loadNotebook(fixture.path);
      expect(readCellById(updated, "95cca932").source).toContain('tensor(11, device="cuda")');
      expect(updated.cells[4]?.outputs).toEqual(notebook.cells[4]?.outputs);
    } finally {
      await fixture.cleanup();
    }
  });

  test("ensureCellIds assigns synthetic ids and bumps minor version", async () => {
    const notebook = await loadNotebook(join(FIXTURE_DIR, "lovely-test-no-ids.ipynb"));
    ensureCellIds(notebook);

    expect(notebook.nbformat_minor).toBe(5);
    expect(notebook.cells[0]?.id).toBe("generated-0");
    expect(notebook.cells[1]?.id).toBe("generated-1");
  });

  test("real fixture without ids exposes synthetic ids for summary and read", async () => {
    const notebook = await loadNotebook(join(FIXTURE_DIR, "lovely-test-no-ids.ipynb"));
    const summary = summarizeNotebook("lovely-test-no-ids.ipynb", notebook);

    expect(summary.nbformatMinor).toBe(2);
    expect(summary.cellCount).toBe(2);
    expect(summary.cells.map((cell) => cell.id)).toEqual(["generated-0", "generated-1"]);
    expect(readAllCells(notebook).map((cell) => cell.id)).toEqual(["generated-0", "generated-1"]);
    expect(readCellById(notebook, "generated-0").source).toBe("# %matplotlib inline");
    expect(() => readCellById(notebook, "missing")).toThrow("Cell not found: missing");
  });

  test("runNotebookWrite persists synthetic ids and writes by generated id", async () => {
    const fixture = await copyFixture("lovely-test-no-ids.ipynb");

    try {
      await runNotebookWrite({ path: fixture.path, cellId: "generated-0", source: "# %matplotlib widget\n" });
      const saved = await loadNotebook(fixture.path);
      expect(saved.nbformat_minor).toBe(5);
      expect(saved.cells[0]?.id).toBe("generated-0");
      expect(saved.cells[1]?.id).toBe("generated-1");

      const result = await runNotebookRead({ path: fixture.path, cellId: "generated-0" });
      expect(result.content[0]?.text).toBe('<cell index="0" id="generated-0" type="code" lines="2" n_exec="1" />\n# %matplotlib widget\n');
    } finally {
      await fixture.cleanup();
    }
  });

  test("runNotebookEdit works by generated id on notebooks without ids", async () => {
    const fixture = await copyFixture("lovely-test-no-ids.ipynb");

    try {
      const result = await runNotebookEdit({
        path: fixture.path,
        cellId: "generated-1",
        edits: [{ oldText: "import numpy as np", newText: "import numpy as numpy" }],
      });
      expect(result.content[0]?.text).toBe(`Successfully replaced 1 block(s) in cell generated-1 of ${fixture.path}.`);
      expect(readCellById(await loadNotebook(fixture.path), "generated-1").source).toContain("import numpy as numpy");
    } finally {
      await fixture.cleanup();
    }
  });

  test("parseNotebook validates root and cells", () => {
    expect(() => parseNotebook("[]")).toThrow("Notebook root must be an object");
    expect(() => parseNotebook(JSON.stringify({ nbformat: 4, nbformat_minor: 5, cells: {} }))).toThrow(
      "Notebook cells must be an array",
    );
    expect(() => parseNotebook(JSON.stringify({ nbformat: 4, nbformat_minor: 5, cells: [null] }))).toThrow(
      "Cell 0 must be an object",
    );
    expect(() => parseNotebook(JSON.stringify({ nbformat: 4, nbformat_minor: 5, cells: [{}] }))).toThrow(
      "Cell 0 is missing cell_type",
    );
  });
});
