import corpusConfig from "@config";
import type { FacetFilter } from "@/lib/corpus/types";

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
