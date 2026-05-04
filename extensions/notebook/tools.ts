import { StringEnum } from "@mariozechner/pi-ai"
import { type Static, Type } from "typebox"
import {
	clearCellOutputs,
	deleteCell,
	editCellSource,
	ensureCellIds,
	formatNotebookSummary,
	insertCell,
	loadNotebook,
	mergeCell,
	moveCell,
	readAllCells,
	readCellById,
	saveNotebook,
	sliceCellSource,
	summarizeNotebook,
	writeCellSource
} from "./notebook"

export const notebookSummaryParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." })
})

export const notebookReadCellParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Cell id to read." })),
	index: Type.Optional(Type.Integer({ description: "Cell index to read." })),
	lineOffset: Type.Optional(Type.Integer({ description: "Inclusive source line offset within the cell." })),
	lineLimit: Type.Optional(Type.Integer({ description: "Maximum number of source lines to read from the offset." }))
})

export const notebookWriteCellParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Cell id to replace." })),
	index: Type.Optional(Type.Integer({ description: "Cell index to replace." })),
	source: Type.String({ description: "New full cell source." })
})

export const notebookEditCellParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Cell id to edit." })),
	index: Type.Optional(Type.Integer({ description: "Cell index to edit." })),
	edits: Type.Array(
		Type.Object({
			oldText: Type.String({ description: "Exact text to replace." }),
			newText: Type.String({ description: "Replacement text." })
		}),
		{ minItems: 1 }
	)
})

export const notebookInsertParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Anchor cell id." })),
	index: Type.Optional(Type.Integer({ description: "Anchor cell index. Use -1 to append." })),
	direction: StringEnum(["before", "after"] as const, { description: "Insert before or after the anchor." }),
	type: StringEnum(["code", "markdown", "raw"] as const, { description: "New cell type." }),
	source: Type.String({ description: "Source for the new cell." })
})

export const notebookDeleteParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Cell id to delete." })),
	index: Type.Optional(Type.Integer({ description: "Cell index to delete." }))
})

export const notebookMoveParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Cell id to move." })),
	index: Type.Optional(Type.Integer({ description: "Cell index to move." })),
	targetCellId: Type.Optional(Type.String({ description: "Anchor cell id to move relative to." })),
	targetIndex: Type.Optional(Type.Integer({ description: "Anchor cell index to move relative to. Use -1 for the end." })),
	direction: StringEnum(["before", "after"] as const, {
		description: "Place the moved cell before or after the target."
	})
})

export const notebookMergeParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Anchor cell id to keep." })),
	index: Type.Optional(Type.Integer({ description: "Anchor cell index to keep." })),
	direction: StringEnum(["above", "below"] as const, { description: "Adjacent merge direction." })
})

export const notebookClearOutputsParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Code cell id whose outputs should be cleared." })),
	index: Type.Optional(Type.Integer({ description: "Code cell index whose outputs should be cleared." }))
})

export type NotebookSummaryParams = Static<typeof notebookSummaryParams>
export type NotebookReadCellParams = Static<typeof notebookReadCellParams>
export type NotebookWriteCellParams = Static<typeof notebookWriteCellParams>
export type NotebookEditCellParams = Static<typeof notebookEditCellParams>
export type NotebookInsertParams = Static<typeof notebookInsertParams>
export type NotebookDeleteParams = Static<typeof notebookDeleteParams>
export type NotebookMoveParams = Static<typeof notebookMoveParams>
export type NotebookMergeParams = Static<typeof notebookMergeParams>
export type NotebookClearOutputsParams = Static<typeof notebookClearOutputsParams>

export interface NotebookToolResult {
	content: Array<{ type: "text"; text: string }>
	details: unknown
}

function formatAssignedIds(notebookPath: string, assigned: Array<{ index: number; id: string }>): string {
	if (assigned.length === 0) return ""
	return `\nAssigned ids in ${notebookPath}: ${assigned.map(({ index, id }) => `${index}=${id}`).join(" ")}`
}

function requireSingleCellSelector(cellId?: string, index?: number): string | number {
	if ((cellId === undefined) === (index === undefined)) {
		throw new Error("Provide exactly one cell selector: cellId or index")
	}
	return cellId ?? (index as number)
}

function requireReadCellAtIndex(notebook: Awaited<ReturnType<typeof loadNotebook>>, index: number) {
	const cell = readAllCells(notebook)[index]
	if (cell === undefined) throw new Error(`Cell index out of range: ${index}`)
	return cell
}

export async function runNotebookSummary(params: NotebookSummaryParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const summary = summarizeNotebook(params.path, notebook)
	return {
		content: [{ type: "text", text: formatNotebookSummary(summary) }],
		details: summary
	}
}

export async function runNotebookReadCell(params: NotebookReadCellParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const result = typeof selector === "string" ? readCellById(notebook, selector) : requireReadCellAtIndex(notebook, selector)
	const text = sliceCellSource(result.source, params.lineOffset, params.lineLimit)
	return {
		content: [{ type: "text", text }],
		details: result
	}
}

export async function runNotebookWriteCell(params: NotebookWriteCellParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	writeCellSource(notebook, selector, params.source)
	await saveNotebook(params.path, notebook)
	const result = typeof selector === "string" ? readCellById(notebook, selector) : requireReadCellAtIndex(notebook, selector)
	return {
		content: [
			{
				type: "text",
				text: `Wrote cell ${typeof selector === "string" ? selector : `index ${selector}`} in ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export async function runNotebookEditCell(params: NotebookEditCellParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	editCellSource(notebook, selector, params.edits)
	await saveNotebook(params.path, notebook)
	const result = typeof selector === "string" ? readCellById(notebook, selector) : requireReadCellAtIndex(notebook, selector)
	return {
		content: [
			{
				type: "text",
				text: `Successfully replaced ${params.edits.length} block(s) in cell ${typeof selector === "string" ? selector : `index ${selector}`} of ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export async function runNotebookInsert(params: NotebookInsertParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const assigned = ensureCellIds(notebook)
	const result = insertCell(
		notebook,
		{
			direction: params.direction,
			...(params.cellId === undefined ? {} : { cellId: params.cellId }),
			...(params.index === undefined ? {} : { index: params.index })
		},
		{ type: params.type, source: params.source }
	)
	await saveNotebook(params.path, notebook)
	const anchor = params.cellId ?? (params.index === -1 ? "the end" : `index ${params.index}`)
	const placement = params.index === -1 ? "at" : params.direction
	return {
		content: [
			{
				type: "text",
				text: `Inserted cell ${result.id} ${placement} ${anchor} in ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export async function runNotebookDelete(params: NotebookDeleteParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	const result = deleteCell(notebook, selector)
	await saveNotebook(params.path, notebook)
	return {
		content: [
			{
				type: "text",
				text: `Deleted cell ${typeof selector === "string" ? selector : `index ${selector}`} from ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export async function runNotebookMove(params: NotebookMoveParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const target = requireSingleCellSelector(params.targetCellId, params.targetIndex)
	const assigned = ensureCellIds(notebook)
	const result = moveCell(notebook, selector, target, params.direction)
	await saveNotebook(params.path, notebook)
	const targetText = typeof target === "string" ? target : target === -1 ? "the end" : `index ${target}`
	return {
		content: [
			{
				type: "text",
				text: `Moved cell ${typeof selector === "string" ? selector : `index ${selector}`} ${params.direction} ${targetText} in ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export async function runNotebookMerge(params: NotebookMergeParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	const result = mergeCell(notebook, selector, params.direction)
	await saveNotebook(params.path, notebook)
	return {
		content: [
			{
				type: "text",
				text: `Merged cell ${result.removed.id ?? `index ${result.removed.index}`} into ${typeof selector === "string" ? selector : `index ${selector}`} in ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export async function runNotebookClearOutputs(params: NotebookClearOutputsParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	const result = clearCellOutputs(notebook, selector)
	await saveNotebook(params.path, notebook)
	return {
		content: [
			{
				type: "text",
				text: `Cleared outputs for cell ${typeof selector === "string" ? selector : `index ${selector}`} in ${params.path}.${formatAssignedIds(params.path, assigned)}`
			}
		],
		details: result
	}
}

export const notebookToolRunners = {
	notebook_summary: runNotebookSummary,
	notebook_read_cell: runNotebookReadCell,
	notebook_write_cell: runNotebookWriteCell,
	notebook_edit_cell: runNotebookEditCell,
	notebook_insert: runNotebookInsert,
	notebook_delete: runNotebookDelete,
	notebook_move: runNotebookMove,
	notebook_merge: runNotebookMerge,
	notebook_clear_outputs: runNotebookClearOutputs
} as const

export type NotebookToolName = keyof typeof notebookToolRunners
