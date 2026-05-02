import { Type, type Static } from "typebox";
import { editCellSource, formatNotebookRead, formatNotebookSummary, insertCell, loadNotebook, readAllCells, readCellById, saveNotebook, summarizeNotebook, writeCellSource } from "./notebook";

export const notebookSummaryParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
});

export const notebookReadParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.Optional(Type.String({ description: "Cell id to read. Omit to read all cells." })),
});

export const notebookWriteParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.String({ description: "Cell id to replace." }),
  source: Type.String({ description: "New full cell source." }),
});

export const notebookEditParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.String({ description: "Cell id to edit." }),
  edits: Type.Array(
    Type.Object({
      oldText: Type.String({ description: "Exact text to replace." }),
      newText: Type.String({ description: "Replacement text." }),
    }),
    { minItems: 1 },
  ),
});

export const notebookInsertParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.Optional(Type.String({ description: "Anchor cell id." })),
  index: Type.Optional(Type.Integer({ description: "Anchor cell index." })),
  direction: Type.Union([Type.Literal("before"), Type.Literal("after")], { description: "Insert before or after the anchor." }),
  type: Type.Union([Type.Literal("code"), Type.Literal("markdown"), Type.Literal("raw")], { description: "New cell type." }),
  source: Type.String({ description: "Source for the new cell." }),
});

export type NotebookSummaryParams = Static<typeof notebookSummaryParams>;
export type NotebookReadParams = Static<typeof notebookReadParams>;
export type NotebookWriteParams = Static<typeof notebookWriteParams>;
export type NotebookEditParams = Static<typeof notebookEditParams>;
export type NotebookInsertParams = Static<typeof notebookInsertParams>;

export interface NotebookToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
}

export async function runNotebookSummary(params: NotebookSummaryParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const summary = summarizeNotebook(params.path, notebook);
  return {
    content: [{ type: "text", text: formatNotebookSummary(summary) }],
    details: summary,
  };
}

export async function runNotebookRead(params: NotebookReadParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const result = params.cellId ? readCellById(notebook, params.cellId) : readAllCells(notebook);
  return {
    content: [{ type: "text", text: formatNotebookRead(params.path, result) }],
    details: result,
  };
}

export async function runNotebookWrite(params: NotebookWriteParams): Promise<NotebookToolResult> {
  const notebook = writeCellSource(await loadNotebook(params.path), params.cellId, params.source);
  await saveNotebook(params.path, notebook);
  const result = readCellById(notebook, params.cellId);
  return {
    content: [{ type: "text", text: `Wrote cell ${params.cellId} in ${params.path}.` }],
    details: result,
  };
}

export async function runNotebookEdit(params: NotebookEditParams): Promise<NotebookToolResult> {
  const notebook = editCellSource(await loadNotebook(params.path), params.cellId, params.edits);
  await saveNotebook(params.path, notebook);
  const result = readCellById(notebook, params.cellId);
  return {
    content: [{ type: "text", text: `Successfully replaced ${params.edits.length} block(s) in cell ${params.cellId} of ${params.path}.` }],
    details: result,
  };
}

export async function runNotebookInsert(params: NotebookInsertParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const result = insertCell(notebook, { cellId: params.cellId, index: params.index, direction: params.direction }, { type: params.type, source: params.source });
  await saveNotebook(params.path, notebook);
  const anchor = params.cellId ?? `index ${params.index}`;
  return {
    content: [{ type: "text", text: `Inserted cell ${result.id} ${params.direction} ${anchor} in ${params.path}.` }],
    details: result,
  };
}

export const notebookToolRunners = {
  notebook_summary: runNotebookSummary,
  notebook_read: runNotebookRead,
  notebook_write: runNotebookWrite,
  notebook_edit: runNotebookEdit,
  notebook_insert: runNotebookInsert,
} as const;

export type NotebookToolName = keyof typeof notebookToolRunners;
