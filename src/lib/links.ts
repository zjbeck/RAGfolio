import type { Citation } from "@/lib/graph/state";

/**
 * Deep-link to a document at a heading anchor. The anchorId is the
 * github-slugger slug of the heading — identical to the slug rehype-slug puts
 * on the rendered page — so this href always lands on the cited section.
 */
export function docHref(
  collection: string,
  docSlug: string,
  anchorId?: string
): string {
  const base = `/docs/${collection}/${docSlug}`;
  return anchorId ? `${base}#${anchorId}` : base;
}

export function citationHref(citation: Citation): string {
  return docHref(citation.collection, citation.docSlug, citation.anchorId);
}
