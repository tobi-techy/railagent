import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient, runAgentFlow } from "./flow.js";

const API_BASE_URL = process.env.RAILAGENT_API_URL ?? "http://localhost:3000";

function parseArgs(argv: string[]): { mode: "interactive" | "run"; text?: string; confirm: boolean; sessionId: string } {
  const mode: "interactive" | "run" = argv[0] === "run" ? "run" : "interactive";

  let text: string | undefined;
  let confirm = false;
  let sessionId = process.env.RAILAGENT_SESSION_ID ?? "demo-session";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--text") {
      text = argv[i + 1];
      i += 1;
    }
    if (arg === "--confirm") {
      confirm = true;
    }
    if (arg === "--session-id") {
      sessionId = argv[i + 1] ?? sessionId;
      i += 1;
    }
  }

  return { mode, text, confirm, sessionId };
}

async function runOneShot(text: string, confirm: boolean, sessionId: string): Promise<void> {
  const client = createClient(API_BASE_URL);
  const result = await runAgentFlow(client, text, { confirm, sessionId });
  result.lines.forEach((line) => console.log(line));
}

async function runInteractive(sessionId: string): Promise<void> {
  const rl = createInterface({ input, output });
  const client = createClient(API_BASE_URL);

  console.log("RailAgent Natural-Language Demo Agent");
  console.log(`Session: ${sessionId}`);
  console.log('Speak naturally in EN/ES/PT/FR, or "exit" to quit.');

  while (true) {
    const text = (await rl.question("> ")).trim();
    if (!text) continue;
    if (text.toLowerCase() === "exit") break;

    const preview = await runAgentFlow(client, text, { confirm: false, sessionId });
    preview.lines.forEach((line) => console.log(line));

    if (preview.needsConfirmation) {
      const answer = (await rl.question("Execute transfer? (y/n): ")).trim().toLowerCase();
      if (answer === "y" || answer === "yes") {
        const finalResult = await runAgentFlow(client, text, { confirm: true, sessionId });
        finalResult.lines.forEach((line) => console.log(line));
      } else {
        console.log("Okay, keeping the quote in session memory.");
      }
    }
  }

  rl.close();
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.mode === "run") {
    if (!parsed.text) {
      console.error('Missing --text. Example: pnpm -C apps/demo-agent run --text "sned 100 usd to my mom in manila" --session-id judge-1 --confirm');
      process.exitCode = 1;
      return;
    }

    await runOneShot(parsed.text, parsed.confirm, parsed.sessionId);
    return;
  }

  await runInteractive(parsed.sessionId);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
