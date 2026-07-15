import type { CorpusConfig } from "@/lib/corpus/types";

/**
 * [PLACEHOLDER] Fill in your own identity, collections, and facet vocabulary
 * below. Collections must mirror the directories under content/, and facet
 * vocabularies must cover the values your docs' frontmatter uses — see the
 * scaffolding file in each content/ collection directory for the expected
 * frontmatter shape.
 *
 * Nothing about identity, collections, or facets is hardcoded anywhere else:
 * components, the ingest script, and the retrieval pipeline all read this file.
 */
const corpusConfig: CorpusConfig = {
  siteName: "Your Site Name",
  greeting: "Ask anything about my work.",

  identity: {
    name: "Your Name",
    role: "Your role or tagline",
    bio: "One sentence about who you are and what this corpus covers.",
    links: [
      { label: "Email", href: "mailto:you@example.com" },
      { label: "GitHub", href: "https://github.com/you" },
    ],
  },

  // Display order for nav tabs and the forest view. Each slug needs a
  // matching directory under content/.
  collections: [
    { slug: "guides", label: "Guides" },
    { slug: "api-reference", label: "API Reference" },
    { slug: "concepts", label: "Concepts" },
    { slug: "troubleshooting", label: "Troubleshooting" },
    { slug: "release-notes", label: "Release Notes" },
  ],

  // Facet vocabulary. Frontmatter values outside these lists fail ingest;
  // the Analyze node only extracts filters from this vocabulary. doc_type is
  // a generic starting example (one value per collection above) — add your
  // own facets freely; nothing about facet names is hardcoded.
  facets: {
    doc_type: [
      "guide",
      "api-reference",
      "concept",
      "troubleshooting",
      "release-notes",
    ],
  },

  // Facet keys ingest requires every doc to declare. Empty by default: no
  // facet is mandatory unless you list its key here.
  requiredFacets: [],

  suggestedPrompts: [
    "What's covered in the guides?",
    "How is this site built?",
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
