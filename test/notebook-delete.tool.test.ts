import { expect, test } from "bun:test"
import { runNotebookDelete, runNotebookRead } from "../extensions/notebook/tools"
import { copyFixture, escapeForRegex } from "./helpers"

test("runNotebookDelete returns concise confirmation and removes the cell", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		const result = await runNotebookDelete({ path: fixture.path, cellId: "95cca932" })
		expect(result.content[0]?.text).toBe(`Deleted cell 95cca932 from ${fixture.path}.`)
		await expect(runNotebookRead({ path: fixture.path, cellId: "95cca932" })).rejects.toThrow("Cell not found: 95cca932")
	} finally {
		await fixture.cleanup()
	}
})

test("runNotebookDelete works by index on notebooks without ids", async () => {
	const fixture = await copyFixture("lovely-test-no-ids.ipynb")

	try {
		const result = await runNotebookDelete({ path: fixture.path, index: 0 })
		expect(result.content[0]?.text).toMatch(
			new RegExp(`^Deleted cell index 0 from ${escapeForRegex(fixture.path)}\\.\\nAssigned ids in .*: 0=[0-9a-f]{8} 1=[0-9a-f]{8}$`)
		)
		const remaining = await runNotebookRead({ path: fixture.path })
		expect(remaining.content[0]?.text).toContain('cells="1"')
		expect(remaining.content[0]?.text).toContain('id="')
	} finally {
		await fixture.cleanup()
	}
})

test("runNotebookDelete fails on missing cell id", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		await expect(runNotebookDelete({ path: fixture.path, cellId: "missing" })).rejects.toThrow("Cell not found: missing")
	} finally {
		await fixture.cleanup()
	}
})
