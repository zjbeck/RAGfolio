import type {
  RagEvent,
  RagfolioUIMessage,
  RagNodeName,
} from "@/lib/stream-types";
import type { Citation } from "@/lib/graph/state";

/**
 * The panel's view of a single assistant turn, derived from the message's
 * `data-ragEvent` parts. Those parts are persistent and reconciled by id
 * (one per node, set server-side), so the latest assistant message carries
 * the full pipeline state — no separate side channel to track.
 */
/** Each node maps to its own event variant, so `byNode.Route?.route` is typed. */
export type RagEventByNode = {
  [K in RagNodeName]?: Extract<RagEvent, { node: K }>;
};

export interface RagTurn {
  /** Latest event per node (what the Pipeline and Forest read). */
  byNode: RagEventByNode;
  /** All events in arrival order (what the Raw Trace reads). */
  ordered: RagEvent[];
  /** Citations from the Answer node, if any. */
  citations: Citation[];
  /** Any node event has arrived — the pipeline is running or done. */
  started: boolean;
}

export function collectRagTurn(message: RagfolioUIMessage | undefined): RagTurn {
  const byNode: RagEventByNode = {};
  const ordered: RagEvent[] = [];
  let citations: Citation[] = [];

  if (message) {
    for (const part of message.parts) {
      if (part.type === "data-ragEvent") {
        const event = part.data;
        ordered.push(event);
        // Union key → precise variant assignment; the cast is the one spot
        // where the mapped type needs help.
        (byNode as Record<RagNodeName, RagEvent>)[event.node] = event;
        if (event.node === "Answer") citations = event.citations;
      } else if (part.type === "data-citations") {
        citations = part.data.citations;
      }
    }
  }

  ordered.sort((a, b) => a.seq - b.seq);
  return { byNode, ordered, citations, started: ordered.length > 0 };
}

/** The ordered pipeline node names (drives Sequence rows and Pipeline columns). */
export const PIPELINE_NODES: RagNodeName[] = [
  "Analyze",
  "Filter",
  "Retrieve",
  "Grade",
  "Route",
  "Answer",
];

/**
 * The steps for a given turn: two (Analyze → Redirect) when Analyze decided
 * the question is off-topic/adversarial and the rest of the pipeline never
 * ran (V2 Phase 5 task 1); otherwise the full six, swapping the sixth for
 * Refuse when the pipeline declined to answer. Shared by SequenceView (what
 * renders) and RagSteps' aria-live announcer (what screen readers hear), so
 * the two never disagree about which step is "last."
 */
export function stepsForTurn(turn: RagTurn): RagNodeName[] {
  if (turn.byNode.Analyze && turn.byNode.Analyze.topicality !== "on-topic") {
    return ["Analyze", "Redirect"];
  }
  const lastStep: RagNodeName = turn.byNode.Route?.route === "refuse" ? "Refuse" : "Answer";
  return [...PIPELINE_NODES.slice(0, 5), lastStep];
}
