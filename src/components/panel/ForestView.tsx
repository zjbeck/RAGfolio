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

/**
 * The RAG Files forest: each collection is an independent root laid out in a
 * rectangular grid of clusters (not radial, not one unified tree). Retrieved
 * docs highlight in accent; the rest dim via dedicated --dim tokens (never
 * opacity, so they stay AA-legible). Cross-links from frontmatter draw as thin
 * lines between clusters for retrieved docs.
 *
 * displayMode (always | onSelect | off) lets tests switch link rendering
 * cheaply; default "always". Link labels reveal when an endpoint node is
 * hovered or selected (hovering a thin SVG line is unreliable). Selecting a
 * node opens a tooltip card with a link to the document.
 */
export function ForestView({
  forest,
  retrievedDocIds,
  displayMode = "always",
}: {
  forest: ForestData;
  retrievedDocIds: Set<string>;
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
        {segments.map((s) => (
          <g key={`${s.from}->${s.to}`}>
            <line
              x1={s.a.x}
              y1={s.a.y}
              x2={s.b.x}
              y2={s.b.y}
              stroke={s.touches ? "var(--accent)" : "var(--dim-line)"}
              strokeWidth={s.touches ? 1.5 : 1}
            />
            {s.touches && (
              <text
                x={(s.a.x + s.b.x) / 2}
                y={(s.a.y + s.b.y) / 2 - 4}
                textAnchor="middle"
                className="fill-muted font-mono text-[9px]"
              >
                {s.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Clusters, one per collection, in a rectangular grid. */}
      <div className="relative z-10 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
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
              <div className="grid grid-cols-2 gap-1.5">
                {docs.map((doc) => {
                  const id = docId(doc);
                  const retrieved = retrievedDocIds.has(id);
                  const isSelected = selected === id;
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
                      className={`truncate rounded-[var(--radius-sm)] border px-2 py-1.5 text-left text-[11px] leading-tight transition-colors ${
                        retrieved
                          ? "border-accent bg-accent-soft text-ink"
                          : "border-dim-line text-dim-ink hover:text-ink"
                      } ${isSelected ? "ring-2 ring-accent" : ""}`}
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

      {/* Legend. */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-accent bg-accent-soft" />
          {copy.panel.forest.retrieved}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dim-line" />
          {copy.panel.forest.notRetrieved}
        </span>
      </div>
    </div>
  );
}
