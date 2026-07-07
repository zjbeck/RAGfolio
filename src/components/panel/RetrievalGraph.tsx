"use client";

import { useMemo, useState } from "react";
import { copy } from "@/copy";
import type { ForestData } from "@/lib/corpus/server-data";
import type { RagTurn } from "@/lib/panel/rag-turn";
import { Toggle } from "@/components/ui/Toggle";
import { ForestView } from "./ForestView";
import { PipelineView } from "./PipelineView";

type GraphView = "files" | "pipeline";

/**
 * Panel Row 1 — "Retrieval Graph": header (label left, toggle right) over
 * either the RAG Files forest or the RAG Pipeline.
 */
export function RetrievalGraph({
  turn,
  forest,
}: {
  turn: RagTurn;
  forest: ForestData;
}) {
  const [view, setView] = useState<GraphView>("pipeline");

  const retrievedDocIds = useMemo(
    () =>
      new Set(
        (turn.byNode.Retrieve?.chunks ?? []).map(
          (c) => `${c.collection}/${c.docSlug}`
        )
      ),
    [turn]
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{copy.panel.graph.label}</h2>
        <Toggle
          ariaLabel={copy.panel.graph.label}
          value={view}
          onChange={setView}
          options={[
            { value: "files", label: copy.panel.graph.files },
            { value: "pipeline", label: copy.panel.graph.pipeline },
          ]}
        />
      </div>
      {view === "files" ? (
        <ForestView forest={forest} retrievedDocIds={retrievedDocIds} />
      ) : (
        <PipelineView turn={turn} />
      )}
    </section>
  );
}
