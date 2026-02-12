import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient, runAgentFlow } from "./flow.js";

const API_BASE_URL = process.env.RAILAGENT_API_URL ?? "http://localhost:3000";

function parseArgs(argv: string[]): { mode: "interactive" | "run"; text?: string; confirm: boolean } {
  const mode: "interactive" | "run" = argv[0] === "run" ? "run" : "interactive";

  let text: string | undefined;
  let confirm = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--text") {
      text = argv[i + 1];
      i += 1;
    }
    if (arg === "--confirm") {
      confirm = true;
    }
  }

  return { mode, text, confirm };
}

async function runOneShot(text: string, confirm: boolean): Promise<void> {
  const client = createClient(API_BASE_URL);
  const result = await runAgentFlow(client, text, { confirm });
  result.lines.forEach((line) => console.log(line));
}

async function runInteractive(): Promise<void> {
  const rl = createInterface({ input, output });
  const client = createClient(API_BASE_URL);

  console.log("RailAgent Demo Agent");
  console.log('Type a transfer request, or "exit" to quit.');

  while (true) {
    const text = (await rl.question("> ")).trim();
    if (!text) continue;
    if (text.toLowerCase() === "exit") break;

    const preview = await runAgentFlow(client, text, { confirm: false });
    preview.lines.forEach((line) => console.log(line));

    if (preview.needsConfirmation) {
      const answer = (await rl.question("Execute transfer? (y/n): ")).trim().toLowerCase();
      if (answer === "y" || answer === "yes") {
        const finalResult = await runAgentFlow(client, text, { confirm: true });
        finalResult.lines.forEach((line) => console.log(line));
      } else {
        console.log("Cancelled.");
      }
    }
  }

  rl.close();
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.mode === "run") {
    if (!parsed.text) {
      console.error('Missing --text. Example: pnpm -C apps/demo-agent run --text "send 100 usd to php to maria" --confirm');
      process.exitCode = 1;
      return;
    }

    await runOneShot(parsed.text, parsed.confirm);
    return;
  }

  await runInteractive();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
