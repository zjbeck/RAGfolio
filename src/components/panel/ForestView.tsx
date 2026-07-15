"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/copy";
import type { ForestData } from "@/lib/corpus/server-data";
import type { DocMeta } from "@/lib/corpus/types";
import { docHref } from "@/lib/links";

export type ForestDisplayMode = "always" | "onSelect" | "off";

const docId = (d: { collection: string; docSlug: string }) =>
  `${d.collection}/${d.docSlug}`;

interface Center {
  x: number;
  y: number;
}

/** Quadratic bezier control point offset perpendicular to the line's midpoint. */
function curvedPath(a: Center, b: Center): { d: string; mid: Center } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const bow = Math.min(dist * 0.15, 40);
  const cx = mx - (dy / dist) * bow;
  const cy = my + (dx / dist) * bow;
  return { d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, mid: { x: cx, y: cy } };
}

/**
 * The RAG Files forest: one collection per full-width row (vertical scroll is
 * the accepted tradeoff for legibility — see CLAUDE.md's V2 Phase 4 note).
 * Each node has three visual states, not two: neutral (nothing has been
 * searched yet), retrieved (accent), and dimmed (searched, not retrieved) —
 * dimming only ever demotes from the neutral baseline once a query has run,
 * it is never the default appearance.
 *
 * Cross-links default to onSelect: only the links touching the
 * hovered/selected node render, as gently curved paths with a dot at each
 * endpoint. Rendering every retrieved doc's links simultaneously as straight
 * lines (the old "always" default) produced an illegible overlapping web;
 * onSelect was chosen over a permanent highlight-only mode because it still
 * lets a visitor discover which docs *have* cross-links by hovering, not just
 * see them after already knowing to select one.
 */
export function ForestView({
  forest,
  retrievedDocIds,
  queried,
  insufficient,
  displayMode = "onSelect",
}: {
  forest: ForestData;
  retrievedDocIds: Set<string>;
  /** Whether Retrieve has actually run yet — gates the neutral vs retrieved/dimmed states. */
  queried: boolean;
  /**
   * Grade judged the retrieved chunks insufficient (the pipeline refused).
   * Distinguishes "retrieved but didn't hold the answer" from "confirmed
   * relevant" (V2 Phase 5 task 2) — without this, a retrieved-but-refused doc
   * would show the same confident accent styling as a doc the answer was
   * actually drawn from, contradicting the refusal text.
   */
  insufficient: boolean;
  displayMode?: ForestDisplayMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [centers, setCenters] = useState<Map<string, Center>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const docsByCollection = useMemo(() => {
    const map = new Map<string, DocMeta[]>();
    for (const c of forest.collections) map.set(c.slug, []);
    for (const d of forest.docs) map.get(d.collection)?.push(d);
    return map;
  }, [forest]);

  const links = useMemo(() => {
    const out: { from: string; to: string; label: string }[] = [];
    for (const d of forest.docs) {
      const from = docId(d);
      if (!retrievedDocIds.has(from)) continue; // links only for retrieved docs
      for (const cl of d.crossLinks) out.push({ from, to: cl.to, label: cl.label });
    }
    return out;
  }, [forest, retrievedDocIds]);

  // Measure node centers relative to the container after layout, and on resize.
  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const base = container.getBoundingClientRect();
      const next = new Map<string, Center>();
      for (const [id, el] of nodeRefs.current) {
        const r = el.getBoundingClientRect();
        next.set(id, {
          x: r.left + r.width / 2 - base.left,
          y: r.top + r.height / 2 - base.top,
        });
      }
      setCenters(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [forest, retrievedDocIds]);

  const active = hovered ?? selected;
  const segments =
    displayMode === "off"
      ? []
      : links
          .map((link) => {
            const a = centers.get(link.from);
            const b = centers.get(link.to);
            if (!a || !b) return null;
            const touches = active === link.from || active === link.to;
            if (displayMode === "onSelect" && !touches) return null;
            return { ...link, a, b, touches };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

  const selectedDoc = selected
    ? forest.docs.find((d) => docId(d) === selected)
    : undefined;
  const selectedCenter = selected ? centers.get(selected) : undefined;

  return (
    <div ref={containerRef} className="relative">
      {/* Cross-link overlay, behind the nodes. */}
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden>
        {segments.map((s) => {
          const { d, mid } = curvedPath(s.a, s.b);
          const stroke = s.touches ? "var(--accent)" : "var(--dim-line)";
          return (
            <g key={`${s.from}->${s.to}`}>
              <path d={d} fill="none" stroke={stroke} strokeWidth={s.touches ? 1.5 : 1} />
              {s.touches && (
                <>
                  <circle cx={s.a.x} cy={s.a.y} r={3} fill="var(--accent)" />
                  <circle cx={s.b.x} cy={s.b.y} r={3} fill="var(--accent)" />
                  <text
                    x={mid.x}
                    y={mid.y - 4}
                    textAnchor="middle"
                    className="fill-muted font-mono text-[9px]"
                  >
                    {s.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* One full-width row per collection; vertical scroll is the accepted
          tradeoff for legibility (owned by the ambient panel scroll region). */}
      <div className="relative z-10 flex flex-col gap-3">
        {forest.collections.map((collection) => {
          const docs = docsByCollection.get(collection.slug) ?? [];
          return (
            <div
              key={collection.slug}
              className="rounded-[var(--radius)] border border-line bg-surface/50 p-2.5"
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {collection.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {docs.map((doc) => {
                  const id = docId(doc);
                  const wasRetrieved = queried && retrievedDocIds.has(id);
                  const confirmed = wasRetrieved && !insufficient;
                  const consideredInsufficient = wasRetrieved && insufficient;
                  const dimmed = queried && !retrievedDocIds.has(id);
                  const isSelected = selected === id;
                  const stateClass = confirmed
                    ? "border-accent bg-accent-soft text-ink" // the answer was actually drawn from this doc
                    : consideredInsufficient
                      ? "border-accent text-muted" // in the candidate set, but Grade said it didn't hold the answer —
                        // accent-hued outline (no fill) so it reads as "considered," never confusable with
                        // dimmed: border-line-strong and border-dim-line are the same hex in both palettes
                        // (globals.css), which would have made this indistinguishable from "never retrieved"
                      : dimmed
                        ? "border-dim-line text-dim-ink hover:text-ink" // never retrieved at all
                        : "border-line text-ink hover:border-line-strong"; // neutral: pre-query baseline
                  return (
                    <button
                      key={id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(id, el);
                        else nodeRefs.current.delete(id);
                      }}
                      onMouseEnter={() => setHovered(id)}
                      onMouseLeave={() => setHovered((h) => (h === id ? null : h))}
                      onClick={() => setSelected((s) => (s === id ? null : id))}
                      className={`max-w-[220px] truncate rounded-[var(--radius-sm)] border px-2 py-1.5 text-left text-[11px] leading-tight transition-colors ${stateClass} ${
                        isSelected ? "ring-2 ring-accent" : ""
                      }`}
                      title={doc.title}
                    >
                      {doc.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip card for the selected node. */}
      {selectedDoc && selectedCenter && (
        <div
          className="absolute z-20 w-56 -translate-x-1/2 -translate-y-full rounded-[var(--radius)] border border-line-strong bg-surface p-3 shadow-lg"
          style={{ left: selectedCenter.x, top: selectedCenter.y - 10 }}
        >
          <div className="text-sm font-semibold">{selectedDoc.title}</div>
          <p className="mt-1 text-xs text-muted">{selectedDoc.description}</p>
          <Link
            href={docHref(selectedDoc.collection, selectedDoc.docSlug)}
            className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
          >
            {copy.panel.forest.open}
          </Link>
        </div>
      )}

      {/* Legend: an actual visual grammar, not just a color key — explains
          what each state means and what the cross-link lines represent. */}
      <div className="mt-3 space-y-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border border-line" />
          {copy.panel.forest.neutral}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border border-accent bg-accent-soft" />
          {copy.panel.forest.retrieved}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border border-accent" />
          {copy.panel.forest.insufficient}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border border-dim-line" />
          {copy.panel.forest.notRetrieved}
        </span>
        <p className="pt-1 text-dim-ink">{copy.panel.forest.crossLink}</p>
      </div>
    </div>
  );
}
