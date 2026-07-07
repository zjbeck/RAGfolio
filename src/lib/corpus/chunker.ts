import GithubSlugger from "github-slugger";
import type { Heading, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** A chunk before doc-level metadata (collection, facets, id) is attached. */
export interface RawChunk {
  headingPath: string[];
  /** github-slugger slug of the chunk's heading; "" for anchorless chunks. */
  anchorId: string;
  /** Raw markdown, sliced from the source (headings included). */
  text: string;
  /** Character offsets into the doc body — the raw-view overlay markers. */
  start: number;
  end: number;
}

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Split a markdown body into chunks at every heading, preserving the full
 * heading path per chunk. Bodies shorter than `wholeDocThreshold` become a
 * single whole-doc chunk.
 *
 * Anchor slugs are generated with github-slugger in document order — the same
 * algorithm rehype-slug applies to the rendered page — so a chunk's anchorId
 * always deep-links to its heading. Chunk text is sliced from the raw source
 * by AST offsets (never re-serialized), keeping start/end exact.
 */
export function chunkMarkdown(
  body: string,
  wholeDocThreshold: number
): RawChunk[] {
  const trimmed = body.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length < wholeDocThreshold) {
    return [
      { headingPath: [], anchorId: "", text: trimmed, start: 0, end: body.length },
    ];
  }

  const tree = parser.parse(body) as Root;
  const slugger = new GithubSlugger();

  // Collect heading boundaries with their heading-path context.
  const boundaries: Array<{
    headingPath: string[];
    anchorId: string;
    start: number;
  }> = [];
  const stack: Array<{ depth: number; text: string }> = [];

  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    const heading = node as Heading;
    const text = mdastToString(heading);
    const anchorId = slugger.slug(text);
    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop();
    }
    stack.push({ depth: heading.depth, text });
    boundaries.push({
      headingPath: stack.map((h) => h.text),
      anchorId,
      start: heading.position!.start.offset!,
    });
  }

  // No headings at all: treat as one whole-doc chunk regardless of length.
  if (boundaries.length === 0) {
    return [
      { headingPath: [], anchorId: "", text: trimmed, start: 0, end: body.length },
    ];
  }

  const chunks: RawChunk[] = [];

  // Preamble: content before the first heading, if any.
  const preamble = body.slice(0, boundaries[0].start).trim();
  if (preamble.length > 0) {
    chunks.push({
      headingPath: [],
      anchorId: "",
      text: preamble,
      start: 0,
      end: boundaries[0].start,
    });
  }

  boundaries.forEach((boundary, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : body.length;
    const text = body.slice(boundary.start, end).trim();
    if (text.length === 0) return;
    chunks.push({
      headingPath: boundary.headingPath,
      anchorId: boundary.anchorId,
      text,
      start: boundary.start,
      end,
    });
  });

  return chunks;
}
