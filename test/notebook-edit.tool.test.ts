import { expect, test } from "bun:test"
import { loadNotebook, readAllCells } from "../extensions/notebook/notebook"
import { runNotebookEdit } from "../extensions/notebook/tools"
import { copyFixture } from "./helpers"

test("runNotebookEdit works by index on notebooks without ids", async () => {
	const fixture = await copyFixture("lovely-test-no-ids.ipynb")

	try {
		const result = await runNotebookEdit({
			path: fixture.path,
			index: 1,
			edits: [{ oldText: "import numpy as np", newText: "import numpy as numpy" }]
		})
		expect(result.content[0]?.text).toContain(`Successfully replaced 1 block(s) in cell index 1 of ${fixture.path}.`)
		expect(result.content[0]?.text).toMatch(/Assigned ids in .*: 0=[0-9a-f]{8} 1=[0-9a-f]{8}$/)
		expect(readAllCells(await loadNotebook(fixture.path))[1]?.source).toContain("import numpy as numpy")
	} finally {
		await fixture.cleanup()
	}
})
