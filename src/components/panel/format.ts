import type { FacetFilter } from "@/lib/corpus/types";
import type { RagEventByNode } from "@/lib/panel/rag-turn";
import type { RagNodeName } from "@/lib/stream-types";

/**
 * Terse results-data formatters for the Pipeline node boxes. This is DATA, not
 * prose — deliberately kept out of copy.ts (which holds the explanatory
 * Sequence sentences). The differentiation rule: Pipeline shows results data;
 * Sequence shows explanatory sentences; the two never overlap.
 */

/** Compact facet rendering for a data box: `module=watering doc_type=guide`. */
function facetData(filter: FacetFilter | null): string {
  if (!filter || Object.keys(filter).length === 0) return "all";
  return Object.entries(filter)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

/** The results-data line shown under a pipeline node, or null if not yet reached. */
export function pipelineData(
  node: RagNodeName,
  byNode: RagEventByNode
): string | null {
  switch (node) {
    case "Analyze": {
      const e = byNode.Analyze;
      if (!e) return null;
      if (e.topicality && e.topicality !== "on-topic") return e.topicality;
      const intent = e.intent ?? "—";
      return e.filter ? `${intent} · ${facetData(e.filter)}` : intent;
    }
    case "Filter": {
      const e = byNode.Filter;
      if (!e) return null;
      if (e.relaxed) return `0 → relaxed → ${e.matchCount}`;
      return `${facetData(e.filter)} → ${e.matchCount}`;
    }
    case "Retrieve": {
      const e = byNode.Retrieve;
      if (!e) return null;
      if (e.chunks.length === 0) return "0 chunks";
      const top = e.chunks[0].score.toFixed(2);
      return `${e.chunks.length} chunks · top ${top}`;
    }
    case "Grade": {
      const e = byNode.Grade;
      return e ? `verdict: ${e.verdict}` : null;
    }
    case "Route": {
      const e = byNode.Route;
      return e ? `→ ${e.route}` : null;
    }
    case "Answer": {
      const e = byNode.Answer;
      if (!e) return null;
      const src = `${e.citations.length} src`;
      return e.usage ? `${e.usage.outputTokens} tok · ${src}` : src;
    }
    case "Refuse": {
      const e = byNode.Refuse;
      return e ? "0 sources" : null;
    }
    case "Redirect": {
      const e = byNode.Redirect;
      return e ? e.topicality : null;
    }
  }
}
