import corpusConfig from "@config";
import type { FacetFilter } from "@/lib/corpus/types";
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
    howItWorks: "How this site works",
    github: "View source on GitHub",
    home: "Home",
    themeMode: "Toggle light and dark",
    themePalette: "Toggle theme palette",
  },

  /** Landing composition (pre-query). */
  landing: {
    footnote:
      "Answers are generated only from the portfolio corpus and always cite sources.",
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
    error: "Something went wrong generating that answer. Try again.",
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
        "Live view of the retrieval pipeline. Toggle ‘Raw Trace’ for the underlying LangSmith data.",
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
    } as Record<RagNodeName, string>,
    forest: {
      open: "Open document ↗",
      retrieved: "Retrieved",
      notRetrieved: "Not retrieved",
      crossLink: "claim → evidence",
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
   * this text is templated, never model-generated.
   */
  refusal: (searchedCollections: string[], filter: FacetFilter | null, matchCount: number): string => {
    const scope =
      !filter || Object.keys(filter).length === 0
        ? `all collections (${searchedCollections.join(", ")})`
        : `${searchedCollections.join(", ")}, filtered to ${describeFilter(filter)} (${matchCount} matching ${matchCount === 1 ? "section" : "sections"})`;
    return (
      `I couldn't find an answer to that in the docs. I searched ${scope}, ` +
      `and nothing there addresses your question — rather than guess, I'll say so. ` +
      `Try rephrasing, or browse the collections directly.`
    );
  },
} as const;
