import { loadCorpus } from "./retrieval";
import type { Chunk, CollectionConfig, CollectionMeta, DocMeta, DocSource } from "./types";

/**
 * Server-only accessors over the ingest artifact and raw content files.
 *
 * IMPORTANT: import these ONLY from server components / route handlers. The
 * corpus artifact carries embeddings; passing its chunks to a client component
 * would ship them to the browser. The forest getter deliberately returns doc
 * *metadata* only (no embeddings, no chunk text) so it is safe as a prop.
 * (`server-only` is not a dependency here; this boundary is enforced by
 * discipline and documented in CLAUDE.md.)
 */

export interface ForestData {
  collections: CollectionConfig[];
  docs: DocMeta[];
}

/** Lightweight forest dataset: collections + per-doc metadata. Safe as a client prop. */
export function getForestData(): ForestData {
  const corpus = loadCorpus();
  return { collections: corpus.collections, docs: corpus.docs };
}

export interface NavTab {
  slug: string;
  label: string;
  href: string;
}

/**
 * Nav tabs: one per collection, each linking to that collection's index page
 * (a container: title + description + a grid of its docs). Shared by the
 * home page and the doc pages.
 */
export function getNavTabs(): NavTab[] {
  const corpus = loadCorpus();
  return corpus.collections.map((collection) => ({
    slug: collection.slug,
    label: collection.label,
    href: `/docs/${collection.slug}`,
  }));
}

export function getCollectionLabel(slug: string): string {
  return loadCorpus().collections.find((c) => c.slug === slug)?.label ?? slug;
}

/** Params for generateStaticParams on the collection-index route. */
export function getCollectionParams(): { collection: string }[] {
  return loadCorpus().collections.map((c) => ({ collection: c.slug }));
}

export function getCollectionMeta(slug: string): CollectionMeta | undefined {
  return loadCorpus().collectionPages[slug];
}

export interface CollectionDocSummary {
  docSlug: string;
  title: string;
  description: string;
}

/** Docs in a collection, in ingest order — the thumbnail grid on its index page. */
export function getCollectionDocs(slug: string): CollectionDocSummary[] {
  return loadCorpus()
    .docs.filter((d) => d.collection === slug)
    .map((d) => ({ docSlug: d.docSlug, title: d.title, description: d.description }));
}

/**
 * Suggested-prompt chips, derived from the real corpus (V2 Phase 5 task 4) —
 * previously static, ungrounded copy in corpus.config.ts. One per collection,
 * from that collection's first doc title, in collection order; capped so a
 * corpus with many collections doesn't crowd the landing composer.
 */
export function getSuggestedPrompts(limit = 4): string[] {
  const corpus = loadCorpus();
  const prompts: string[] = [];
  for (const collection of corpus.collections) {
    const first = corpus.docs.find((d) => d.collection === collection.slug);
    if (first) prompts.push(`What does "${first.title}" cover?`);
    if (prompts.length >= limit) break;
  }
  return prompts;
}

/** Params for generateStaticParams on the doc route. */
export function getDocParams(): { collection: string; slug: string }[] {
  return loadCorpus().docs.map((d) => ({
    collection: d.collection,
    slug: d.docSlug,
  }));
}

export function getDocMeta(collection: string, slug: string): DocMeta | undefined {
  return loadCorpus().docs.find(
    (d) => d.collection === collection && d.docSlug === slug
  );
}

/** A doc's chunks, embeddings stripped — used for the raw-view overlay. */
export function getDocChunks(collection: string, slug: string): Chunk[] {
  return loadCorpus()
    .chunks.filter((c) => c.collection === collection && c.docSlug === slug)
    .map(({ embedding, ...chunk }) => {
      void embedding;
      return chunk;
    });
}

/**
 * A doc's raw source (frontmatter + body), read from the build-time artifact —
 * never the filesystem. Baking sources into the artifact avoids depending on
 * process.cwd(), which is not the project root under every launcher (dev) or
 * deployment (Vercel). Same rationale as the corpus static import; see
 * CLAUDE.md.
 */
export function getDocSource(collection: string, slug: string): DocSource {
  const source = loadCorpus().sources[`${collection}/${slug}`];
  if (!source) {
    throw new Error(`No source for ${collection}/${slug} in the corpus artifact.`);
  }
  return source;
}
