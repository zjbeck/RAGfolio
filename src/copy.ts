import corpusConfig from "@config";
import type { CollectionConfig, FacetFilter } from "@/lib/corpus/types";
import { collectionHref } from "@/lib/links";
import type { RagNodeName } from "@/lib/stream-types";

/**
 * [PLACEHOLDER] Every user-facing string in RAGfolio lives in this module —
 * refusal copy, panel narration, footnotes, the gate page, the greeting.
 * Rewrite any of it without touching a component. Strings that need runtime
 * data are template functions; plain strings are plain strings.
 *
 * This module grows with the UI; the rule never changes: components import
 * `copy`, never define user-facing text.
 */

/** Human-readable description of an applied facet filter, e.g. `module = watering`. */
export function describeFilter(filter: FacetFilter | null): string {
  if (!filter || Object.keys(filter).length === 0) return "no filter";
  return Object.entries(filter)
    .map(([key, value]) => `${key} = ${value}`)
    .join(", ");
}

export const copy = {
  siteName: corpusConfig.siteName,

  /** Single source is corpus.config.ts; re-exported here so components only import copy. */
  greeting: corpusConfig.greeting,

  /** SEO meta description (layout.tsx). [PLACEHOLDER] — write your own. */
  seo: {
    description:
      "A portfolio/docs chatbot that answers only from its corpus and shows its retrieval work.",
  },

  /** The password gate page. [PLACEHOLDER] — speak to your own reviewers. */
  gate: {
    title: "This portfolio is gated",
    prompt:
      "Enter the password you were given to view the site. Every page and API sits behind this gate.",
    passwordLabel: "Password",
    submitLabel: "Enter",
    errorIncorrect: "That password isn't right — check for typos and try again.",
    errorRateLimited: "Too many attempts — wait a minute and try again.",
    errorGeneric: "Something went wrong on our side. Try again.",
  },

  /** Top navigation. */
  nav: {
    collections: "Collections",
    howItWorks: "How this site works",
    github: "View source on GitHub",
    home: "Home",
    themeMode: "Toggle light and dark",
    themePalette: "Toggle theme palette",
    themePaletteUnavailable: "Add src/styles/theme.custom.css to enable a custom palette",
  },

  /** Landing composition (pre-query). */
  landing: {
    footnote:
      "Answers are generated only from the portfolio corpus and always cite sources.",
  },

  /**
   * Persistent stack/model credential badge, below the composer in every
   * state — not a dismissible banner (V2 Phase 6 task 2). model comes from
   * providers/chat.ts's activeChatModel(), so it stays honest across the
   * Gemini/Groq seam rather than naming one hardcoded provider.
   */
  credential: (model: string): string => `Powered by ${model} · LangGraph · RAGfolio`,

  /**
   * Active chat composition (after the first question). The pipeline
   * processes each question independently — no conversation history reaches
   * Analyze, Retrieve, or Answer — so this says so plainly rather than
   * letting a multi-message thread imply memory it doesn't have.
   */
  activeThread: {
    footnote: "Questions are answered independently — include full context in each one.",
  },

  /** Chat input and thread. */
  input: {
    placeholder: "Ask a question about the docs…",
    send: "Send",
    stop: "Stop",
    ariaLabel: "Ask a question",
  },
  chat: {
    thinking: "Searching the corpus…",
    sourcesLabel: "Sources",
    refusalTag: "Not in the docs",
    roleYou: "You",
    /** Any failure that isn't quota exhaustion — an honest, generic apology. */
    error: "Something went wrong generating that answer. Try again.",
    /**
     * Distinct from `error`: the Gemini free tier has a daily request cap, and
     * "please check your billing" (the raw API message) is the wrong thing to
     * tell a portfolio visitor. Named, not vague, so it reads as expected
     * behavior on a demo rather than the site being broken.
     */
    quotaExceeded: "This demo has hit its usage limit for today — try again later.",
    /**
     * Off-topic/adversarial short-circuit (V2 Phase 5 task 1) — distinct from
     * refusalTag/the Refuse node's message, which means "I searched the corpus
     * and found nothing." These mean the question was never sent to search at
     * all.
     */
    offTopicRedirect: `I only answer questions about ${corpusConfig.siteName}'s own corpus — try asking about what's in the collections above.`,
    adversarialRedirect:
      "I can't help with that. Ask me something about this site's corpus instead.",
  },

  /** The RAG Panel and its two zones. */
  panel: {
    ariaLabel: "RAG Panel",
    empty: "Ask a question to watch the retrieval pipeline run.",
    graph: {
      label: "Retrieval Graph",
      files: "RAG Files",
      pipeline: "RAG Pipeline",
    },
    steps: {
      label: "RAG Steps",
      sequence: "Sequence",
      raw: "Raw Trace",
      footnote:
        "Live view of the retrieval pipeline. Toggle ‘Raw Trace’ for the underlying event data.",
      rawEmpty: "Raw event data appears here once a question is asked.",
    },
    /**
     * Sequence view: ONE plain-language sentence per step, explaining what the
     * step DOES. These never restate the Pipeline node boxes' results data
     * (that's the differentiation rule) — the live element is each row's
     * active/completed status, filled in as its stream event arrives.
     */
    sequence: {
      Analyze:
        "Reads your question to decide what you're asking and which slice of the docs to search.",
      Filter:
        "Narrows the corpus to only the sections whose metadata matches that slice.",
      Retrieve:
        "Ranks the remaining sections by meaning and keeps the closest few.",
      Grade:
        "Judges whether those sections actually contain an answer, rather than merely relating to the topic.",
      Route:
        "Chooses between answering from what was found and saying it isn't in the docs.",
      Answer:
        "Writes a reply grounded only in the kept sections, citing each source it uses.",
      Refuse:
        "Says the answer isn't in the docs and names what was searched — no guessing.",
      Redirect:
        "Answers honestly that this question is outside what the site covers, without searching the corpus.",
    } as Record<RagNodeName, string>,
    forest: {
      open: "Open document ↗",
      neutral: "Not yet searched",
      retrieved: "Retrieved — matched this question",
      insufficient: "Retrieved, but didn't hold the answer",
      notRetrieved: "Searched, not retrieved",
      crossLink:
        "A line connects a claim to the evidence doc it cites. Hover or select a document to reveal its links.",
    },
    /** Pipeline branch labels; the six node names come from nodeLabels below. */
    pipeline: {
      answerBranch: "Answer",
      refuseBranch: "Refuse",
      pending: "—",
    },
    nodeLabels: {
      Analyze: "Analyze",
      Filter: "Filter",
      Retrieve: "Retrieve",
      Grade: "Grade",
      Route: "Route",
      Answer: "Answer",
      Refuse: "Refuse",
      Redirect: "Redirect",
    } as Record<RagNodeName, string>,
  },

  /** Responsive disclosure (below the configured minimum viewport width). */
  responsive: {
    showPanel: "Show RAG Panel",
    hidePanel: "Hide RAG Panel",
  },

  /** Document pages (rendered / raw). */
  docs: {
    rendered: "Rendered",
    raw: "Raw",
    frontmatter: "Frontmatter",
    chunk: "chunk",
    rawExplainer:
      "Source markdown with a chunk-boundary overlay from ingest metadata. Each boundary is one retrievable, citable unit.",
    backHome: "← Back to chat",
    collectionLabel: "Collection",
  },

  /**
   * Honest refusal: names what was searched and stops. Zero fabrication —
   * this text is templated, never model-generated. Collection names render
   * as real markdown links to each collection's index page (V2 Phase 6 task
   * 1) rather than plain unlinked text — the closing "browse the collections
   * directly" line meant it literally, but there was nothing to click.
   */
  refusal: (
    searchedCollections: CollectionConfig[],
    filter: FacetFilter | null,
    matchCount: number
  ): string => {
    const linked = searchedCollections
      .map((c) => `[${c.label}](${collectionHref(c.slug)})`)
      .join(", ");
    const scope =
      !filter || Object.keys(filter).length === 0
        ? `all collections (${linked})`
        : `${linked}, filtered to ${describeFilter(filter)} (${matchCount} matching ${matchCount === 1 ? "section" : "sections"})`;
    return (
      `I couldn't find an answer to that in the docs. I searched ${scope}, ` +
      `and nothing there addresses your question — rather than guess, I'll say so. ` +
      `Try rephrasing, or browse the collections directly.`
    );
  },
} as const;
