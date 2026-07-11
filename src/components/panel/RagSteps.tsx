"use client";

import { useState } from "react";
import { copy } from "@/copy";
import { stepsForTurn, type RagTurn } from "@/lib/panel/rag-turn";
import { Toggle } from "@/components/ui/Toggle";
import { SequenceView } from "./SequenceView";
import { RawTraceView } from "./RawTraceView";

type StepsView = "sequence" | "raw";

/**
 * The most recently completed step, as a screen-reader announcement. Reads
 * `turn` (not the currently-toggled sub-view), so switching to Raw Trace
 * doesn't silence step-completion announcements for anyone relying on them.
 */
function latestStepAnnouncement(turn: RagTurn): string {
  const completed = stepsForTurn(turn).filter((node) => Boolean(turn.byNode[node]));
  const latest = completed.at(-1);
  return latest ? `${copy.panel.nodeLabels[latest]} complete` : "";
}

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
      {/* Visually hidden: the Sequence view's checkmarks are silent to screen
          readers otherwise. Announces the step that just completed, not the
          whole list, so it doesn't re-read all six rows on every update. */}
      <div aria-live="polite" role="status" className="sr-only">
        {latestStepAnnouncement(turn)}
      </div>
    </section>
  );
}
