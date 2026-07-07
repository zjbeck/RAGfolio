"use client";

import Link from "next/link";
import { useState } from "react";
import { copy } from "@/copy";
import type { Chunk } from "@/lib/corpus/types";
import { Markdown } from "@/components/Markdown";
import { Toggle } from "@/components/ui/Toggle";

type DocMode = "rendered" | "raw";

/**
 * A document page with a rendered/raw toggle. Raw mode shows the source
 * frontmatter plus the body with a chunk-boundary overlay built from ingest
 * metadata — each block is one retrievable, citable unit, labeled with the
 * chunk id that doubles as its citation anchor.
 */
export function DocView({
  title,
  description,
  collectionLabel,
  frontmatterText,
  body,
  chunks,
}: {
  title: string;
  description: string;
  collectionLabel: string;
  frontmatterText: string;
  body: string;
  chunks: Chunk[];
}) {
  const [mode, setMode] = useState<DocMode>("rendered");

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        {copy.docs.backHome}
      </Link>

      <header className="mt-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {collectionLabel}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <Toggle
          ariaLabel="Document view"
          value={mode}
          onChange={setMode}
          options={[
            { value: "rendered", label: copy.docs.rendered },
            { value: "raw", label: copy.docs.raw },
          ]}
        />
      </header>

      {mode === "rendered" ? (
        <Markdown>{body}</Markdown>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted">{copy.docs.rawExplainer}</p>

          <section className="overflow-hidden rounded-[var(--radius)] border border-line">
            <div className="border-b border-line bg-surface-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {copy.docs.frontmatter}
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-ink">
              {frontmatterText}
            </pre>
          </section>

          {chunks.map((chunk) => (
            <section
              key={chunk.id}
              className="overflow-hidden rounded-[var(--radius)] border border-line"
            >
              <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5">
                <span className="font-mono text-[11px] text-accent">
                  {copy.docs.chunk} · {chunk.id}
                </span>
                {chunk.headingPath.length > 0 && (
                  <span className="truncate pl-3 text-[11px] text-muted">
                    {chunk.headingPath.join(" › ")}
                  </span>
                )}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-ink">
                {body.slice(chunk.start, chunk.end)}
              </pre>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
