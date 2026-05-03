import { randomBytes } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"

export interface NotebookCell {
	cell_type: string
	id?: string
	source?: string | string[]
	metadata?: Record<string, unknown>
	execution_count?: number | null
	outputs?: unknown[]
	[key: string]: unknown
}

export interface Notebook {
	nbformat: number
	nbformat_minor: number
	metadata?: Record<string, unknown>
	cells: NotebookCell[]
	[key: string]: unknown
}

export interface NotebookCellSummary {
	index: number
	id?: string
	type: string
	sourceLines: number
	preview: string
	executionCount?: number | null
	outputCount?: number
}

export interface NotebookSummary {
	path: string
	nbformat: number
	nbformatMinor: number
	kernelName: string | null
	language: string | null
	cellCount: number
	cells: NotebookCellSummary[]
}

export interface NotebookReadCell {
	index: number
	id?: string
	type: string
	source: string
	executionCount?: number | null
}

export interface PersistedCellId {
	index: number
	id: string
}

function quoteAttribute(text: string): string {
	return `"${text.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`
}

export interface NotebookSourceEdit {
	oldText: string
	newText: string
}

export interface NotebookInsertCell {
	type: "code" | "markdown" | "raw"
	source: string
}

export interface NotebookInsertTarget {
	cellId?: string
	index?: number
	direction: "before" | "after"
}

export interface NotebookMergeResult {
	merged: NotebookReadCell
	removed: NotebookReadCell
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function storedCellId(cell: NotebookCell): string | undefined {
	return typeof cell.id === "string" && cell.id.length > 0 ? cell.id : undefined
}

export function normalizeSource(source: NotebookCell["source"]): string {
	if (typeof source === "string") return source
	if (Array.isArray(source)) return source.join("")
	return ""
}

function sourceToLines(source: string): string[] {
	if (source.length === 0) return []
	return source.match(/[^\n]*\n|[^\n]+/g) ?? []
}

function previewSource(source: string): string {
	const escaped = source.replaceAll("\\", "\\\\").replaceAll("\n", "\\n")
	return escaped.length > 120 ? `${escaped.slice(0, 120)}...` : escaped
}

function joinCellSources(a: string, b: string): string {
	if (a.length === 0 || b.length === 0) return `${a}${b}`
	if (a.endsWith("\n") || b.startsWith("\n")) return `${a}${b}`
	return `${a}\n${b}`
}

function quotePreview(text: string): string {
	return `"${text.replaceAll('"', '\\"')}"`
}

function sourceLineCount(source: string): number {
	if (source.length === 0) return 0
	return source.split("\n").length
}

function createCellId(notebook: Notebook): string {
	const ids = new Set(notebook.cells.map(cell => storedCellId(cell)).filter((id): id is string => id !== undefined))
	let id = randomBytes(4).toString("hex")
	while (ids.has(id)) id = randomBytes(4).toString("hex")
	return id
}

function readCell(cell: NotebookCell, index: number): NotebookReadCell {
	return {
		index,
		id: storedCellId(cell),
		type: cell.cell_type,
		source: normalizeSource(cell.source),
		executionCount: cell.cell_type === "code" ? ((cell.execution_count as number | null | undefined) ?? null) : undefined
	}
}

function findCellIndexBySelector(notebook: Notebook, selector: string | number): number {
	if (typeof selector === "number") {
		if (!Number.isInteger(selector) || selector < 0 || selector >= notebook.cells.length) {
			throw new Error(`Cell index out of range: ${selector}`)
		}
		return selector
	}

	const index = notebook.cells.findIndex(cell => storedCellId(cell) === selector)
	if (index === -1) throw new Error(`Cell not found: ${selector}`)
	return index
}

export function ensureCellIds(notebook: Notebook): PersistedCellId[] {
	const assigned: PersistedCellId[] = []

	for (const [index, cell] of notebook.cells.entries()) {
		if (storedCellId(cell)) continue
		const id = createCellId(notebook)
		notebook.cells[index] = { ...cell, id }
		assigned.push({ index, id })
	}

	if (assigned.length > 0 && notebook.nbformat_minor < 5) {
		notebook.nbformat_minor = 5
	}

	return assigned
}

export function parseNotebook(text: string): Notebook {
	const data: unknown = JSON.parse(text)
	if (!isObject(data)) throw new Error("Notebook root must be an object")
	if (data.nbformat !== 4) throw new Error("Only nbformat 4 notebooks are supported")
	if (!Array.isArray(data.cells)) throw new Error("Notebook cells must be an array")

	for (const [index, cell] of data.cells.entries()) {
		if (!isObject(cell)) throw new Error(`Cell ${index} must be an object`)
		if (typeof cell.cell_type !== "string") throw new Error(`Cell ${index} is missing cell_type`)
	}

	return data as Notebook
}

export async function loadNotebook(path: string): Promise<Notebook> {
	return parseNotebook(await readFile(path, "utf8"))
}

export async function saveNotebook(path: string, notebook: Notebook): Promise<void> {
	for (const [index, cell] of notebook.cells.entries()) {
		notebook.cells[index] = { ...cell, source: sourceToLines(normalizeSource(cell.source)) }
	}
	await writeFile(path, `${JSON.stringify(notebook, null, 1)}\n`, "utf8")
}

export function summarizeNotebook(path: string, notebook: Notebook): NotebookSummary {
	const metadata = isObject(notebook.metadata) ? notebook.metadata : {}
	const kernelspec = isObject(metadata.kernelspec) ? metadata.kernelspec : {}
	const languageInfo = isObject(metadata.language_info) ? metadata.language_info : {}

	return {
		path,
		nbformat: notebook.nbformat,
		nbformatMinor: notebook.nbformat_minor,
		kernelName: typeof kernelspec.name === "string" ? kernelspec.name : null,
		language: typeof languageInfo.name === "string" ? languageInfo.name : null,
		cellCount: notebook.cells.length,
		cells: notebook.cells.map((cell, index) => {
			const source = normalizeSource(cell.source)
			return {
				index,
				id: storedCellId(cell),
				type: cell.cell_type,
				sourceLines: sourceLineCount(source),
				preview: previewSource(source),
				executionCount: cell.cell_type === "code" ? ((cell.execution_count as number | null | undefined) ?? null) : undefined,
				outputCount: cell.cell_type === "code" ? (Array.isArray(cell.outputs) ? cell.outputs.length : 0) : undefined
			}
		})
	}
}

export function formatNotebookSummary(summary: NotebookSummary): string {
	const metadata = [
		`nbformat=${summary.nbformat}.${summary.nbformatMinor}`,
		`kernel=${summary.kernelName ?? "-"}`,
		`cells=${summary.cellCount}`
	]
	if (summary.language) metadata.push(`language=${summary.language}`)

	const lines = [
		`meta ${metadata.join(" ")}`,
		...summary.cells.map(cell => {
			const parts = [String(cell.index), `type=${cell.type === "markdown" ? "md" : cell.type}`, `lines=${cell.sourceLines}`]
			if (cell.id) parts.splice(1, 0, `id=${cell.id}`)
			if (cell.executionCount !== undefined && cell.executionCount !== null) parts.push(`n_exec=${cell.executionCount}`)
			if (cell.outputCount !== undefined) parts.push(`outputs=${cell.outputCount}`)
			parts.push(`preview=${quotePreview(cell.preview)}`)
			return parts.join(" ")
		})
	]

	return lines.join("\n")
}

export function formatNotebookRead(path: string, cells: NotebookReadCell | NotebookReadCell[]): string {
	const list = Array.isArray(cells) ? cells : [cells]
	const lines: string[] = []

	if (Array.isArray(cells)) {
		lines.push(`<notebook path=${quoteAttribute(path)} cells=${quoteAttribute(String(list.length))} />`)
		lines.push("")
	}

	for (const [index, cell] of list.entries()) {
		const attrs = [
			`index=${quoteAttribute(String(cell.index))}`,
			`type=${quoteAttribute(cell.type === "markdown" ? "md" : cell.type)}`,
			`lines=${quoteAttribute(String(sourceLineCount(cell.source)))}`
		]
		if (cell.id) attrs.splice(1, 0, `id=${quoteAttribute(cell.id)}`)
		if (cell.executionCount !== undefined && cell.executionCount !== null) {
			attrs.push(`n_exec=${quoteAttribute(String(cell.executionCount))}`)
		}
		lines.push(`<cell ${attrs.join(" ")} />`)
		lines.push(cell.source)
		if (index < list.length - 1) lines.push("")
	}

	return lines.join("\n")
}

export function readAllCells(notebook: Notebook): NotebookReadCell[] {
	return notebook.cells.map((cell, index) => readCell(cell, index))
}

function findCellIndexById(notebook: Notebook, cellId: string): number {
	return findCellIndexBySelector(notebook, cellId)
}

export function readCellById(notebook: Notebook, cellId: string): NotebookReadCell {
	const index = findCellIndexById(notebook, cellId)
	return readCell(notebook.cells[index]!, index)
}

export function readCellsById(notebook: Notebook, cellIds: string[]): NotebookReadCell[] {
	return cellIds.map(cellId => readCellById(notebook, cellId))
}

export function readCellRange(notebook: Notebook, startIndex: number, endIndex: number): NotebookReadCell[] {
	if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
		throw new Error("Cell range indices must be integers")
	}
	if (startIndex < 0 || endIndex < 0 || startIndex >= notebook.cells.length || endIndex >= notebook.cells.length) {
		throw new Error(`Cell range out of range: ${startIndex}..${endIndex}`)
	}
	if (startIndex > endIndex) throw new Error(`Invalid cell range: ${startIndex}..${endIndex}`)
	return readAllCells(notebook).slice(startIndex, endIndex + 1)
}

export function writeCellSource(notebook: Notebook, cell: string | number, source: string): Notebook {
	const index = findCellIndexBySelector(notebook, cell)
	notebook.cells[index] = {
		...notebook.cells[index],
		source
	}
	return notebook
}

function findUniqueMatch(haystack: string, needle: string): { start: number; end: number } {
	const start = haystack.indexOf(needle)
	if (start === -1) throw new Error(`Edit text not found: ${JSON.stringify(needle)}`)
	if (haystack.indexOf(needle, start + 1) !== -1) {
		throw new Error(`Edit text is ambiguous: ${JSON.stringify(needle)}`)
	}
	return { start, end: start + needle.length }
}

export function applyExactSourceEdits(source: string, edits: NotebookSourceEdit[]): string {
	const matches = edits.map(edit => ({ ...edit, ...findUniqueMatch(source, edit.oldText) }))
	const sorted = [...matches].sort((a, b) => a.start - b.start)

	for (let index = 1; index < sorted.length; index += 1) {
		if (sorted[index]!.start < sorted[index - 1]!.end) {
			throw new Error("Edit ranges overlap")
		}
	}

	let cursor = 0
	let result = ""
	for (const match of sorted) {
		result += source.slice(cursor, match.start)
		result += match.newText
		cursor = match.end
	}
	result += source.slice(cursor)
	return result
}

export function editCellSource(notebook: Notebook, cell: string | number, edits: NotebookSourceEdit[]): Notebook {
	const index = findCellIndexBySelector(notebook, cell)
	return writeCellSource(notebook, index, applyExactSourceEdits(readCell(notebook.cells[index]!, index).source, edits))
}

export function insertCell(notebook: Notebook, target: NotebookInsertTarget, cell: NotebookInsertCell): NotebookReadCell {
	if ((target.cellId === undefined) === (target.index === undefined)) {
		throw new Error("Provide exactly one of cellId or index")
	}

	const anchorIndex = target.cellId !== undefined ? findCellIndexById(notebook, target.cellId) : target.index!

	if (anchorIndex !== -1 && (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= notebook.cells.length)) {
		throw new Error(`Cell index out of range: ${anchorIndex}`)
	}

	const insertIndex = anchorIndex === -1 ? notebook.cells.length : anchorIndex + (target.direction === "after" ? 1 : 0)
	const id = createCellId(notebook)
	const nextCell: NotebookCell = {
		cell_type: cell.type,
		id,
		metadata: {},
		source: cell.source
	}

	if (cell.type === "code") {
		nextCell.execution_count = null
		nextCell.outputs = []
	}

	notebook.cells.splice(insertIndex, 0, nextCell)
	if (notebook.nbformat_minor < 5) notebook.nbformat_minor = 5
	return readAllCells(notebook)[insertIndex]!
}

export function deleteCell(notebook: Notebook, cell: string | number): NotebookReadCell {
	const index = findCellIndexBySelector(notebook, cell)
	const deleted = readAllCells(notebook)[index]!
	notebook.cells.splice(index, 1)
	return deleted
}

export function moveCell(
	notebook: Notebook,
	cell: string | number,
	target: string | number,
	direction: "before" | "after"
): NotebookReadCell {
	const fromIndex = findCellIndexBySelector(notebook, cell)
	const targetIndex = typeof target === "number" && target === -1 ? notebook.cells.length - 1 : findCellIndexBySelector(notebook, target)

	if (targetIndex === fromIndex) {
		throw new Error("Cannot move a cell relative to itself")
	}

	const [movedCell] = notebook.cells.splice(fromIndex, 1)
	const anchorIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
	const insertIndex = direction === "before" ? anchorIndex : anchorIndex + 1
	notebook.cells.splice(insertIndex, 0, movedCell!)
	return readAllCells(notebook)[insertIndex]!
}

export function mergeCell(notebook: Notebook, cell: string | number, direction: "above" | "below"): NotebookMergeResult {
	const anchorIndex = findCellIndexBySelector(notebook, cell)
	const otherIndex = anchorIndex + (direction === "above" ? -1 : 1)

	if (otherIndex < 0 || otherIndex >= notebook.cells.length) {
		throw new Error(`No cell to merge ${direction} from ${typeof cell === "string" ? cell : anchorIndex}`)
	}

	const anchor = notebook.cells[anchorIndex]!
	const other = notebook.cells[otherIndex]!
	if (anchor.cell_type !== other.cell_type) {
		throw new Error(`Cannot merge ${anchor.cell_type} cell with ${other.cell_type} cell`)
	}

	const source =
		direction === "above"
			? joinCellSources(normalizeSource(other.source), normalizeSource(anchor.source))
			: joinCellSources(normalizeSource(anchor.source), normalizeSource(other.source))

	notebook.cells[anchorIndex] = { ...anchor, source }
	notebook.cells.splice(otherIndex, 1)
	const mergedIndex = direction === "above" ? anchorIndex - 1 : anchorIndex

	return {
		merged: readAllCells(notebook)[mergedIndex]!,
		removed: readCell(other, otherIndex)
	}
}

export function clearCellOutputs(notebook: Notebook, cell: string | number): NotebookReadCell {
	const index = findCellIndexBySelector(notebook, cell)
	const current = notebook.cells[index]!
	if (current.cell_type !== "code") throw new Error(`Cell is not code: ${typeof cell === "string" ? cell : index}`)
	notebook.cells[index] = { ...current, outputs: [] }
	return readAllCells(notebook)[index]!
}
