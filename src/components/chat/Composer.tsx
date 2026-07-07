"use client";

import { useRef } from "react";
import { copy } from "@/copy";
import type { ChatStatus } from "ai";

/**
 * The chat input. Fixed dimensions in every state (spec: input never resizes)
 * — a single-line-height textarea with internal scroll, Enter to send,
 * Shift+Enter for a newline. The send button becomes a stop button while a
 * response streams.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: ChatStatus;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy && value.trim()) onSubmit();
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && value.trim()) onSubmit();
      }}
      className="flex items-end gap-2 rounded-[var(--radius)] border border-line-strong bg-surface p-2 shadow-sm focus-within:border-accent"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={copy.input.placeholder}
        aria-label={copy.input.ariaLabel}
        className="h-9 max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          className="shrink-0 rounded-[var(--radius-sm)] border border-line px-3 py-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          {copy.input.stop}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          className="shrink-0 rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-opacity disabled:opacity-40"
        >
          {copy.input.send}
        </button>
      )}
    </form>
  );
}
