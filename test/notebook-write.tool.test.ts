import { expect, test } from "bun:test"
import { loadNotebook } from "../extensions/notebook/notebook"
import { runNotebookRead, runNotebookWrite } from "../extensions/notebook/tools"
import { copyFixture, escapeForRegex } from "./helpers"

test("runNotebookWrite returns concise confirmation", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		const result = await runNotebookWrite({ path: fixture.path, cellId: "95cca932", source: "x\n" })
		expect(result.content[0]?.text).toBe(`Wrote cell 95cca932 in ${fixture.path}.`)
	} finally {
		await fixture.cleanup()
	}
})

test("runNotebookWrite fails on missing cell id", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		await expect(runNotebookWrite({ path: fixture.path, cellId: "missing", source: "x" })).rejects.toThrow("Cell not found: missing")
	} finally {
		await fixture.cleanup()
	}
})

test("runNotebookWrite persists ids and writes by index on notebooks without ids", async () => {
	const fixture = await copyFixture("lovely-test-no-ids.ipynb")

	try {
		const writeResult = await runNotebookWrite({ path: fixture.path, index: 0, source: "# %matplotlib widget\n" })
		expect(writeResult.content[0]?.text).toMatch(
			new RegExp(`^Wrote cell index 0 in ${escapeForRegex(fixture.path)}\\.\\nAssigned ids in .*: 0=[0-9a-f]{8} 1=[0-9a-f]{8}$`)
		)
		const saved = await loadNotebook(fixture.path)
		expect(saved.nbformat_minor).toBe(5)
		expect(saved.cells[0]?.id).toMatch(/^[0-9a-f]{8}$/)
		expect(saved.cells[1]?.id).toMatch(/^[0-9a-f]{8}$/)
		expect(Array.isArray(saved.cells[0]?.source)).toBe(true)

		const result = await runNotebookRead({ path: fixture.path, startIndex: 0, endIndex: 0 })
		expect(result.content[0]?.text).toBe(
			'<notebook path="' +
				fixture.path +
				'" cells="1" />\n\n<cell index="0" id="' +
				saved.cells[0]?.id +
				'" type="code" lines="2" n_exec="1" />\n# %matplotlib widget\n'
		)
	} finally {
		await fixture.cleanup()
	}
})
