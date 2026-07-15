import { z } from "zod";
import corpusConfig from "@config";
import { copy } from "@/copy";
import { chatModel } from "@/lib/providers/chat";
import { embeddings } from "@/lib/providers/embeddings";
import {
  applyFacetFilter,
  loadCorpus,
  topK,
} from "@/lib/corpus/retrieval";
import type { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { FacetFilter } from "@/lib/corpus/types";
import type { Citation, NodeUsage, PipelineStateType } from "./state";

// Analyze and Grade run with thinking OFF (budget 0) — verified empirically:
// the API accepts thinkingBudget 0 and reports no thought tokens on Gemini
// (Groq has no equivalent concept; see providers/chat.ts). The Answer node's
// budget comes from corpus.config.ts (default 0); the eval harness A/Bs it
// against modest budgets.

type StateUpdate = Partial<PipelineStateType>;

/**
 * Extract usage from a message. Verified empirically: @langchain/google-genai
 * does not map Gemini thought tokens into output_token_details.reasoning —
 * they only show up in total_tokens (raw SDK: thoughtsTokenCount). Reasoning
 * is therefore recovered as total − input − output, so the thinking-off
 * assertion catches leaks regardless of how the integration labels them.
 */
function usageOf(message: AIMessage | AIMessageChunk | undefined): NodeUsage {
  const usage = message?.usage_metadata;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const explicit = usage?.output_token_details?.reasoning ?? 0;
  const hidden = Math.max(
    0,
    (usage?.total_tokens ?? inputTokens + outputTokens) - inputTokens - outputTokens
  );
  return { inputTokens, outputTokens, reasoningTokens: Math.max(explicit, hidden) };
}

// ── 1. Analyze ───────────────────────────────────────────────────────────────
// Classify intent and extract a facet filter (self-query style) using only
// the vocabulary declared in corpus.config.ts.

const INTENTS = ["how-to", "factual", "conceptual", "debugging", "other"] as const;

function buildAnalyzeSchema() {
  const facetShape = Object.fromEntries(
    Object.entries(corpusConfig.facets).map(([key, vocabulary]) => [
      key,
      z
        .enum(vocabulary as [string, ...string[]])
        .nullable()
        .describe(
          `Set only if the question clearly targets one ${key}; otherwise null.`
        ),
    ])
  );
  return z.object({
    intent: z.enum(INTENTS).describe("The kind of question being asked."),
    filter: z.object(facetShape),
  });
}

export async function analyze(
  state: PipelineStateType,
  config?: RunnableConfig
): Promise<StateUpdate> {
  const schema = buildAnalyzeSchema();
  const vocabulary = Object.entries(corpusConfig.facets)
    .map(([key, values]) => `- ${key}: ${values.join(", ")}`)
    .join("\n");

  const result = await chatModel(0)
    .withStructuredOutput(schema, { includeRaw: true })
    .invoke(
      [
        {
          role: "system",
          content:
            `You classify questions asked of a documentation site and extract a metadata filter.\n` +
            `Available facets and their only allowed values:\n${vocabulary}\n\n` +
            `Filters narrow the search — a wrong filter hides the right answer. Set a facet ` +
            `only when the question EXPLICITLY names it: a subject-matter facet needs the ` +
            `subject named ("soil-moisture sensor" → module: sensors), and doc_type needs a ` +
            `document kind named ("in the release notes", "the API reference for…"). ` +
            `Question phrasing is not a doc_type: "how do I…" does NOT mean guide. ` +
            `When in doubt, null — retrieval over everything beats retrieval over the wrong slice.`,
        },
        { role: "user", content: state.question },
      ],
      config
    );

  // Drop nulls; an empty filter is recorded as null (no filter applied).
  const entries = Object.entries(result.parsed.filter).filter(
    (entry): entry is [string, string] => entry[1] != null
  );
  const filter: FacetFilter | null =
    entries.length > 0 ? Object.fromEntries(entries) : null;

  return {
    intent: result.parsed.intent,
    filter,
    usage: { ...state.usage, Analyze: usageOf(result.raw as AIMessage) },
  };
}

// ── 2. Filter ────────────────────────────────────────────────────────────────
// Pure narrowing: record how many chunks survive the facet filter. Retrieve
// re-derives the filtered set (cheap, in-memory) so state stays light.
// A filter that matches nothing is dropped rather than obeyed — recorded as
// filterRelaxed, never silent — because refusing an answerable question over
// a self-inflicted over-narrow filter helps no one.

export async function filterChunks(
  state: PipelineStateType
): Promise<StateUpdate> {
  const corpus = loadCorpus();
  const matching = applyFacetFilter(corpus.chunks, state.filter);
  if (matching.length === 0 && state.filter !== null) {
    return {
      filter: null,
      filterRelaxed: true,
      filterMatchCount: corpus.chunks.length,
    };
  }
  return { filterMatchCount: matching.length };
}

// ── 3. Retrieve ──────────────────────────────────────────────────────────────
// Cosine top-k within the filtered set.

export async function retrieve(
  state: PipelineStateType,
  config?: RunnableConfig
): Promise<StateUpdate> {
  const corpus = loadCorpus();
  const candidates = applyFacetFilter(corpus.chunks, state.filter);
  if (candidates.length === 0) return { chunks: [] };
  const queryEmbedding = await embeddings.embedQuery(state.question, config?.signal);
  return { chunks: topK(queryEmbedding, candidates, corpusConfig.k) };
}

// ── 4. Grade ─────────────────────────────────────────────────────────────────
// A separate LLM judgment — deliberately not a similarity threshold. Zero
// retrieved chunks short-circuits to insufficient without spending a call.

const gradeSchema = z.object({
  verdict: z
    .enum(["sufficient", "insufficient"])
    .describe(
      "sufficient only if the excerpts contain the information needed to answer."
    ),
});

export async function grade(
  state: PipelineStateType,
  config?: RunnableConfig
): Promise<StateUpdate> {
  if (state.chunks.length === 0) return { verdict: "insufficient" };

  const excerpts = state.chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.id}\n${chunk.text}`)
    .join("\n\n");

  const result = await chatModel(0)
    .withStructuredOutput(gradeSchema, { includeRaw: true })
    .invoke(
      [
        {
          role: "system",
          content:
            `You judge whether documentation excerpts can answer a question. ` +
            `"sufficient" means the excerpts themselves contain the needed information — ` +
            `not that they are merely related to the topic.`,
        },
        {
          role: "user",
          content: `Question: ${state.question}\n\nExcerpts:\n\n${excerpts}`,
        },
      ],
      config
    );

  return {
    verdict: result.parsed.verdict,
    usage: { ...state.usage, Grade: usageOf(result.raw as AIMessage) },
  };
}

// ── 5. Route ─────────────────────────────────────────────────────────────────
// A real pass-through node (not just an edge) so the routing decision is
// visible in the update stream the panel consumes.

export async function route(state: PipelineStateType): Promise<StateUpdate> {
  return { route: state.verdict === "sufficient" ? "answer" : "refuse" };
}

// ── 6a. Answer ───────────────────────────────────────────────────────────────
// Cited response. The model streams (tokens flow out via the graph's
// "messages" stream mode) and cites sources as [n]; markers are parsed into
// Citation objects afterward. If the model cites nothing, every retrieved
// chunk is cited — the answer was generated from exactly that set. (Recorded
// decision: retrieved-set fallback keeps pills honest without a second pass.)

function citationLabel(chunk: PipelineStateType["chunks"][number], title: string): string {
  const headingTail = chunk.headingPath.at(-1);
  return headingTail ? `${title} › ${headingTail}` : title;
}

export function makeAnswer(thinkingBudget: number) {
  return async function answer(
    state: PipelineStateType,
    config?: RunnableConfig
  ): Promise<StateUpdate> {
    const corpus = loadCorpus();
    const titles = new Map(
      corpus.docs.map((d) => [`${d.collection}/${d.docSlug}`, d.title])
    );

    const sources = state.chunks
      .map((chunk, i) => {
        const title = titles.get(`${chunk.collection}/${chunk.docSlug}`) ?? chunk.docSlug;
        const heading =
          chunk.headingPath.length > 0 ? ` — ${chunk.headingPath.join(" > ")}` : "";
        return `[${i + 1}] ${title}${heading}\n${chunk.text}`;
      })
      .join("\n\n");

    const stream = await chatModel(thinkingBudget).stream(
      [
        {
          role: "system",
          content:
            `You answer questions about ${corpusConfig.siteName} using ONLY the numbered ` +
            `sources provided. Cite as you go: put [n] immediately after each claim the ` +
            `source supports. Never state anything the sources don't say. Answer in ` +
            `concise markdown; no preamble.`,
        },
        {
          role: "user",
          content: `Question: ${state.question}\n\nSources:\n\n${sources}`,
        },
      ],
      config
    );

    let text = "";
    // Usage rides on content chunks (the final chunk reports zeros) — sum
    // across the stream rather than trusting any single chunk.
    const streamUsage: NodeUsage = {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    };
    for await (const chunk of stream) {
      if (typeof chunk.content === "string") text += chunk.content;
      const u = usageOf(chunk);
      streamUsage.inputTokens += u.inputTokens;
      streamUsage.outputTokens += u.outputTokens;
      streamUsage.reasoningTokens += u.reasoningTokens;
    }

    // Parse [n] markers → citations, preserving first-mention order.
    const cited = new Set<number>();
    for (const match of text.matchAll(/\[(\d+)\]/g)) {
      const index = Number(match[1]);
      if (index >= 1 && index <= state.chunks.length) cited.add(index);
    }
    const indexes =
      cited.size > 0
        ? [...cited]
        : state.chunks.map((_, i) => i + 1); // fallback: the full retrieved set

    const citations: Citation[] = indexes.map((n) => {
      const chunk = state.chunks[n - 1];
      const title = titles.get(`${chunk.collection}/${chunk.docSlug}`) ?? chunk.docSlug;
      return {
        ref: n, // pills keep the same numbers the answer text uses inline
        collection: chunk.collection,
        docSlug: chunk.docSlug,
        anchorId: chunk.anchorId,
        label: citationLabel(chunk, title),
      };
    });

    return {
      answer: text,
      citations,
      usage: { ...state.usage, Answer: streamUsage },
    };
  };
}

// ── 6b. Refuse ───────────────────────────────────────────────────────────────
// Templated from authored copy — never model-generated. Names what was
// searched (collections + filter + match count). Zero fabrication.

export async function refuse(state: PipelineStateType): Promise<StateUpdate> {
  const searchedCollections = corpusConfig.collections.map((c) => c.label);
  return {
    answer: copy.refusal(searchedCollections, state.filter, state.filterMatchCount),
    citations: [],
  };
}
