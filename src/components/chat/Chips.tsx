"use client";

import corpusConfig from "@config";

/**
 * Suggested-prompt chips. Content comes from corpus.config.ts; they persist
 * across the landing→active transition (spec). Picking one sends it.
 */
export function Chips({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {corpusConfig.suggestedPrompts.map((prompt) => (
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
