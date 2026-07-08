/**
 * Eval harness: run a question set through the graph and assert expected
 * source docs retrieved / correct refusals. Runs locally, and traces to
 * LangSmith as a labeled experiment when LANGSMITH_API_KEY is present. Supports
 * A/B on the Answer node's thinking budget.
 *
 *   npm run eval                         # default budget from corpus.config
 *   npm run eval -- --budget 0,256       # A/B two Answer thinking budgets
 *   npm run eval -- --evals path.json    # a different eval set
 *   npm run eval -- --delay 15           # seconds between cases (rate limits)
 *
 * Free-tier note: gemini-3.5-flash allows ~5 requests/min and 20/day; each
 * case costs 2–3 chat calls, so the full example set needs more than the free
 * daily quota. Pace with --delay and/or run subsets, or use a paid tier.
 */
import fs from "node:fs";
import path from "node:path";
import corpusConfig from "../corpus.config";
import { buildGraph } from "../src/lib/graph/graph";
import type { PipelineStateType } from "../src/lib/graph/state";
import type { FacetFilter } from "../src/lib/corpus/types";
import { loadEnvLocal } from "./load-env";

interface EvalCase {
  id: string;
  question: string;
  expect: {
    retrieve?: string[];
    filter?: FacetFilter;
    refuse?: boolean;
  };
}

interface CaseResult {
  id: string;
  passed: boolean;
  reasons: string[];
  answerTokens: number;
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  const take = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    if (i === -1) return undefined;
    const value = args[i + 1];
    args.splice(i, 2);
    return value;
  };
  const budgetArg = take("--budget");
  const evalsArg = take("--evals");
  const delayArg = take("--delay");
  const dryRun = args.includes("--dry-run");
  return {
    budgets: budgetArg
      ? budgetArg.split(",").map((s) => Number(s.trim()))
      : [corpusConfig.answerThinkingBudget],
    evalsPath: evalsArg ?? "evals/verdant.evals.json",
    delayMs: delayArg ? Number(delayArg) * 1000 : 12_000,
    dryRun,
  };
}

/** Print what would run, without invoking the graph (no chat calls). */
function dryRun(cases: EvalCase[], budgets: number[]): void {
  console.log(`Eval set: ${cases.length} cases · budgets: ${budgets.join(", ")}\n`);
  for (const c of cases) {
    const kind = c.expect.refuse
      ? "refuse"
      : c.expect.filter
        ? `filter ${JSON.stringify(c.expect.filter)} → ${c.expect.retrieve?.join(", ")}`
        : `retrieve ${c.expect.retrieve?.join(", ")}`;
    console.log(`  ${c.id.padEnd(28)} ${kind}`);
  }
  console.log(
    `\nDry run — no graph invoked. Remove --dry-run to execute (${
      cases.length
    } cases × ${budgets.length} budget${budgets.length === 1 ? "" : "s"} = ${
      cases.length * budgets.length
    } runs, 2–3 chat calls each).`
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function evaluateCase(
  testCase: EvalCase,
  state: PipelineStateType
): { reasons: string[] } {
  const reasons: string[] = [];
  const { expect } = testCase;

  if (expect.refuse) {
    if (state.route !== "refuse") {
      reasons.push(`expected refusal, but routed to ${state.route}`);
    }
  }

  if (expect.filter) {
    for (const [key, value] of Object.entries(expect.filter)) {
      if (state.filter?.[key] !== value) {
        reasons.push(
          `filter ${key}=${value} not extracted (got ${
            state.filter ? JSON.stringify(state.filter) : "no filter"
          })`
        );
      }
    }
  }

  if (expect.retrieve) {
    const retrieved = new Set(
      state.chunks.map((c) => `${c.collection}/${c.docSlug}`)
    );
    for (const docId of expect.retrieve) {
      if (!retrieved.has(docId)) {
        reasons.push(`expected ${docId} retrieved, but it was not`);
      }
    }
  }

  return { reasons };
}

async function runBudget(
  budget: number,
  cases: EvalCase[],
  delayMs: number
): Promise<CaseResult[]> {
  const graph = buildGraph({ answerThinkingBudget: budget });
  const results: CaseResult[] = [];

  for (const [i, testCase] of cases.entries()) {
    if (i > 0) await delay(delayMs); // pace to respect rate limits
    try {
      const state = (await graph.invoke(
        { question: testCase.question },
        {
          runName: `eval:${testCase.id}`,
          tags: ["ragfolio-eval", `budget:${budget}`],
          metadata: { evalCase: testCase.id, answerThinkingBudget: budget },
        }
      )) as PipelineStateType;
      const { reasons } = evaluateCase(testCase, state);
      results.push({
        id: testCase.id,
        passed: reasons.length === 0,
        reasons,
        answerTokens: state.usage.Answer?.outputTokens ?? 0,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        passed: false,
        reasons: [`error: ${error instanceof Error ? error.message : String(error)}`],
        answerTokens: 0,
      });
    }
  }
  return results;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { budgets, evalsPath, delayMs, dryRun: isDryRun } = parseArgs(
    process.argv.slice(2)
  );

  const file = path.resolve(process.cwd(), evalsPath);
  const { cases } = JSON.parse(fs.readFileSync(file, "utf8")) as {
    cases: EvalCase[];
  };

  if (isDryRun) {
    dryRun(cases, budgets);
    return;
  }

  if (process.env.LANGSMITH_API_KEY) {
    console.log("LangSmith key present — runs are traced (tag: ragfolio-eval).\n");
  }

  let anyFailed = false;
  for (const budget of budgets) {
    console.log(`── Answer thinking budget: ${budget} ──`);
    const results = await runBudget(budget, cases, delayMs);

    for (const r of results) {
      const mark = r.passed ? "✓" : "✗";
      console.log(`  ${mark} ${r.id}`);
      for (const reason of r.reasons) console.log(`      ${reason}`);
    }

    const passed = results.filter((r) => r.passed).length;
    const tokens = results.reduce((sum, r) => sum + r.answerTokens, 0);
    console.log(
      `  ${results.length} cases: ${passed} passed, ${results.length - passed} failed · answer tokens: ${tokens}\n`
    );
    if (passed < results.length) anyFailed = true;
  }

  process.exit(anyFailed ? 1 : 0);
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
