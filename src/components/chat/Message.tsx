import { copy } from "@/copy";
import { collectRagTurn } from "@/lib/panel/rag-turn";
import type { RagfolioUIMessage } from "@/lib/stream-types";
import { Markdown } from "@/components/Markdown";
import { CitationPill } from "./CitationPill";

function messageText(message: RagfolioUIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * One turn in the thread. User messages are plain right-aligned text;
 * assistant messages render markdown and end with citation pills. Refusals
 * render distinctly (a "Not in the docs" tag) but politely.
 */
export function Message({
  message,
  streaming,
}: {
  message: RagfolioUIMessage;
  streaming: boolean;
}) {
  const text = messageText(message);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--radius)] bg-accent-soft px-3.5 py-2 text-sm text-ink">
          {text}
        </div>
      </div>
    );
  }

  const turn = collectRagTurn(message);
  const isRefusal = turn.byNode.Route?.route === "refuse";

  // Nothing streamed yet — show the searching indicator in place of the bubble.
  if (!text && streaming) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        {copy.chat.thinking}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isRefusal && (
        // Re-weighted (V2 Phase 5 task 5): honest refusal is this site's core
        // thesis, not incidental chrome — the old border-line/text-muted
        // treatment under-signaled that. Reuses the same border-accent/
        // bg-accent-soft/text-ink combination the forest's "retrieved" state
        // already uses (verified AA elsewhere), not a new, unverified color.
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink">
          {copy.chat.refusalTag}
        </span>
      )}
      <div className={isRefusal ? "text-muted" : undefined}>
        <Markdown>{text}</Markdown>
      </div>
      {turn.citations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {copy.chat.sourcesLabel}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {turn.citations.map((citation) => (
              <CitationPill key={citation.ref} citation={citation} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
