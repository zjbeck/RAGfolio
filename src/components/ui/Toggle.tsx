"use client";

/**
 * A two-option segmented control. Used for the panel's [RAG Files | RAG
 * Pipeline] and [Sequence | Raw Trace] toggles. Generic over the option value
 * so callers stay type-safe.
 */
export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

export function Toggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-[var(--radius-sm)] border border-line bg-surface-2 p-0.5 text-xs"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-[calc(var(--radius-sm)-2px)] px-2.5 py-1 font-medium transition-colors ${
              selected
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
