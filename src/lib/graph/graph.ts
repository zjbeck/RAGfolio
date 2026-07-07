import { END, START, StateGraph } from "@langchain/langgraph";
import corpusConfig from "@config";
import {
  analyze,
  filterChunks,
  grade,
  makeAnswer,
  refuse,
  retrieve,
  route,
} from "./nodes";
import { PipelineState } from "./state";

export interface GraphOptions {
  /** Override the Answer node's thinking budget (default: corpus.config.ts). */
  answerThinkingBudget?: number;
}

/**
 * The six-node pipeline:
 *
 *   analyze → filter → retrieve → grade → route ─┬→ answer → END
 *                                                └→ refuse → END
 *
 * Route is a real node (it records the decision into state, visible in the
 * update stream); the conditional edge after it just reads that decision.
 * Stream with `streamMode: ["updates", "messages"]` — one stream carries
 * node-level updates for the panel and LLM tokens for the chat. (LangGraph v1
 * replaced the spec's streamEvents with stream modes; flagged in CLAUDE.md.)
 *
 * LangSmith tracing activates automatically via LANGSMITH_API_KEY /
 * LANGSMITH_TRACING env vars; absent, it is a silent no-op — no code here.
 */
export function buildGraph(options: GraphOptions = {}) {
  const answerThinkingBudget =
    options.answerThinkingBudget ?? corpusConfig.answerThinkingBudget;

  // Node names are the spec's display names (capitalized) — state channels
  // ("filter", "route", …) share LangGraph's namespace with node names, and
  // the capitalization keeps the two apart without renaming either.
  return new StateGraph(PipelineState)
    .addNode("Analyze", analyze)
    .addNode("Filter", filterChunks)
    .addNode("Retrieve", retrieve)
    .addNode("Grade", grade)
    .addNode("Route", route)
    .addNode("Answer", makeAnswer(answerThinkingBudget))
    .addNode("Refuse", refuse)
    .addEdge(START, "Analyze")
    .addEdge("Analyze", "Filter")
    .addEdge("Filter", "Retrieve")
    .addEdge("Retrieve", "Grade")
    .addEdge("Grade", "Route")
    .addConditionalEdges(
      "Route",
      (state) => (state.route === "answer" ? "Answer" : "Refuse"),
      ["Answer", "Refuse"]
    )
    .addEdge("Answer", END)
    .addEdge("Refuse", END)
    .compile();
}
