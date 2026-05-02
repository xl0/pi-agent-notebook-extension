import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyExactSourceEdits,
  editCellSource,
  loadNotebook,
  normalizeSource,
  parseNotebook,
  readAllCells,
  readCellById,
  saveNotebook,
  summarizeNotebook,
  writeCellSource,
} from "../extensions/notebook/notebook";

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
      preview: "# Title More text",
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
