import { copy } from "@/copy";
import type { RagTurn } from "@/lib/panel/rag-turn";
import type { RagNodeName } from "@/lib/stream-types";
import { pipelineData } from "./format";

const LINEAR_NODES: RagNodeName[] = [
  "Analyze",
  "Filter",
  "Retrieve",
  "Grade",
  "Route",
];

function NodeCard({
  node,
  turn,
  active,
  showPending = true,
}: {
  node: RagNodeName;
  turn: RagTurn;
  active: boolean;
  /**
   * Whether to show an empty "pending" data box while this node hasn't fired.
   * true for the linear nodes (Analyze…Route) — "—" there honestly means
   * "hasn't happened yet, but will." false for the terminal branch nodes
   * (Answer/Refuse/Redirect): at most one of the three ever fires for a given
   * turn, so the other two showing a permanent empty box was a ghost, not a
   * "not yet" state (V2 Phase 6 task 1) — those render label-only when inactive.
   */
  showPending?: boolean;
}) {
  const data = pipelineData(node, turn.byNode);
  const label = (
    <div
      className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium ${
        active ? "bg-accent text-on-accent" : "border border-dim-line text-dim-ink"
      }`}
    >
      {copy.panel.nodeLabels[node]}
    </div>
  );
  if (!active && !showPending) {
    return <div className="flex flex-col items-center gap-1.5">{label}</div>;
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      {label}
      <div
        className={`w-[80px] rounded-[var(--radius-sm)] border px-1 py-1 text-center font-mono text-[10px] leading-tight ${
          active
            ? "border-line bg-surface text-ink"
            : "border-dim-line text-dim-ink"
        }`}
      >
        {data ?? copy.panel.pipeline.pending}
      </div>
    </div>
  );
}

function Arrow({ dim }: { dim: boolean }) {
  return (
    <div className={`mt-1.5 text-sm ${dim ? "text-dim-line" : "text-muted"}`}>
      →
    </div>
  );
}

/**
 * Pipeline view: the six nodes left-to-right, Route branching to Answer /
 * Refuse with the inactive branch dimmed. Each node's box shows terse results
 * data (never the Sequence's explanatory prose). Scrolls horizontally so it
 * never wraps at narrow panel widths.
 */
export function PipelineView({ turn }: { turn: RagTurn }) {
  const routed = turn.byNode.Route?.route;
  const redirectActive = Boolean(turn.byNode.Redirect);
  const answerActive = Boolean(turn.byNode.Answer) || routed === "answer";
  const refuseActive = Boolean(turn.byNode.Refuse) || routed === "refuse";

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-1">
        {LINEAR_NODES.map((node, i) => (
          <div key={node} className="flex items-start gap-1">
            <NodeCard node={node} turn={turn} active={Boolean(turn.byNode[node])} />
            {i < LINEAR_NODES.length - 1 && (
              <Arrow dim={!turn.byNode[LINEAR_NODES[i + 1]]} />
            )}
          </div>
        ))}

        {/* Route → { Answer, Refuse } branch, plus Redirect — Analyze's own
            off-topic/adversarial short-circuit, which bypasses everything
            from Filter through Route (V2 Phase 5 task 1). Always shown, like
            Answer/Refuse, so a short-circuited run has somewhere to land. */}
        <Arrow dim={!routed && !redirectActive} />
        <div className="flex flex-col gap-2">
          <NodeCard node="Answer" turn={turn} active={answerActive} showPending={false} />
          <NodeCard node="Refuse" turn={turn} active={refuseActive} showPending={false} />
          <NodeCard node="Redirect" turn={turn} active={redirectActive} showPending={false} />
        </div>
      </div>
    </div>
  );
}
