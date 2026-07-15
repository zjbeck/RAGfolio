/**
 * Shared types for the content system: corpus.config.ts, the build-time
 * ingest script, runtime retrieval, and the UI all import from here.
 */

/** A facet filter: facet key → required value, e.g. `{ module: "watering" }`. */
export type FacetFilter = Record<string, string>;

export interface CollectionConfig {
  /** Directory name under content/ — also the URL segment. */
  slug: string;
  /** Display label used in nav tabs and the forest view. */
  label: string;
}

export interface IdentityLink {
  label: string;
  href: string;
}

/**
 * First-class author/owner identity (ABSTRACTION_AUDIT.md V2-15) — config,
 * not prose, so it's mechanically fillable without touching any component.
 */
export interface Identity {
  name: string;
  /** Role or tagline, e.g. "Backend engineer" or "Notes on distributed systems". */
  role: string;
  /** One sentence — not a full bio page. */
  bio: string;
  links: IdentityLink[];
}

/** Shape of the default export of corpus.config.ts. */
export interface CorpusConfig {
  siteName: string;
  /** Landing-page greeting. Re-exported by src/copy.ts — components import copy, not this. */
  greeting: string;
  identity: Identity;
  /** Collections in display order. Every directory under content/ must appear here. */
  collections: CollectionConfig[];
  /**
   * Facet vocabulary: facet key → allowed values. Drives frontmatter
   * validation at ingest and the Analyze node's filter extraction at runtime.
   */
  facets: Record<string, string[]>;
  /**
   * Facet keys ingest requires every doc's frontmatter to declare
   * (ABSTRACTION_AUDIT.md A2). Empty by default — no facet is mandatory
   * unless its key is listed here; every key here must also be a key in
   * `facets`.
   */
  requiredFacets: string[];
  /**
   * GitHub repo link for the nav icon and how-it-works page
   * (ABSTRACTION_AUDIT.md A5). `null` hides the icon and the repo link
   * entirely — there's no sensible default to fall back to, so this is
   * deliberately not optional.
   */
  repoUrl: string | null;
  /** BCP 47 language tag for `<html lang>` (ABSTRACTION_AUDIT.md A7). */
  lang: string;
  /** Below this viewport width the RAG Panel stacks behind a disclosure. */
  minViewportWidth: number;
  /** Retrieval count (cosine top-k). */
  k: number;
  /** Thinking budget for the Answer node; 0 disables thinking entirely. */
  answerThinkingBudget: number;
  /** Docs whose body is shorter than this many characters become one whole-doc chunk. */
  wholeDocChunkThreshold: number;
}

/** A claim→evidence relation to another doc, drawn as a line in the forest view. */
export interface CrossLink {
  /** Target doc as "collection/docSlug". */
  to: string;
  /** Short label shown on the link (hover). */
  label: string;
}

/** Per-doc metadata (frontmatter-derived); powers the forest view and doc pages. */
export interface DocMeta {
  collection: string;
  docSlug: string;
  title: string;
  description: string;
  /** Facet key → value, validated against the config vocabulary at ingest. */
  facets: FacetFilter;
  crossLinks: CrossLink[];
  /**
   * sha256 of this doc's raw frontmatter+body. Ingest compares it against the
   * previous build's stored hash to skip re-embedding unchanged docs — see
   * CLAUDE.md's embedding-cache note.
   */
  contentHash: string;
}

export interface Chunk {
  /**
   * Stable, deterministic ID: "{collection}/{docSlug}#{anchorId}", or
   * "{collection}/{docSlug}" for whole-doc chunks. Unchanged content →
   * unchanged ID across builds. Doubles as the citation anchor and the
   * raw-view overlay marker.
   */
  id: string;
  collection: string;
  docSlug: string;
  /** Full heading path, e.g. ["Watering API", "Create a schedule"]. */
  headingPath: string[];
  /**
   * Slug of the chunk's heading, identical to the anchor rehype-slug puts on
   * the rendered page (both use github-slugger). Empty for whole-doc chunks.
   */
  anchorId: string;
  facets: FacetFilter;
  /** Raw markdown of the chunk, including its heading line. */
  text: string;
  /** Character offsets into the doc body (frontmatter excluded) — used by the raw-view overlay. */
  start: number;
  end: number;
}

export interface EmbeddedChunk extends Chunk {
  /** Unit-normalized embedding vector. */
  embedding: number[];
}

/** A document's raw source, for the doc page's raw view. */
export interface DocSource {
  /** The frontmatter text between the --- fences. */
  frontmatterText: string;
  /** The body exactly as the chunker saw it; chunk offsets index into this. */
  body: string;
}

/**
 * A collection's own index-page content, parsed from its `_index.md`
 * frontmatter. Collection pages are containers (title + description +
 * a grid of the collection's docs) — no body, excluded from ingest/retrieval.
 */
export interface CollectionMeta {
  title: string;
  description: string;
}

/** The single static JSON artifact emitted by `npm run ingest`. */
export interface CorpusArtifact {
  embeddingModel: string;
  dimensions: number;
  collections: CollectionConfig[];
  /** Keyed by collection slug. */
  collectionPages: Record<string, CollectionMeta>;
  docs: DocMeta[];
  chunks: EmbeddedChunk[];
  /**
   * Raw doc sources keyed by "collection/docSlug". Baked in at build time so
   * doc pages never read the filesystem at runtime — the same reason the
   * artifact itself is a static import (see CLAUDE.md). Read server-side only.
   */
  sources: Record<string, DocSource>;
}
