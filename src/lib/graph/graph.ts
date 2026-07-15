import { END, START, StateGraph } from "@langchain/langgraph";
import corpusConfig from "@config";
import {
  analyze,
  filterChunks,
  grade,
  makeAnswer,
  redirect,
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
 * The pipeline:
 *
 *   analyze ─┬→ (off-topic/adversarial) → redirect → END
 *            └→ (on-topic) → filter → retrieve → grade → route ─┬→ answer → END
 *                                                                └→ refuse → END
 *
 * Route is a real node (it records the decision into state, visible in the
 * update stream); the conditional edges after Analyze and Route just read the
 * decisions those nodes already recorded. Off-topic/adversarial questions
 * short-circuit straight from Analyze to Redirect (V2 Phase 5 task 1) —
 * Filter, Retrieve, Grade, Route, and Answer never run, cutting one LLM call
 * total instead of two or three, and answering honestly rather than
 * stretching Refuse's "searched and found nothing" framing over a question
 * that was never about the corpus in the first place.
 *
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
    .addNode("Redirect", redirect)
    .addEdge(START, "Analyze")
    .addConditionalEdges(
      "Analyze",
      (state) => (state.topicality === "on-topic" ? "Filter" : "Redirect"),
      ["Filter", "Redirect"]
    )
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
    .addEdge("Redirect", END)
    .compile();
}
