import { expect, test } from "bun:test"
import { loadNotebook } from "../extensions/notebook/notebook"
import { runNotebookEdit, runNotebookInsert, runNotebookMove, runNotebookRead, runNotebookWrite } from "../extensions/notebook/tools"
import { copyFixture } from "./helpers"

test("no-id notebook can be mutated across tools after id assignment", async () => {
	const fixture = await copyFixture("lovely-test-no-ids.ipynb")

	try {
		await runNotebookWrite({ path: fixture.path, index: 0, source: "# %matplotlib widget\n" })
		await runNotebookEdit({ path: fixture.path, index: 1, edits: [{ oldText: "import numpy as np", newText: "import numpy as numpy" }] })
		const insertResult = await runNotebookInsert({
			path: fixture.path,
			index: 0,
			direction: "after",
			type: "markdown",
			source: "Inserted note\n"
		})
		const inserted = insertResult.details as { id: string }
		await runNotebookMove({ path: fixture.path, cellId: inserted.id, targetIndex: -1, direction: "after" })

		const saved = await loadNotebook(fixture.path)
		expect(saved.nbformat_minor).toBe(5)
		expect(saved.cells.every(cell => typeof cell.id === "string")).toBe(true)

		const readResult = await runNotebookRead({ path: fixture.path })
		expect(readResult.content[0]?.text).toContain("# %matplotlib widget")
		expect(readResult.content[0]?.text).toContain("import numpy as numpy")
		expect(readResult.content[0]?.text).toContain(`id="${inserted.id}" type="md"`)
	} finally {
		await fixture.cleanup()
	}
})
