import { expect, test } from "bun:test"
import { join } from "node:path"
import { runNotebookRead } from "../extensions/notebook/tools"
import { FIXTURE_DIR } from "./helpers"

test("runNotebookRead returns raw single-cell source block", async () => {
	const result = await runNotebookRead({ path: join(FIXTURE_DIR, "lovely-history.ipynb"), cellId: "95cca932" })
	expect(result.content[0]?.text).toContain('<cell index="4" id="95cca932" type="code" lines="3" />')
	expect(result.content[0]?.text).toContain('# |eval: false\nt = torch.tensor(10, device="cuda")\nt')
})

test("runNotebookRead returns notebook wrapper for full read", async () => {
	const result = await runNotebookRead({ path: join(FIXTURE_DIR, "lovely-test-no-ids.ipynb") })
	expect(result.content[0]?.text).toContain("<notebook path=")
	expect(result.content[0]?.text).toContain('<cell index="0" type="code" lines="1" n_exec="1" />')
	expect(result.content[0]?.text).toContain("# %matplotlib inline")
})

test("runNotebookRead supports multiple ids and ranges", async () => {
	const byIds = await runNotebookRead({ path: join(FIXTURE_DIR, "lovely-history.ipynb"), cellIds: ["95cca932", "9fd3e324"] })
	expect(byIds.content[0]?.text).toContain('<notebook path="')
	expect(byIds.content[0]?.text).toContain('<cell index="4" id="95cca932" type="code" lines="3" />')
	expect(byIds.content[0]?.text).toContain('<cell index="7" id="9fd3e324" type="md" lines="5" />')

	const byRange = await runNotebookRead({ path: join(FIXTURE_DIR, "lovely-history.ipynb"), startIndex: 3, endIndex: 4 })
	expect(byRange.content[0]?.text).toContain('<cell index="3" id="ffd208cf" type="code" lines="2" />')
	expect(byRange.content[0]?.text).toContain('<cell index="4" id="95cca932" type="code" lines="3" />')
})

test("runNotebookRead rejects conflicting or incomplete selectors", async () => {
	await expect(
		runNotebookRead({
			path: join(FIXTURE_DIR, "lovely-history.ipynb"),
			cellId: "95cca932",
			cellIds: ["9fd3e324"]
		})
	).rejects.toThrow("Provide at most one read selector: cellId, cellIds, or startIndex/endIndex")

	await expect(
		runNotebookRead({
			path: join(FIXTURE_DIR, "lovely-history.ipynb"),
			startIndex: 3
		})
	).rejects.toThrow("Provide both startIndex and endIndex for range reads")
})

test("runNotebookRead fails on missing cell id", async () => {
	await expect(runNotebookRead({ path: join(FIXTURE_DIR, "lovely-history.ipynb"), cellId: "missing" })).rejects.toThrow(
		"Cell not found: missing"
	)
})
