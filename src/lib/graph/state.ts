import { StateSchema } from "@langchain/langgraph";
import { z } from "zod";
import type { ScoredChunk } from "@/lib/corpus/retrieval";
import type { FacetFilter } from "@/lib/corpus/types";

/** A citation rendered as a pill: deep-links to docSlug + anchorId. */
export interface Citation {
  /** The [n] source number used inline in the answer text. */
  ref: number;
  collection: string;
  docSlug: string;
  anchorId: string;
  label: string;
}

/** Token usage one LLM-calling node reports about itself. */
export interface NodeUsage {
  inputTokens: number;
  outputTokens: number;
  /** Thinking tokens — must be 0 wherever thinkingBudget is 0. */
  reasoningTokens: number;
}

/**
 * Typed pipeline state. The spec's core fields (question, filter, chunks,
 * verdict, answer) plus the fields the RAG Panel displays: intent (Analyze's
 * classification), filterMatchCount (Filter's result), route (the recorded
 * routing decision), and citations (parsed by Answer).
 */
export const PipelineState = new StateSchema({
  question: z.string().default(""),
  /**
   * Set by Analyze before Filter/Retrieve run (V2 Phase 5 task 1). Only
   * "on-topic" proceeds through the rest of the pipeline; "off-topic" and
   * "adversarial" short-circuit straight to Redirect, skipping Filter,
   * Retrieve, Grade, Route, and Answer entirely.
   */
  topicality: z.enum(["on-topic", "off-topic", "adversarial"]).nullable().default(null),
  intent: z.string().nullable().default(null),
  filter: z.custom<FacetFilter | null>().default(null),
  filterMatchCount: z.number().default(0),
  /** True when the extracted filter matched nothing and was dropped (recorded, never silent). */
  filterRelaxed: z.boolean().default(false),
  chunks: z.custom<ScoredChunk[]>().default(() => []),
  verdict: z.enum(["sufficient", "insufficient"]).nullable().default(null),
  route: z.enum(["answer", "refuse"]).nullable().default(null),
  answer: z.string().default(""),
  citations: z.custom<Citation[]>().default(() => []),
  /**
   * Per-node token usage, merged by each LLM node (the graph is sequential,
   * so spread-merge on a last-value channel is safe). Surfaces in the raw
   * trace and lets the CLI/evals assert thinking stays off.
   */
  usage: z.custom<Record<string, NodeUsage>>().default(() => ({})),
});

export type PipelineStateType = typeof PipelineState.State;
