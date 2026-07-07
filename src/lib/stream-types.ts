import type { UIMessage } from "ai";
import type { Citation, NodeUsage } from "@/lib/graph/state";
import type { FacetFilter } from "@/lib/corpus/types";

/**
 * The typed contract between the chat route and the RAG Panel. Everything the
 * panel renders arrives as `data-ragEvent` parts on the same UI message
 * stream that carries the answer text — one stream, no side channel.
 */

/** Retrieved-chunk metadata for the wire: everything but the text. */
export interface RetrievedChunkMeta {
  id: string;
  collection: string;
  docSlug: string;
  headingPath: string[];
  anchorId: string;
  score: number;
}

interface RagEventBase {
  /** Monotonic order across the run — the raw trace sorts by this. */
  seq: number;
  /** Server timestamp (epoch ms). */
  ts: number;
}

export type RagEvent = RagEventBase &
  (
    | { node: "Analyze"; intent: string | null; filter: FacetFilter | null }
    | {
        node: "Filter";
        filter: FacetFilter | null;
        matchCount: number;
        relaxed: boolean;
      }
    | { node: "Retrieve"; chunks: RetrievedChunkMeta[] }
    | { node: "Grade"; verdict: "sufficient" | "insufficient" }
    | { node: "Route"; route: "answer" | "refuse" }
    | { node: "Answer"; citations: Citation[]; usage: NodeUsage | null }
    | { node: "Refuse"; filter: FacetFilter | null; matchCount: number }
  );

export type RagNodeName = RagEvent["node"];

/** Data parts this app streams; keys become part types (`data-ragEvent`, …). */
export type RagDataParts = {
  ragEvent: RagEvent;
  citations: { citations: Citation[] };
};

export type RagfolioUIMessage = UIMessage<never, RagDataParts>;
