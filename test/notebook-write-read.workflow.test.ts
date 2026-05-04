import { expect, test } from "bun:test"
import { runNotebookReadCell, runNotebookWriteCell } from "../extensions/notebook/tools"
import { copyFixture } from "./helpers"

test("code write then read preserves exact source", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		const source = '# |eval: false\nt = torch.tensor(42, device="cuda")\nt\n'
		await runNotebookWriteCell({ path: fixture.path, cellId: "95cca932", source })
		const result = await runNotebookReadCell({ path: fixture.path, cellId: "95cca932" })
		expect(result.content[0]?.text).toBe(source)
	} finally {
		await fixture.cleanup()
	}
})

test("markdown write then read preserves exact source", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		const source = "line 1\\\nline 2\n\n> quote\n"
		await runNotebookWriteCell({ path: fixture.path, cellId: "9fd3e324", source })
		const result = await runNotebookReadCell({ path: fixture.path, cellId: "9fd3e324" })
		expect(result.content[0]?.text).toBe(source)
	} finally {
		await fixture.cleanup()
	}
})
