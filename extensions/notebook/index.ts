import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  notebookClearOutputsParams,
  notebookDeleteParams,
  notebookEditParams,
  notebookInsertParams,
  notebookMergeParams,
  notebookMoveParams,
  notebookReadParams,
  notebookSummaryParams,
  notebookWriteParams,
  runNotebookClearOutputs,
  runNotebookDelete,
  runNotebookEdit,
  runNotebookInsert,
  runNotebookMerge,
  runNotebookMove,
  runNotebookRead,
  runNotebookSummary,
  runNotebookWrite,
} from "./tools";

export default function notebookExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "notebook_summary",
    label: "Notebook Summary",
    description: "Summarize a Jupyter notebook by cell.",
    promptSnippet: "Inspect an .ipynb notebook structure without dumping raw JSON.",
    promptGuidelines: ["Use notebook_summary first when inspecting notebook structure or finding cell ids."],
    parameters: notebookSummaryParams,
    async execute(_toolCallId, params) {
      return runNotebookSummary(params);
    },
  });

  pi.registerTool({
    name: "notebook_read",
    label: "Notebook Read",
    description: "Read notebook cell source by id or all cells.",
    promptSnippet: "Read source-centric notebook cell content.",
    promptGuidelines: ["Use notebook_read after notebook_summary when source from one or more notebook cells is needed."],
    parameters: notebookReadParams,
    async execute(_toolCallId, params) {
      return runNotebookRead(params);
    },
  });

  pi.registerTool({
    name: "notebook_write",
    label: "Notebook Write",
    description: "Replace one notebook cell source by id or index.",
    promptSnippet: "Replace the full source of a single notebook cell.",
    promptGuidelines: ["Use notebook_write when the full source of one notebook cell should be replaced. Use index when a notebook has no cell ids yet."],
    parameters: notebookWriteParams,
    async execute(_toolCallId, params) {
      return runNotebookWrite(params);
    },
  });

  pi.registerTool({
    name: "notebook_edit",
    label: "Notebook Edit",
    description: "Apply exact source replacements within one notebook cell by id or index.",
    promptSnippet: "Edit part of one notebook cell source using exact old/new text replacements.",
    promptGuidelines: ["Use notebook_edit for surgical edits inside one notebook cell; replacements must match exactly and uniquely. Use index when a notebook has no cell ids yet."],
    parameters: notebookEditParams,
    async execute(_toolCallId, params) {
      return runNotebookEdit(params);
    },
  });

  pi.registerTool({
    name: "notebook_insert",
    label: "Notebook Insert",
    description: "Insert one notebook cell before or after an anchor cell.",
    promptSnippet: "Insert a new code, markdown, or raw notebook cell near an existing anchor.",
    promptGuidelines: ["Use notebook_insert to add one new cell before or after a specific cell id or index. Use index -1 to append."],
    parameters: notebookInsertParams,
    async execute(_toolCallId, params) {
      return runNotebookInsert(params);
    },
  });

  pi.registerTool({
    name: "notebook_delete",
    label: "Notebook Delete",
    description: "Delete one notebook cell by id or index.",
    promptSnippet: "Delete a single notebook cell by id or index.",
    promptGuidelines: ["Use notebook_delete to remove one notebook cell after confirming the target id or index with notebook_summary or notebook_read."],
    parameters: notebookDeleteParams,
    async execute(_toolCallId, params) {
      return runNotebookDelete(params);
    },
  });

  pi.registerTool({
    name: "notebook_move",
    label: "Notebook Move",
    description: "Move one notebook cell before or after another cell.",
    promptSnippet: "Move a notebook cell relative to another cell by id or index.",
    promptGuidelines: ["Use notebook_move when one existing cell should be repositioned before or after another cell. Use index/targetIndex when a notebook has no cell ids yet."],
    parameters: notebookMoveParams,
    async execute(_toolCallId, params) {
      return runNotebookMove(params);
    },
  });

  pi.registerTool({
    name: "notebook_merge",
    label: "Notebook Merge",
    description: "Merge one notebook cell with the adjacent cell above or below.",
    promptSnippet: "Merge an anchor notebook cell with its adjacent neighbor of the same type.",
    promptGuidelines: ["Use notebook_merge to combine adjacent same-type cells; the anchor cell id is preserved. Use index when a notebook has no cell ids yet."],
    parameters: notebookMergeParams,
    async execute(_toolCallId, params) {
      return runNotebookMerge(params);
    },
  });

  pi.registerTool({
    name: "notebook_clear_outputs",
    label: "Notebook Clear Outputs",
    description: "Clear outputs from one code cell by id or index.",
    promptSnippet: "Remove outputs from a single code cell while preserving source and execution count.",
    promptGuidelines: ["Use notebook_clear_outputs when code cell outputs should be removed without touching source. Use index when a notebook has no cell ids yet."],
    parameters: notebookClearOutputsParams,
    async execute(_toolCallId, params) {
      return runNotebookClearOutputs(params);
    },
  });
}
