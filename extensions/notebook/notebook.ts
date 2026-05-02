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
  id: string | null;
  type: string;
  source: string;
  executionCount?: number | null;
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
  return source.replace(/\s+/g, " ").trim().slice(0, 120);
}

function sourceLineCount(source: string): number {
  if (source.length === 0) return 0;
  return source.split("\n").length;
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
        id: typeof cell.id === "string" ? cell.id : null,
        type: cell.cell_type,
        sourceLines: sourceLineCount(source),
        preview: previewSource(source),
        executionCount: cell.cell_type === "code" ? (cell.execution_count as number | null | undefined) ?? null : undefined,
        outputCount: cell.cell_type === "code" ? Array.isArray(cell.outputs) ? cell.outputs.length : 0 : undefined,
      };
    }),
  };
}

export function readAllCells(notebook: Notebook): NotebookReadCell[] {
  return notebook.cells.map((cell, index) => ({
    index,
    id: typeof cell.id === "string" ? cell.id : null,
    type: cell.cell_type,
    source: normalizeSource(cell.source),
    executionCount: cell.cell_type === "code" ? (cell.execution_count as number | null | undefined) ?? null : undefined,
  }));
}

export function readCellById(notebook: Notebook, cellId: string): NotebookReadCell {
  const cells = readAllCells(notebook);
  const cell = cells.find((entry) => entry.id === cellId);
  if (!cell) throw new Error(`Cell not found: ${cellId}`);
  return cell;
}
