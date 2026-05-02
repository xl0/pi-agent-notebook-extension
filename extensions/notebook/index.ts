import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  notebookEditParams,
  notebookInsertParams,
  notebookReadParams,
  notebookSummaryParams,
  notebookWriteParams,
  runNotebookEdit,
  runNotebookInsert,
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
    description: "Replace one notebook cell source.",
    promptSnippet: "Replace the full source of a single notebook cell.",
    promptGuidelines: ["Use notebook_write when the full source of one notebook cell should be replaced."],
    parameters: notebookWriteParams,
    async execute(_toolCallId, params) {
      return runNotebookWrite(params);
    },
  });

  pi.registerTool({
    name: "notebook_edit",
    label: "Notebook Edit",
    description: "Apply exact source replacements within one notebook cell.",
    promptSnippet: "Edit part of one notebook cell source using exact old/new text replacements.",
    promptGuidelines: ["Use notebook_edit for surgical edits inside one notebook cell; replacements must match exactly and uniquely."],
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
    promptGuidelines: ["Use notebook_insert to add one new cell before or after a specific cell id or index."],
    parameters: notebookInsertParams,
    async execute(_toolCallId, params) {
      return runNotebookInsert(params);
    },
  });
}
