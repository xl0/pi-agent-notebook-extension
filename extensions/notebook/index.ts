import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { loadNotebook, readAllCells, readCellById, summarizeNotebook } from "./notebook";

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
}
