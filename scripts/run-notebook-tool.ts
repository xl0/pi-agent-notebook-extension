import { notebookToolRunners, type NotebookToolName } from "../extensions/notebook/tools";

const [toolName, jsonArgs] = process.argv.slice(2);

if (!toolName || !jsonArgs) {
  console.error("Usage: bun scripts/run-notebook-tool.ts <tool-name> '<json-args>'");
  process.exit(1);
}

if (!(toolName in notebookToolRunners)) {
  console.error(`Unknown tool: ${toolName}`);
  process.exit(1);
}

const args = JSON.parse(jsonArgs) as object;
const result = await notebookToolRunners[toolName as NotebookToolName](args as never);
for (const part of result.content) {
  if (part.type === "text") process.stdout.write(`${part.text}\n`);
}
