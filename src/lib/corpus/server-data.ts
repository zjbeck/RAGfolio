import { loadCorpus } from "./retrieval";
import type { Chunk, CollectionConfig, DocMeta, DocSource } from "./types";

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
 * Nav tabs: one per collection, each linking to its first document (the spec
 * defines per-doc pages, not collection indexes). Shared by the home page and
 * the doc pages.
 */
export function getNavTabs(): NavTab[] {
  const corpus = loadCorpus();
  return corpus.collections.map((collection) => {
    const first = corpus.docs.find((d) => d.collection === collection.slug);
    return {
      slug: collection.slug,
      label: collection.label,
      href: first ? `/docs/${collection.slug}/${first.docSlug}` : "/",
    };
  });
}

export function getCollectionLabel(slug: string): string {
  return loadCorpus().collections.find((c) => c.slug === slug)?.label ?? slug;
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
