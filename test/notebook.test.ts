import { describe, expect, test } from "bun:test";
import { normalizeSource, parseNotebook, readAllCells, readCellById, summarizeNotebook } from "../extensions/notebook/notebook";

const notebookText = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    kernelspec: { name: "python3" },
    language_info: { name: "python" },
  },
  cells: [
    {
      cell_type: "markdown",
      id: "intro",
      source: ["# Title\n", "More text\n"],
    },
    {
      cell_type: "code",
      id: "code-1",
      source: "print(1)\nprint(2)\n",
      execution_count: 7,
      outputs: [{ output_type: "stream" }],
    },
  ],
});

describe("notebook core", () => {
  test("parse + summary", () => {
    const notebook = parseNotebook(notebookText);
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
    const notebook = parseNotebook(notebookText);
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
});
