/**
 * CLI for the retrieval pipeline — exists before any UI, per the build spec.
 * Streams the same two channels the web app will consume: node-level state
 * updates ("updates") and LLM tokens ("messages"), from ONE graph stream.
 *
 * Usage:
 *   npm run ask -- "How do I calibrate a soil-moisture sensor?"
 *   npm run ask -- "..." --budget 256     # A/B the Answer node's thinking budget
 *
 * The usage summary at the end is the empirical check that thinking stays
 * off: reasoning tokens must be 0 for analyze and grade (and for answer at
 * the default budget 0).
 */
import type { AIMessageChunk } from "@langchain/core/messages";
import { buildGraph } from "../src/lib/graph/graph";
import type {
  Citation,
  NodeUsage,
  PipelineStateType,
} from "../src/lib/graph/state";
import { describeFilter } from "../src/copy";
import { loadEnvLocal } from "./load-env";

function formatNodeLine(node: string, update: Partial<PipelineStateType>): string {
  switch (node) {
    case "Analyze":
      return `intent=${update.intent} filter: ${describeFilter(update.filter ?? null)}`;
    case "Filter":
      return update.filterRelaxed
        ? `0 matches → filter relaxed → ${update.filterMatchCount} chunks`
        : `→ ${update.filterMatchCount} chunks`;
    case "Retrieve": {
      const top = update.chunks?.[0];
      return top
        ? `${update.chunks!.length} chunks (top: ${top.id} ${top.score.toFixed(3)})`
        : "0 chunks";
    }
    case "Grade":
      return `verdict: ${update.verdict}`;
    case "Route":
      return `→ ${update.route}`;
    default:
      return "";
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const budgetIndex = args.indexOf("--budget");
  let answerThinkingBudget: number | undefined;
  if (budgetIndex !== -1) {
    answerThinkingBudget = Number(args[budgetIndex + 1]);
    if (!Number.isInteger(answerThinkingBudget) || answerThinkingBudget < 0) {
      console.error("--budget requires a non-negative integer");
      process.exit(1);
    }
    args.splice(budgetIndex, 2);
  }
  const question = args.join(" ").trim();
  if (!question) {
    console.error('usage: npm run ask -- "your question" [--budget N]');
    process.exit(1);
  }

  const graph = buildGraph({ answerThinkingBudget });
  let usage: Record<string, NodeUsage> = {};
  let citations: Citation[] = [];
  let refusal: string | null = null;
  let streamedAnswer = false;

  const stream = await graph.stream(
    { question },
    { streamMode: ["updates", "messages"] as const }
  );

  for await (const [mode, payload] of stream) {
    if (mode === "updates") {
      const updates = payload as Record<string, Partial<PipelineStateType>>;
      for (const [node, update] of Object.entries(updates)) {
        if (update.usage) usage = update.usage;
        if (node === "Answer") {
          citations = update.citations ?? [];
        } else if (node === "Refuse") {
          refusal = update.answer ?? null;
          citations = [];
        } else {
          console.log(`● ${node.padEnd(9)} ${formatNodeLine(node, update)}`);
        }
      }
    } else if (mode === "messages") {
      const [chunk, metadata] = payload as [
        AIMessageChunk,
        { langgraph_node?: string },
      ];
      const node = metadata.langgraph_node ?? "?";

      // Only the Answer node's tokens are display text; usage arrives via
      // state updates (each LLM node reports its own).
      if (node === "Answer" && typeof chunk.content === "string" && chunk.content) {
        if (!streamedAnswer) {
          console.log(`● Answer    (streaming)\n`);
          streamedAnswer = true;
        }
        process.stdout.write(chunk.content);
      }
    }
  }

  if (refusal) {
    console.log(`● Refuse\n\n${refusal}`);
  } else {
    process.stdout.write("\n");
  }

  if (citations.length > 0) {
    console.log(`\nsources:`);
    for (const c of citations) {
      const anchor = c.anchorId ? `#${c.anchorId}` : "";
      console.log(`  [${c.ref}] ${c.collection}/${c.docSlug}${anchor} — ${c.label}`);
    }
  }

  const usageEntries = Object.entries(usage);
  if (usageEntries.length > 0) {
    const parts = usageEntries.map(
      ([node, u]) =>
        `${node} ${u.inputTokens}in/${u.outputTokens}out (reasoning: ${u.reasoningTokens})`
    );
    console.log(`\nusage: ${parts.join(" · ")}`);
    const thinkingLeak = usageEntries.filter(
      ([node, u]) =>
        u.reasoningTokens > 0 && (node === "Analyze" || node === "Grade")
    );
    if (thinkingLeak.length > 0) {
      console.error(
        `\n⚠ thinking tokens detected on ${thinkingLeak
          .map(([n]) => n)
          .join(", ")} — thinkingBudget 0 is not being honored`
      );
      process.exit(2);
    }
  }
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
