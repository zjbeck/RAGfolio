/**
 * Build-time ingest: content/*.md → src/generated/corpus.json
 *
 * Reads every collection directory, validates frontmatter against the
 * corpus.config.ts facet vocabulary, chunks by markdown headings (whole-doc
 * fallback below the config threshold), embeds with gemini-embedding-2, and
 * emits one static JSON artifact. Fails loudly on any inconsistency —
 * a template consumer's first ingest error should name the file and the fix.
 *
 * Run: npm run ingest   (also runs automatically as part of `npm run build`)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import corpusConfig from "../corpus.config";
import { chunkMarkdown } from "../src/lib/corpus/chunker";
import { embeddings } from "../src/lib/providers/embeddings";
import type {
  Chunk,
  CorpusArtifact,
  CrossLink,
  DocMeta,
  EmbeddedChunk,
  FacetFilter,
} from "../src/lib/corpus/types";
import { loadEnvLocal } from "./load-env";

const CONTENT_DIR = path.resolve(process.cwd(), "content");
const OUTPUT_PATH = path.resolve(process.cwd(), "src/generated/corpus.json");

function fail(message: string): never {
  console.error(`\n✗ ingest failed: ${message}`);
  process.exit(1);
}

/** Content-addressed key for the embedding cache: identical text → identical hash. */
function hashContent(frontmatterText: string, body: string): string {
  return crypto.createHash("sha256").update(frontmatterText).update("\0").update(body).digest("hex");
}

/** Frontmatter shape we accept; facet keys are validated dynamically. */
interface Frontmatter {
  title?: unknown;
  description?: unknown;
  cross_links?: unknown;
  [key: string]: unknown;
}

function parseDoc(
  collection: string,
  filename: string
): { meta: DocMeta; body: string; frontmatterText: string } {
  const filePath = path.join(CONTENT_DIR, collection, filename);
  const docSlug = filename.replace(/\.md$/, "");
  const where = `content/${collection}/${filename}`;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const fence = raw.match(/^---\n([\s\S]*?)\n---/);
  const frontmatterText = fence ? fence[1] : "";
  const fm = data as Frontmatter;

  if (typeof fm.title !== "string" || fm.title.trim() === "") {
    fail(`${where}: frontmatter needs a non-empty "title"`);
  }
  if (typeof fm.description !== "string" || fm.description.trim() === "") {
    fail(`${where}: frontmatter needs a non-empty "description"`);
  }
  if (typeof fm.doc_type !== "string") {
    fail(`${where}: frontmatter needs a "doc_type"`);
  }

  // Facets: exactly the keys declared in corpus.config.ts, validated against
  // its vocabulary. Unknown values fail; absent optional facets are fine.
  const facets: FacetFilter = {};
  for (const [facetKey, vocabulary] of Object.entries(corpusConfig.facets)) {
    const value = fm[facetKey];
    if (value === undefined) continue;
    if (typeof value !== "string" || !vocabulary.includes(value)) {
      fail(
        `${where}: facet "${facetKey}" is "${String(value)}" — allowed values: ${vocabulary.join(", ")}`
      );
    }
    facets[facetKey] = value;
  }
  if (facets.doc_type === undefined) {
    fail(`${where}: "doc_type" must be one of the values declared in corpus.config.ts`);
  }

  // Cross-links: optional [{ to: "collection/docSlug", label }] — targets are
  // validated after all docs are collected.
  const crossLinks: CrossLink[] = [];
  if (fm.cross_links !== undefined) {
    if (!Array.isArray(fm.cross_links)) {
      fail(`${where}: "cross_links" must be a list of { to, label }`);
    }
    for (const link of fm.cross_links) {
      const to = (link as CrossLink)?.to;
      const label = (link as CrossLink)?.label;
      if (typeof to !== "string" || typeof label !== "string") {
        fail(`${where}: each cross_link needs string "to" and "label"`);
      }
      crossLinks.push({ to, label });
    }
  }

  return {
    meta: {
      collection,
      docSlug,
      title: fm.title.trim(),
      description: fm.description.trim(),
      facets,
      crossLinks,
      contentHash: hashContent(frontmatterText, content),
    },
    body: content,
    frontmatterText,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();

  // 1. Collections: content/ directories and corpus.config.ts must agree in
  //    both directions — a mismatch is always a consumer mistake worth naming.
  if (!fs.existsSync(CONTENT_DIR)) fail(`no content/ directory found`);
  const dirs = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const configured = corpusConfig.collections.map((c) => c.slug);
  for (const dir of dirs) {
    if (!configured.includes(dir)) {
      fail(
        `content/${dir}/ exists but is not declared in corpus.config.ts collections`
      );
    }
  }
  for (const slug of configured) {
    if (!dirs.includes(slug)) {
      fail(`corpus.config.ts declares collection "${slug}" but content/${slug}/ does not exist`);
    }
  }

  // 2. Parse and validate every doc (config order, then filename order —
  //    deterministic artifact ordering).
  const docs: DocMeta[] = [];
  const bodies = new Map<string, string>();
  const sources: Record<string, { frontmatterText: string; body: string }> = {};
  for (const { slug } of corpusConfig.collections) {
    const files = fs
      .readdirSync(path.join(CONTENT_DIR, slug))
      .filter((f) => f.endsWith(".md"))
      .sort();
    if (files.length === 0) fail(`content/${slug}/ contains no markdown files`);
    for (const file of files) {
      const { meta, body, frontmatterText } = parseDoc(slug, file);
      const key = `${meta.collection}/${meta.docSlug}`;
      docs.push(meta);
      bodies.set(key, body);
      sources[key] = { frontmatterText, body };
    }
  }

  const docsByKey = new Map(docs.map((d) => [`${d.collection}/${d.docSlug}`, d]));

  // 3. Cross-link targets must exist.
  const docKeys = new Set(bodies.keys());
  for (const doc of docs) {
    for (const link of doc.crossLinks) {
      if (!docKeys.has(link.to)) {
        fail(
          `content/${doc.collection}/${doc.docSlug}.md: cross_link target "${link.to}" does not match any doc (expected "collection/docSlug")`
        );
      }
    }
  }

  // 4. Chunk. IDs are deterministic: collection/docSlug#anchorId.
  const chunks: Chunk[] = [];
  for (const doc of docs) {
    const body = bodies.get(`${doc.collection}/${doc.docSlug}`)!;
    for (const raw of chunkMarkdown(body, corpusConfig.wholeDocChunkThreshold)) {
      const id = raw.anchorId
        ? `${doc.collection}/${doc.docSlug}#${raw.anchorId}`
        : `${doc.collection}/${doc.docSlug}`;
      chunks.push({
        id,
        collection: doc.collection,
        docSlug: doc.docSlug,
        headingPath: raw.headingPath,
        anchorId: raw.anchorId,
        facets: doc.facets,
        text: raw.text,
        start: raw.start,
        end: raw.end,
      });
    }
  }
  const ids = new Set<string>();
  for (const chunk of chunks) {
    if (ids.has(chunk.id)) fail(`duplicate chunk id "${chunk.id}"`);
    ids.add(chunk.id);
  }

  // 5. Embed — but only chunks whose doc actually changed. A doc's chunks are
  //    reused wholesale from the previous build's artifact when that doc's
  //    frontmatter+body hash is unchanged: the chunker is a deterministic pure
  //    function of body text, so an identical hash guarantees an identical
  //    chunk list (same ids, same text) and the cached vectors are still
  //    correct. New/edited docs, and any doc missing from a prior build
  //    (first run, or a corrupt/pre-cache artifact), fall through to a fresh
  //    embed — the same behavior as before this cache existed.
  const previousDocHash = new Map<string, string>();
  const previousChunkById = new Map<string, EmbeddedChunk>();
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const previous = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as CorpusArtifact;
      // A model or dimension change invalidates every cached vector — they
      // wouldn't be comparable to freshly embedded ones in cosine similarity.
      if (
        previous.embeddingModel === embeddings.model &&
        previous.dimensions === embeddings.dimensions
      ) {
        for (const d of previous.docs ?? []) {
          if (d.contentHash) previousDocHash.set(`${d.collection}/${d.docSlug}`, d.contentHash);
        }
        for (const c of previous.chunks ?? []) {
          previousChunkById.set(c.id, c);
        }
      }
    } catch {
      // Corrupt or unreadable previous artifact — treat as no cache (full embed).
    }
  }

  const docTitles = new Map(docs.map((d) => [`${d.collection}/${d.docSlug}`, d.title]));
  const embedded: (EmbeddedChunk | undefined)[] = new Array(chunks.length);
  const toEmbed: { index: number; chunk: Chunk }[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const docKey = `${chunk.collection}/${chunk.docSlug}`;
    const doc = docsByKey.get(docKey)!;
    const docUnchanged = previousDocHash.get(docKey) === doc.contentHash;
    const cached = docUnchanged ? previousChunkById.get(chunk.id) : undefined;
    if (cached && cached.embedding.length === embeddings.dimensions) {
      embedded[index] = { ...chunk, embedding: cached.embedding };
    } else {
      toEmbed.push({ index, chunk });
    }
  }

  const reused = chunks.length - toEmbed.length;
  if (toEmbed.length === 0) {
    console.log(`All ${chunks.length} chunks unchanged — 0 embedding calls.`);
  } else {
    console.log(
      `Embedding ${toEmbed.length} of ${chunks.length} chunks with ${embeddings.model} ` +
        `(${embeddings.dimensions} dims); ${reused} reused from the cache…`
    );
    const embedInputs = toEmbed.map(({ chunk }) => {
      const title = docTitles.get(`${chunk.collection}/${chunk.docSlug}`)!;
      const context =
        chunk.headingPath.length > 0
          ? `${title} — ${chunk.headingPath.join(" > ")}`
          : title;
      return { title: context, text: chunk.text };
    });
    const vectors = await embeddings.embedDocuments(embedInputs, (done, total) => {
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`  ${done}/${total}\n`);
      }
    });
    for (const [i, { index, chunk }] of toEmbed.entries()) {
      const embedding = vectors[i];
      if (
        embedding.length !== embeddings.dimensions ||
        embedding.some((v) => !Number.isFinite(v))
      ) {
        fail(`chunk "${chunk.id}" produced an invalid embedding`);
      }
      embedded[index] = { ...chunk, embedding };
    }
  }

  // 6. Write. Every slot is filled by now — either reused from cache or
  // freshly embedded above — so this cast just discharges the sparse-array
  // type the two-pass loop above needed.
  const finalChunks = embedded as EmbeddedChunk[];

  const artifact: CorpusArtifact = {
    embeddingModel: embeddings.model,
    dimensions: embeddings.dimensions,
    collections: corpusConfig.collections,
    docs,
    chunks: finalChunks,
    sources,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(artifact));

  const byCollection = new Map<string, number>();
  for (const chunk of finalChunks) {
    byCollection.set(chunk.collection, (byCollection.get(chunk.collection) ?? 0) + 1);
  }
  console.log(`\n✓ wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(
    `  ${docs.length} docs, ${finalChunks.length} chunks (${reused} reused, ${toEmbed.length} embedded):`
  );
  for (const { slug } of corpusConfig.collections) {
    console.log(`    ${slug}: ${byCollection.get(slug) ?? 0} chunks`);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
