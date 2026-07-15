"use client";

/**
 * Suggested-prompt chips, derived server-side from the real corpus (see
 * getSuggestedPrompts) rather than static config copy. Landing-only — they
 * collapse once the thread goes active (V2 Phase 5 task 4), rather than
 * persisting through an ongoing conversation.
 */
export function Chips({
  prompts,
  onPick,
  disabled,
}: {
  prompts: string[];
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onPick(prompt)}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
