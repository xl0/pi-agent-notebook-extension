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

export interface NotebookMetadata {
	kernelspec?: {
		name?: string
		[key: string]: unknown
	}
	language_info?: {
		name?: string
		[key: string]: unknown
	}
	[key: string]: unknown
}

export interface Notebook {
	nbformat: number
	nbformat_minor: number
	metadata?: NotebookMetadata
	cells: NotebookCell[]
	[key: string]: unknown
}

export interface NotebookCellSummary {
	index: number
	id?: string
	type: string
	sourceLines: number
	preview: string
	previewLines: number
	previewTruncated: boolean
	previewRemainingLines: number
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

type RawObject = Record<string, unknown>

type RawNotebook = RawObject & {
	nbformat?: unknown
	cells?: unknown
}

type RawCell = RawObject & {
	cell_type?: unknown
}

function isObject(value: unknown): value is RawObject {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function storedCellId(cell: NotebookCell): string | undefined {
	return typeof cell.id === "string" && cell.id.length > 0 ? cell.id : undefined
}

function cellAt(notebook: Notebook, index: number): NotebookCell {
	const cell = notebook.cells[index]
	if (cell === undefined) throw new Error(`Cell index out of range: ${index}`)
	return cell
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

function previewSource(source: string): { text: string; lines: number; truncated: boolean; remainingLines: number } {
	const maxLines = 5
	const lines = sourceToLines(source)
	const shownLines = lines.slice(0, maxLines)
	const truncated = lines.length > maxLines
	const remainingLines = Math.max(0, lines.length - shownLines.length)
	const text = truncated ? `${shownLines.join("").replace(/\n?$/, "")}\n[${remainingLines} more lines]` : shownLines.join("")
	return { text, lines: shownLines.length, truncated, remainingLines }
}

function joinCellSources(a: string, b: string): string {
	if (a.length === 0 || b.length === 0) return `${a}${b}`
	if (a.endsWith("\n") || b.startsWith("\n")) return `${a}${b}`
	return `${a}\n${b}`
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
	const id = storedCellId(cell)
	const executionCount = cell.cell_type === "code" ? ((cell.execution_count as number | null | undefined) ?? null) : undefined
	return {
		index,
		...(id === undefined ? {} : { id }),
		type: cell.cell_type,
		source: normalizeSource(cell.source),
		...(executionCount === undefined ? {} : { executionCount })
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
	const notebook = data as RawNotebook
	if (notebook.nbformat !== 4) throw new Error("Only nbformat 4 notebooks are supported")
	if (!Array.isArray(notebook.cells)) throw new Error("Notebook cells must be an array")

	for (const [index, cell] of notebook.cells.entries()) {
		if (!isObject(cell)) throw new Error(`Cell ${index} must be an object`)
		if (typeof (cell as RawCell).cell_type !== "string") throw new Error(`Cell ${index} is missing cell_type`)
	}

	return notebook as Notebook
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
	const metadata = notebook.metadata ?? {}
	const kernelspec = metadata.kernelspec ?? {}
	const languageInfo = metadata.language_info ?? {}

	return {
		path,
		nbformat: notebook.nbformat,
		nbformatMinor: notebook.nbformat_minor,
		kernelName: typeof kernelspec.name === "string" ? kernelspec.name : null,
		language: typeof languageInfo.name === "string" ? languageInfo.name : null,
		cellCount: notebook.cells.length,
		cells: notebook.cells.map((cell, index) => {
			const source = normalizeSource(cell.source)
			const id = storedCellId(cell)
			const executionCount = cell.cell_type === "code" ? ((cell.execution_count as number | null | undefined) ?? null) : undefined
			const outputCount = cell.cell_type === "code" ? (Array.isArray(cell.outputs) ? cell.outputs.length : 0) : undefined
			const preview = previewSource(source)
			return {
				index,
				...(id === undefined ? {} : { id }),
				type: cell.cell_type,
				sourceLines: sourceLineCount(source),
				preview: preview.text,
				previewLines: preview.lines,
				previewTruncated: preview.truncated,
				previewRemainingLines: preview.remainingLines,
				...(executionCount === undefined ? {} : { executionCount }),
				...(outputCount === undefined ? {} : { outputCount })
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

	const lines = [`meta ${metadata.join(" ")}`]

	for (const cell of summary.cells) {
		const attrs = [
			`index=${quoteAttribute(String(cell.index))}`,
			`type=${quoteAttribute(cell.type === "markdown" ? "md" : cell.type)}`,
			`lines=${quoteAttribute(String(cell.sourceLines))}`
		]
		if (cell.id) attrs.splice(1, 0, `id=${quoteAttribute(cell.id)}`)
		if (cell.executionCount !== undefined && cell.executionCount !== null) attrs.push(`n_exec=${quoteAttribute(String(cell.executionCount))}`)
		if (cell.outputCount !== undefined) attrs.push(`outputs=${quoteAttribute(String(cell.outputCount))}`)
		lines.push(`<cell ${attrs.join(" ")} />`)
		if (cell.preview.length > 0) lines.push(cell.preview)
	}

	return lines.join("\n")
}

export function sliceCellSource(source: string, lineOffset = 0, lineLimit?: number): string {
	if (!Number.isInteger(lineOffset) || lineOffset < 0) throw new Error(`Invalid lineOffset: ${lineOffset}`)
	if (lineLimit !== undefined && (!Number.isInteger(lineLimit) || lineLimit < 0)) {
		throw new Error(`Invalid lineLimit: ${lineLimit}`)
	}
	const lines = sourceToLines(source)
	if (lineOffset > lines.length) throw new Error(`lineOffset out of range: ${lineOffset}`)
	const sliced = lines.slice(lineOffset, lineLimit === undefined ? undefined : lineOffset + lineLimit)
	const text = sliced.join("")
	const remainingLines = Math.max(0, lines.length - (lineOffset + sliced.length))
	if (lineLimit === undefined || remainingLines === 0) return text
	const continuation = `[${remainingLines} more lines. Use offset=${lineOffset + sliced.length} to continue.]`
	return text.length === 0 ? continuation : `${text}${text.endsWith("\n") ? "" : "\n"}${continuation}`
}

export function readAllCells(notebook: Notebook): NotebookReadCell[] {
	return notebook.cells.map((cell, index) => readCell(cell, index))
}

function findCellIndexById(notebook: Notebook, cellId: string): number {
	return findCellIndexBySelector(notebook, cellId)
}

export function readCellById(notebook: Notebook, cellId: string): NotebookReadCell {
	const index = findCellIndexById(notebook, cellId)
	return readCell(cellAt(notebook, index), index)
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
	const current = cellAt(notebook, index)
	notebook.cells[index] = {
		...current,
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
		const current = sorted[index]
		const previous = sorted[index - 1]
		if (current === undefined || previous === undefined) throw new Error("Edit ranges overlap")
		if (current.start < previous.end) {
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
	return writeCellSource(notebook, index, applyExactSourceEdits(readCell(cellAt(notebook, index), index).source, edits))
}

export function insertCell(notebook: Notebook, target: NotebookInsertTarget, cell: NotebookInsertCell): NotebookReadCell {
	if ((target.cellId === undefined) === (target.index === undefined)) {
		throw new Error("Provide exactly one of cellId or index")
	}

	const anchorIndex = target.cellId !== undefined ? findCellIndexById(notebook, target.cellId) : (target.index as number)

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
	return readCell(cellAt(notebook, insertIndex), insertIndex)
}

export function deleteCell(notebook: Notebook, cell: string | number): NotebookReadCell {
	const index = findCellIndexBySelector(notebook, cell)
	const deleted = readCell(cellAt(notebook, index), index)
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

	const movedCell = cellAt(notebook, fromIndex)
	notebook.cells.splice(fromIndex, 1)
	const anchorIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
	const insertIndex = direction === "before" ? anchorIndex : anchorIndex + 1
	notebook.cells.splice(insertIndex, 0, movedCell)
	return readCell(cellAt(notebook, insertIndex), insertIndex)
}

export function mergeCell(notebook: Notebook, cell: string | number, direction: "above" | "below"): NotebookMergeResult {
	const anchorIndex = findCellIndexBySelector(notebook, cell)
	const otherIndex = anchorIndex + (direction === "above" ? -1 : 1)

	if (otherIndex < 0 || otherIndex >= notebook.cells.length) {
		throw new Error(`No cell to merge ${direction} from ${typeof cell === "string" ? cell : anchorIndex}`)
	}

	const anchor = cellAt(notebook, anchorIndex)
	const other = cellAt(notebook, otherIndex)
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
		merged: readCell(cellAt(notebook, mergedIndex), mergedIndex),
		removed: readCell(other, otherIndex)
	}
}

export function clearCellOutputs(notebook: Notebook, cell: string | number): NotebookReadCell {
	const index = findCellIndexBySelector(notebook, cell)
	const current = cellAt(notebook, index)
	if (current.cell_type !== "code") throw new Error(`Cell is not code: ${typeof cell === "string" ? cell : index}`)
	notebook.cells[index] = { ...current, outputs: [] }
	return readCell(cellAt(notebook, index), index)
}
