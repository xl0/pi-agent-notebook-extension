import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { editCellSource, loadNotebook, readAllCells, readCellById, saveNotebook, summarizeNotebook, writeCellSource } from "./notebook";

export default function notebookExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "notebook_summary",
    label: "Notebook Summary",
    description: "Summarize a Jupyter notebook by cell.",
    promptSnippet: "Inspect an .ipynb notebook structure without dumping raw JSON.",
    promptGuidelines: ["Use notebook_summary first when inspecting notebook structure or finding cell ids."],
    parameters: Type.Object({
      path: Type.String({ description: "Path to an .ipynb notebook." }),
    }),
    async execute(_toolCallId, params) {
      const notebook = await loadNotebook(params.path);
      const summary = summarizeNotebook(params.path, notebook);
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        details: summary,
      };
    },
  });

  pi.registerTool({
    name: "notebook_read",
    label: "Notebook Read",
    description: "Read notebook cell source by id or all cells.",
    promptSnippet: "Read source-centric notebook cell content.",
    promptGuidelines: ["Use notebook_read after notebook_summary when source from one or more notebook cells is needed."],
    parameters: Type.Object({
      path: Type.String({ description: "Path to an .ipynb notebook." }),
      cellId: Type.Optional(Type.String({ description: "Cell id to read. Omit to read all cells." })),
    }),
    async execute(_toolCallId, params) {
      const notebook = await loadNotebook(params.path);
      const result = params.cellId ? readCellById(notebook, params.cellId) : readAllCells(notebook);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "notebook_write",
    label: "Notebook Write",
    description: "Replace one notebook cell source.",
    promptSnippet: "Replace the full source of a single notebook cell.",
    promptGuidelines: ["Use notebook_write when the full source of one notebook cell should be replaced."],
    parameters: Type.Object({
      path: Type.String({ description: "Path to an .ipynb notebook." }),
      cellId: Type.String({ description: "Cell id to replace." }),
      source: Type.String({ description: "New full cell source." }),
    }),
    async execute(_toolCallId, params) {
      const notebook = writeCellSource(await loadNotebook(params.path), params.cellId, params.source);
      await saveNotebook(params.path, notebook);
      const result = readCellById(notebook, params.cellId);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "notebook_edit",
    label: "Notebook Edit",
    description: "Apply exact source replacements within one notebook cell.",
    promptSnippet: "Edit part of one notebook cell source using exact old/new text replacements.",
    promptGuidelines: ["Use notebook_edit for surgical edits inside one notebook cell; replacements must match exactly and uniquely."],
    parameters: Type.Object({
      path: Type.String({ description: "Path to an .ipynb notebook." }),
      cellId: Type.String({ description: "Cell id to edit." }),
      edits: Type.Array(
        Type.Object({
          oldText: Type.String({ description: "Exact text to replace." }),
          newText: Type.String({ description: "Replacement text." }),
        }),
        { minItems: 1 },
      ),
    }),
    async execute(_toolCallId, params) {
      const notebook = editCellSource(await loadNotebook(params.path), params.cellId, params.edits);
      await saveNotebook(params.path, notebook);
      const result = readCellById(notebook, params.cellId);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });
}
