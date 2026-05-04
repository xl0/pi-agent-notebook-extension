import { expect, test } from "bun:test"
import { join } from "node:path"
import { runNotebookSummary } from "../extensions/notebook/tools"
import { copyFixture, FIXTURE_DIR } from "./helpers"

test("runNotebookSummary reports cleared outputs", async () => {
	const fixture = await copyFixture("lovely-history.ipynb")

	try {
		const summary = await runNotebookSummary({ path: fixture.path })
		expect(summary.content[0]?.text).toContain("meta nbformat=4.5 kernel=python3 cells=12")
		expect(summary.content[0]?.text).toContain('<cell index="4" id="95cca932" type="code" lines="3" outputs="1" />')
	} finally {
		await fixture.cleanup()
	}
})

test("runNotebookSummary works on fixture path", async () => {
	const result = await runNotebookSummary({ path: join(FIXTURE_DIR, "lovely-history.ipynb") })
	expect(result.content[0]?.text).toContain('<cell index="0" id="20735603" type="md"')
})
