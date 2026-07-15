import { copy } from "@/copy";
import type { RagTurn } from "@/lib/panel/rag-turn";

/**
 * Raw Trace: the actual event data behind the pipeline, monospace — the
 * underlying trace the Sequence view narrates. (When LANGSMITH_API_KEY is
 * set, the same run is also traced to LangSmith; this is the local view of
 * it.) No private scroll region of its own: the panel column is already one
 * scroll container (see CLAUDE.md's V2 Phase 4 scroll-architecture note), and
 * this used to nest a second one, an ad hoc double-scroll only this view had.
 * Long lines wrap (break-all, since a chunk id or citation label can be one
 * long unbroken token) instead of clipping mid-token.
 */
export function RawTraceView({ turn }: { turn: RagTurn }) {
  if (turn.ordered.length === 0) {
    return <p className="text-xs text-dim-ink">{copy.panel.steps.rawEmpty}</p>;
  }

  const start = turn.ordered[0].ts;

  return (
    <div className="rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3">
      <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-ink">
        {turn.ordered
          .map((event, i) => {
            const { seq, ts, node, ...data } = event;
            const cumulative = `+${ts - start}ms`;
            const prevTs = i === 0 ? start : turn.ordered[i - 1].ts;
            const delta = `Δ${ts - prevTs}ms`;
            return `[${seq}] ${node.padEnd(9)} ${cumulative} (${delta})\n     ${JSON.stringify(data)}`;
          })
          .join("\n")}
      </pre>
    </div>
  );
}
