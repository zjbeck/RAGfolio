import Link from "next/link";
import type { Citation } from "@/lib/graph/state";
import { citationHref } from "@/lib/links";

/**
 * A citation rendered as a pill. Keeps the same [n] number used inline in the
 * answer text, and deep-links to the cited document + heading anchor.
 */
export function CitationPill({ citation }: { citation: Citation }) {
  return (
    <Link
      href={citationHref(citation)}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-ink"
    >
      <span className="font-mono text-[10px] text-accent">[{citation.ref}]</span>
      <span>{citation.label}</span>
    </Link>
  );
}
