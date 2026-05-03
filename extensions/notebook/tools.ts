import { type Static, Type } from "typebox"
import {
	clearCellOutputs,
	deleteCell,
	editCellSource,
	ensureCellIds,
	formatNotebookRead,
	formatNotebookSummary,
	insertCell,
	loadNotebook,
	mergeCell,
	moveCell,
	readAllCells,
	readCellById,
	readCellRange,
	readCellsById,
	saveNotebook,
	summarizeNotebook,
	writeCellSource
} from "./notebook"

export const notebookSummaryParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." })
})

export const notebookReadParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Single cell id to read." })),
	cellIds: Type.Optional(
		Type.Array(Type.String({ description: "Cell id to read." }), {
			minItems: 1,
			description: "Multiple cell ids to read in the given order."
		})
	),
	startIndex: Type.Optional(Type.Integer({ description: "Inclusive start index for a cell range read." })),
	endIndex: Type.Optional(Type.Integer({ description: "Inclusive end index for a cell range read." }))
})

export const notebookWriteParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Cell id to replace." })),
	index: Type.Optional(Type.Integer({ description: "Cell index to replace." })),
	source: Type.String({ description: "New full cell source." })
})

export const notebookEditParams = Type.Object({
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
	direction: Type.Union([Type.Literal("before"), Type.Literal("after")], { description: "Insert before or after the anchor." }),
	type: Type.Union([Type.Literal("code"), Type.Literal("markdown"), Type.Literal("raw")], { description: "New cell type." }),
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
	direction: Type.Union([Type.Literal("before"), Type.Literal("after")], {
		description: "Place the moved cell before or after the target."
	})
})

export const notebookMergeParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Anchor cell id to keep." })),
	index: Type.Optional(Type.Integer({ description: "Anchor cell index to keep." })),
	direction: Type.Union([Type.Literal("above"), Type.Literal("below")], { description: "Adjacent merge direction." })
})

export const notebookClearOutputsParams = Type.Object({
	path: Type.String({ description: "Path to an .ipynb notebook." }),
	cellId: Type.Optional(Type.String({ description: "Code cell id whose outputs should be cleared." })),
	index: Type.Optional(Type.Integer({ description: "Code cell index whose outputs should be cleared." }))
})

export type NotebookSummaryParams = Static<typeof notebookSummaryParams>
export type NotebookReadParams = Static<typeof notebookReadParams>
export type NotebookWriteParams = Static<typeof notebookWriteParams>
export type NotebookEditParams = Static<typeof notebookEditParams>
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
	return cellId ?? index!
}

export async function runNotebookSummary(params: NotebookSummaryParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const summary = summarizeNotebook(params.path, notebook)
	return {
		content: [{ type: "text", text: formatNotebookSummary(summary) }],
		details: summary
	}
}

export async function runNotebookRead(params: NotebookReadParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selectors = [
		params.cellId !== undefined,
		params.cellIds !== undefined,
		params.startIndex !== undefined || params.endIndex !== undefined
	].filter(Boolean).length

	if (selectors > 1) throw new Error("Provide at most one read selector: cellId, cellIds, or startIndex/endIndex")
	if ((params.startIndex === undefined) !== (params.endIndex === undefined)) {
		throw new Error("Provide both startIndex and endIndex for range reads")
	}

	const result =
		params.cellId !== undefined
			? readCellById(notebook, params.cellId)
			: params.cellIds !== undefined
				? readCellsById(notebook, params.cellIds)
				: params.startIndex !== undefined
					? readCellRange(notebook, params.startIndex, params.endIndex!)
					: readAllCells(notebook)
	return {
		content: [{ type: "text", text: formatNotebookRead(params.path, result) }],
		details: result
	}
}

export async function runNotebookWrite(params: NotebookWriteParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	writeCellSource(notebook, selector, params.source)
	await saveNotebook(params.path, notebook)
	const result = typeof selector === "string" ? readCellById(notebook, selector) : readAllCells(notebook)[selector]!
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

export async function runNotebookEdit(params: NotebookEditParams): Promise<NotebookToolResult> {
	const notebook = await loadNotebook(params.path)
	const selector = requireSingleCellSelector(params.cellId, params.index)
	const assigned = ensureCellIds(notebook)
	editCellSource(notebook, selector, params.edits)
	await saveNotebook(params.path, notebook)
	const result = typeof selector === "string" ? readCellById(notebook, selector) : readAllCells(notebook)[selector]!
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
		{ cellId: params.cellId, index: params.index, direction: params.direction },
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
	notebook_read: runNotebookRead,
	notebook_write: runNotebookWrite,
	notebook_edit: runNotebookEdit,
	notebook_insert: runNotebookInsert,
	notebook_delete: runNotebookDelete,
	notebook_move: runNotebookMove,
	notebook_merge: runNotebookMerge,
	notebook_clear_outputs: runNotebookClearOutputs
} as const

export type NotebookToolName = keyof typeof notebookToolRunners
