import { copy } from "@/copy";
import type { RagTurn } from "@/lib/panel/rag-turn";

/**
 * Raw Trace: the actual event data behind the pipeline, monospace and
 * scrollable — the underlying trace the Sequence view narrates. (When
 * LANGSMITH_API_KEY is set, the same run is also traced to LangSmith; this is
 * the local view of it.)
 */
export function RawTraceView({ turn }: { turn: RagTurn }) {
  if (turn.ordered.length === 0) {
    return <p className="text-xs text-dim-ink">{copy.panel.steps.rawEmpty}</p>;
  }

  const start = turn.ordered[0].ts;

  return (
    <div className="max-h-80 overflow-auto rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3">
      <pre className="font-mono text-[11px] leading-relaxed text-ink">
        {turn.ordered
          .map((event) => {
            const { seq, ts, node, ...data } = event;
            const offset = `+${ts - start}ms`;
            return `[${seq}] ${node.padEnd(9)} ${offset}\n     ${JSON.stringify(data)}`;
          })
          .join("\n")}
      </pre>
    </div>
  );
}
