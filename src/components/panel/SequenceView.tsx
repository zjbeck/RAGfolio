import { copy } from "@/copy";
import { stepsForTurn, type RagTurn } from "@/lib/panel/rag-turn";

/**
 * Sequence view: six numbered steps, each with one plain-language sentence
 * (from copy.ts) explaining what the step does. Rows check off live as their
 * stream events arrive. The sentences are explanatory only — the terse
 * results data lives in the Pipeline boxes, never duplicated here.
 *
 * The sixth step is Answer, or Refuse when the pipeline refuses. Step
 * completion is also announced to screen readers — see RagSteps, which wraps
 * this view and stays accurate regardless of which sub-view is toggled.
 */
export function SequenceView({ turn }: { turn: RagTurn }) {
  const steps = stepsForTurn(turn);

  return (
    <div className="space-y-1">
      <ol className="space-y-2">
        {steps.map((node, i) => {
          const done = Boolean(turn.byNode[node]);
          return (
            <li key={node} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                  done
                    ? "bg-accent text-on-accent"
                    : "border border-line text-muted"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {copy.panel.nodeLabels[node]}
                </div>
                <p className={`text-xs ${done ? "text-muted" : "text-dim-ink"}`}>
                  {copy.panel.sequence[node]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="pt-2 text-[11px] text-dim-ink">{copy.panel.steps.footnote}</p>
    </div>
  );
}
