"use client";

import { useState } from "react";
import { copy } from "@/copy";
import type { RagTurn } from "@/lib/panel/rag-turn";
import { Toggle } from "@/components/ui/Toggle";
import { SequenceView } from "./SequenceView";
import { RawTraceView } from "./RawTraceView";

type StepsView = "sequence" | "raw";

/**
 * Panel Row 2 — "RAG Steps": header (label left, toggle right) over either the
 * plain-language Sequence or the Raw Trace.
 */
export function RagSteps({ turn }: { turn: RagTurn }) {
  const [view, setView] = useState<StepsView>("sequence");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{copy.panel.steps.label}</h2>
        <Toggle
          ariaLabel={copy.panel.steps.label}
          value={view}
          onChange={setView}
          options={[
            { value: "sequence", label: copy.panel.steps.sequence },
            { value: "raw", label: copy.panel.steps.raw },
          ]}
        />
      </div>
      {view === "sequence" ? (
        <SequenceView turn={turn} />
      ) : (
        <RawTraceView turn={turn} />
      )}
    </section>
  );
}
