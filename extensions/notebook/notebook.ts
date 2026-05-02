import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export interface NotebookCell {
  cell_type: string;
  id?: string;
  source?: string | string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
  [key: string]: unknown;
}

export interface Notebook {
  nbformat: number;
  nbformat_minor: number;
  metadata?: Record<string, unknown>;
  cells: NotebookCell[];
  [key: string]: unknown;
}

export interface NotebookCellSummary {
  index: number;
  id: string | null;
  type: string;
  sourceLines: number;
  preview: string;
  executionCount?: number | null;
  outputCount?: number;
}

export interface NotebookSummary {
  path: string;
  nbformat: number;
  nbformatMinor: number;
  kernelName: string | null;
  language: string | null;
  cellCount: number;
  cells: NotebookCellSummary[];
}

export interface NotebookReadCell {
  index: number;
  id: string;
  type: string;
  source: string;
  executionCount?: number | null;
}

function quoteAttribute(text: string): string {
  return `"${text.replaceAll("&", "&amp;").replaceAll("\"", "&quot;")}"`;
}

export interface NotebookSourceEdit {
  oldText: string;
  newText: string;
}

export interface NotebookInsertCell {
  type: "code" | "markdown" | "raw";
  source: string;
}

export interface NotebookInsertTarget {
  cellId?: string;
  index?: number;
  direction: "before" | "after";
}

export interface NotebookMergeResult {
  merged: NotebookReadCell;
  removed: NotebookReadCell;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSource(source: NotebookCell["source"]): string {
  if (typeof source === "string") return source;
  if (Array.isArray(source)) return source.join("");
  return "";
}

function previewSource(source: string): string {
  const escaped = source.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
  return escaped.length > 120 ? `${escaped.slice(0, 120)}...` : escaped;
}

function joinCellSources(a: string, b: string): string {
  if (a.length === 0 || b.length === 0) return `${a}${b}`;
  if (a.endsWith("\n") || b.startsWith("\n")) return `${a}${b}`;
  return `${a}\n${b}`;
}

function quotePreview(text: string): string {
  return `"${text.replaceAll("\"", "\\\"")}"`;
}

function sourceLineCount(source: string): number {
  if (source.length === 0) return 0;
  return source.split("\n").length;
}

function syntheticCellId(index: number): string {
  return `generated-${index}`;
}

export function getCellId(cell: NotebookCell, index: number): string {
  return typeof cell.id === "string" && cell.id.length > 0 ? cell.id : syntheticCellId(index);
}

export function ensureCellIds(notebook: Notebook): Notebook {
  let changed = false;

  for (const [index, cell] of notebook.cells.entries()) {
    if (typeof cell.id === "string" && cell.id.length > 0) continue;
    notebook.cells[index] = { ...cell, id: syntheticCellId(index) };
    changed = true;
  }

  if (changed && notebook.nbformat_minor < 5) {
    notebook.nbformat_minor = 5;
  }

  return notebook;
}

function createCellId(notebook: Notebook): string {
  const ids = new Set(notebook.cells.map((cell, index) => getCellId(cell, index)));
  let id = randomUUID();
  while (ids.has(id)) id = randomUUID();
  return id;
}

export function parseNotebook(text: string): Notebook {
  const data: unknown = JSON.parse(text);
  if (!isObject(data)) throw new Error("Notebook root must be an object");
  if (data.nbformat !== 4) throw new Error("Only nbformat 4 notebooks are supported");
  if (!Array.isArray(data.cells)) throw new Error("Notebook cells must be an array");

  for (const [index, cell] of data.cells.entries()) {
    if (!isObject(cell)) throw new Error(`Cell ${index} must be an object`);
    if (typeof cell.cell_type !== "string") throw new Error(`Cell ${index} is missing cell_type`);
  }

  return data as Notebook;
}

export async function loadNotebook(path: string): Promise<Notebook> {
  return parseNotebook(await readFile(path, "utf8"));
}

export async function saveNotebook(path: string, notebook: Notebook): Promise<void> {
  await writeFile(path, `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

export function summarizeNotebook(path: string, notebook: Notebook): NotebookSummary {
  const metadata = isObject(notebook.metadata) ? notebook.metadata : {};
  const kernelspec = isObject(metadata.kernelspec) ? metadata.kernelspec : {};
  const languageInfo = isObject(metadata.language_info) ? metadata.language_info : {};

  return {
    path,
    nbformat: notebook.nbformat,
    nbformatMinor: notebook.nbformat_minor,
    kernelName: typeof kernelspec.name === "string" ? kernelspec.name : null,
    language: typeof languageInfo.name === "string" ? languageInfo.name : null,
    cellCount: notebook.cells.length,
    cells: notebook.cells.map((cell, index) => {
      const source = normalizeSource(cell.source);
      return {
        index,
        id: getCellId(cell, index),
        type: cell.cell_type,
        sourceLines: sourceLineCount(source),
        preview: previewSource(source),
        executionCount: cell.cell_type === "code" ? (cell.execution_count as number | null | undefined) ?? null : undefined,
        outputCount: cell.cell_type === "code" ? Array.isArray(cell.outputs) ? cell.outputs.length : 0 : undefined,
      };
    }),
  };
}

export function formatNotebookSummary(summary: NotebookSummary): string {
  const metadata = [`nbformat=${summary.nbformat}.${summary.nbformatMinor}`, `kernel=${summary.kernelName ?? "-"}`, `cells=${summary.cellCount}`];
  if (summary.language) metadata.push(`language=${summary.language}`);

  const lines = [
    `meta ${metadata.join(" ")}`,
    ...summary.cells.map((cell) => {
      const parts = [
        String(cell.index),
        `id=${cell.id ?? ""}`,
        `type=${cell.type === "markdown" ? "md" : cell.type}`,
        `lines=${cell.sourceLines}`,
      ];
      if (cell.executionCount !== undefined && cell.executionCount !== null) parts.push(`n_exec=${cell.executionCount}`);
      if (cell.outputCount !== undefined) parts.push(`outputs=${cell.outputCount}`);
      parts.push(`preview=${quotePreview(cell.preview)}`);
      return parts.join(" ");
    }),
  ];

  return lines.join("\n");
}

export function formatNotebookRead(path: string, cells: NotebookReadCell | NotebookReadCell[]): string {
  const list = Array.isArray(cells) ? cells : [cells];
  const lines: string[] = [];

  if (Array.isArray(cells)) {
    lines.push(`<notebook path=${quoteAttribute(path)} cells=${quoteAttribute(String(list.length))} />`);
    lines.push("");
  }

  for (const [index, cell] of list.entries()) {
    const attrs = [
      `index=${quoteAttribute(String(cell.index))}`,
      `id=${quoteAttribute(cell.id ?? "")}`,
      `type=${quoteAttribute(cell.type === "markdown" ? "md" : cell.type)}`,
      `lines=${quoteAttribute(String(sourceLineCount(cell.source)))}`,
    ];
    if (cell.executionCount !== undefined && cell.executionCount !== null) {
      attrs.push(`n_exec=${quoteAttribute(String(cell.executionCount))}`);
    }
    lines.push(`<cell ${attrs.join(" ")} />`);
    lines.push(cell.source);
    if (index < list.length - 1) lines.push("");
  }

  return lines.join("\n");
}

export function readAllCells(notebook: Notebook): NotebookReadCell[] {
  return notebook.cells.map((cell, index) => ({
    index,
    id: getCellId(cell, index),
    type: cell.cell_type,
    source: normalizeSource(cell.source),
    executionCount: cell.cell_type === "code" ? (cell.execution_count as number | null | undefined) ?? null : undefined,
  }));
}

function findCellIndexById(notebook: Notebook, cellId: string): number {
  const index = notebook.cells.findIndex((cell, i) => getCellId(cell, i) === cellId);
  if (index === -1) throw new Error(`Cell not found: ${cellId}`);
  return index;
}

export function readCellById(notebook: Notebook, cellId: string): NotebookReadCell {
  const index = findCellIndexById(notebook, cellId);
  const cell = notebook.cells[index]!;
  return {
    index,
    id: getCellId(cell, index),
    type: cell.cell_type,
    source: normalizeSource(cell.source),
    executionCount: cell.cell_type === "code" ? (cell.execution_count as number | null | undefined) ?? null : undefined,
  };
}

export function writeCellSource(notebook: Notebook, cellId: string, source: string): Notebook {
  ensureCellIds(notebook);
  const index = findCellIndexById(notebook, cellId);
  notebook.cells[index] = {
    ...notebook.cells[index],
    source,
  };
  return notebook;
}

function findUniqueMatch(haystack: string, needle: string): { start: number; end: number } {
  const start = haystack.indexOf(needle);
  if (start === -1) throw new Error(`Edit text not found: ${JSON.stringify(needle)}`);
  if (haystack.indexOf(needle, start + 1) !== -1) {
    throw new Error(`Edit text is ambiguous: ${JSON.stringify(needle)}`);
  }
  return { start, end: start + needle.length };
}

export function applyExactSourceEdits(source: string, edits: NotebookSourceEdit[]): string {
  const matches = edits.map((edit) => ({ ...edit, ...findUniqueMatch(source, edit.oldText) }));
  const sorted = [...matches].sort((a, b) => a.start - b.start);

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.start < sorted[index - 1]!.end) {
      throw new Error("Edit ranges overlap");
    }
  }

  let cursor = 0;
  let result = "";
  for (const match of sorted) {
    result += source.slice(cursor, match.start);
    result += match.newText;
    cursor = match.end;
  }
  result += source.slice(cursor);
  return result;
}

export function editCellSource(notebook: Notebook, cellId: string, edits: NotebookSourceEdit[]): Notebook {
  const current = readCellById(notebook, cellId);
  return writeCellSource(notebook, cellId, applyExactSourceEdits(current.source, edits));
}

export function insertCell(notebook: Notebook, target: NotebookInsertTarget, cell: NotebookInsertCell): NotebookReadCell {
  ensureCellIds(notebook);

  if ((target.cellId === undefined) === (target.index === undefined)) {
    throw new Error("Provide exactly one of cellId or index");
  }

  const anchorIndex = target.cellId !== undefined
    ? findCellIndexById(notebook, target.cellId)
    : target.index!;

  if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= notebook.cells.length) {
    throw new Error(`Cell index out of range: ${anchorIndex}`);
  }

  const insertIndex = anchorIndex + (target.direction === "after" ? 1 : 0);
  const id = createCellId(notebook);
  const nextCell: NotebookCell = {
    cell_type: cell.type,
    id,
    metadata: {},
    source: cell.source,
  };

  if (cell.type === "code") {
    nextCell.execution_count = null;
    nextCell.outputs = [];
  }

  notebook.cells.splice(insertIndex, 0, nextCell);
  if (notebook.nbformat_minor < 5) notebook.nbformat_minor = 5;
  return readAllCells(notebook)[insertIndex]!;
}

export function deleteCell(notebook: Notebook, cellId: string): NotebookReadCell {
  ensureCellIds(notebook);
  const index = findCellIndexById(notebook, cellId);
  const deleted = readAllCells(notebook)[index]!;
  notebook.cells.splice(index, 1);
  return deleted;
}

export function moveCell(notebook: Notebook, cellId: string, index: number): NotebookReadCell {
  ensureCellIds(notebook);
  const fromIndex = findCellIndexById(notebook, cellId);
  if (!Number.isInteger(index) || index < 0 || index >= notebook.cells.length) {
    throw new Error(`Cell index out of range: ${index}`);
  }
  const [cell] = notebook.cells.splice(fromIndex, 1);
  notebook.cells.splice(index, 0, cell!);
  return readAllCells(notebook)[index]!;
}

export function mergeCell(notebook: Notebook, cellId: string, direction: "up" | "down"): NotebookMergeResult {
  ensureCellIds(notebook);
  const anchorIndex = findCellIndexById(notebook, cellId);
  const otherIndex = anchorIndex + (direction === "up" ? -1 : 1);

  if (otherIndex < 0 || otherIndex >= notebook.cells.length) {
    throw new Error(`No cell to merge ${direction} from ${cellId}`);
  }

  const anchor = notebook.cells[anchorIndex]!;
  const other = notebook.cells[otherIndex]!;
  if (anchor.cell_type !== other.cell_type) {
    throw new Error(`Cannot merge ${anchor.cell_type} cell with ${other.cell_type} cell`);
  }

  const source = direction === "up"
    ? joinCellSources(normalizeSource(other.source), normalizeSource(anchor.source))
    : joinCellSources(normalizeSource(anchor.source), normalizeSource(other.source));

  notebook.cells[anchorIndex] = { ...anchor, source };
  const removedIndex = otherIndex;
  notebook.cells.splice(removedIndex, 1);
  const mergedIndex = direction === "up" ? anchorIndex - 1 : anchorIndex;

  return {
    merged: readAllCells(notebook)[mergedIndex]!,
    removed: {
      index: otherIndex,
      id: getCellId(other, otherIndex),
      type: other.cell_type,
      source: normalizeSource(other.source),
      executionCount: other.cell_type === "code" ? (other.execution_count as number | null | undefined) ?? null : undefined,
    },
  };
}

export function clearCellOutputs(notebook: Notebook, cellId: string): NotebookReadCell {
  ensureCellIds(notebook);
  const index = findCellIndexById(notebook, cellId);
  const cell = notebook.cells[index]!;
  if (cell.cell_type !== "code") throw new Error(`Cell is not code: ${cellId}`);
  notebook.cells[index] = { ...cell, outputs: [] };
  return readAllCells(notebook)[index]!;
}
