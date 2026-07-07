import type { CorpusConfig } from "@/lib/corpus/types";

/**
 * [PLACEHOLDER] Everything in this file describes the example Verdant corpus
 * (a fictional smart-terrarium automation platform). When you adopt this
 * template, replace the values below to match your own content — collections
 * must mirror the directories under content/, and facet vocabularies must
 * cover the values your docs' frontmatter uses.
 *
 * Nothing about collections or facets is hardcoded anywhere else: components,
 * the ingest script, and the retrieval pipeline all read this file.
 */
const corpusConfig: CorpusConfig = {
  siteName: "Verdant Docs",
  greeting: "Ask anything about the Verdant platform.",

  // Display order for nav tabs and the forest view.
  collections: [
    { slug: "guides", label: "Guides" },
    { slug: "api-reference", label: "API Reference" },
    { slug: "concepts", label: "Concepts" },
    { slug: "troubleshooting", label: "Troubleshooting" },
    { slug: "release-notes", label: "Release Notes" },
  ],

  // Facet vocabulary. Frontmatter values outside these lists fail ingest;
  // the Analyze node only extracts filters from this vocabulary.
  facets: {
    doc_type: [
      "guide",
      "api-reference",
      "concept",
      "troubleshooting",
      "release-notes",
    ],
    module: ["sensors", "watering", "lighting", "hub"],
  },

  suggestedPrompts: [
    "How do I calibrate a soil-moisture sensor?",
    "What webhook events does Verdant send?",
    "Why does my misting schedule skip cycles?",
    "What changed in the 2.5 release?",
  ],

  // Below this width the RAG Panel stacks beneath the thread.
  minViewportWidth: 1280,

  // Retrieval count (cosine top-k).
  k: 4,

  // Thinking budget for the Answer node. 0 disables thinking; the eval
  // harness supports A/B comparison against modest budgets.
  answerThinkingBudget: 0,

  // Docs with bodies shorter than this many characters are ingested as a
  // single whole-doc chunk instead of per-heading chunks.
  wholeDocChunkThreshold: 1200,
};

export default corpusConfig;
