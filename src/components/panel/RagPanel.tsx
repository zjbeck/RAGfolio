import { copy } from "@/copy";
import type { ForestData } from "@/lib/corpus/server-data";
import type { RagTurn } from "@/lib/panel/rag-turn";
import { RetrievalGraph } from "./RetrievalGraph";
import { RagSteps } from "./RagSteps";

/**
 * The RAG Panel: two zones — Retrieval Graph (RAG Files / RAG Pipeline) above
 * RAG Steps (Sequence / Raw Trace). Renders the pipeline skeleton immediately
 * so it fills in live as stream events arrive.
 */
export function RagPanel({
  turn,
  forest,
}: {
  turn: RagTurn;
  forest: ForestData;
}) {
  // Height/scroll is owned by the parent: a full-height scrolling side column
  // when wide, normal document flow when stacked below the thread.
  return (
    <div
      aria-label={copy.panel.ariaLabel}
      role="region"
      className="flex flex-col gap-6 p-6"
    >
      <RetrievalGraph turn={turn} forest={forest} />
      <div className="border-t border-line" />
      <RagSteps turn={turn} />
    </div>
  );
}
