import { Type, type Static } from "typebox";
import { clearCellOutputs, deleteCell, editCellSource, formatNotebookRead, formatNotebookSummary, insertCell, loadNotebook, mergeCell, moveCell, readAllCells, readCellById, saveNotebook, summarizeNotebook, writeCellSource } from "./notebook";

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

export const notebookDeleteParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.String({ description: "Cell id to delete." }),
});

export const notebookMoveParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.String({ description: "Cell id to move." }),
  index: Type.Integer({ description: "New absolute cell index." }),
});

export const notebookMergeParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.String({ description: "Anchor cell id to keep." }),
  direction: Type.Union([Type.Literal("up"), Type.Literal("down")], { description: "Adjacent merge direction." }),
});

export const notebookClearOutputsParams = Type.Object({
  path: Type.String({ description: "Path to an .ipynb notebook." }),
  cellId: Type.String({ description: "Code cell id whose outputs should be cleared." }),
});

export type NotebookSummaryParams = Static<typeof notebookSummaryParams>;
export type NotebookReadParams = Static<typeof notebookReadParams>;
export type NotebookWriteParams = Static<typeof notebookWriteParams>;
export type NotebookEditParams = Static<typeof notebookEditParams>;
export type NotebookInsertParams = Static<typeof notebookInsertParams>;
export type NotebookDeleteParams = Static<typeof notebookDeleteParams>;
export type NotebookMoveParams = Static<typeof notebookMoveParams>;
export type NotebookMergeParams = Static<typeof notebookMergeParams>;
export type NotebookClearOutputsParams = Static<typeof notebookClearOutputsParams>;

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

export async function runNotebookDelete(params: NotebookDeleteParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const result = deleteCell(notebook, params.cellId);
  await saveNotebook(params.path, notebook);
  return {
    content: [{ type: "text", text: `Deleted cell ${params.cellId} from ${params.path}.` }],
    details: result,
  };
}

export async function runNotebookMove(params: NotebookMoveParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const result = moveCell(notebook, params.cellId, params.index);
  await saveNotebook(params.path, notebook);
  return {
    content: [{ type: "text", text: `Moved cell ${params.cellId} to index ${params.index} in ${params.path}.` }],
    details: result,
  };
}

export async function runNotebookMerge(params: NotebookMergeParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const result = mergeCell(notebook, params.cellId, params.direction);
  await saveNotebook(params.path, notebook);
  return {
    content: [{ type: "text", text: `Merged cell ${result.removed.id} into ${params.cellId} in ${params.path}.` }],
    details: result,
  };
}

export async function runNotebookClearOutputs(params: NotebookClearOutputsParams): Promise<NotebookToolResult> {
  const notebook = await loadNotebook(params.path);
  const result = clearCellOutputs(notebook, params.cellId);
  await saveNotebook(params.path, notebook);
  return {
    content: [{ type: "text", text: `Cleared outputs for cell ${params.cellId} in ${params.path}.` }],
    details: result,
  };
}

export const notebookToolRunners = {
  notebook_summary: runNotebookSummary,
  notebook_read: runNotebookRead,
  notebook_write: runNotebookWrite,
  notebook_edit: runNotebookEdit,
  notebook_insert: runNotebookInsert,
  notebook_delete: runNotebookDelete,
  notebook_move: runNotebookMove,
  notebook_merge: runNotebookMerge,
  notebook_clear_outputs: runNotebookClearOutputs,
} as const;

export type NotebookToolName = keyof typeof notebookToolRunners;
