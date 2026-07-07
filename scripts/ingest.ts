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
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import corpusConfig from "../corpus.config";
import { chunkMarkdown } from "../src/lib/corpus/chunker";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embedTexts,
  formatDocumentForEmbedding,
} from "../src/lib/corpus/embedding";
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

  // 5. Embed. Document title carries doc + heading context so short chunks
  //    still embed with enough signal.
  console.log(
    `Embedding ${chunks.length} chunks from ${docs.length} docs with ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)…`
  );
  const docTitles = new Map(docs.map((d) => [`${d.collection}/${d.docSlug}`, d.title]));
  const embedInputs = chunks.map((chunk) => {
    const title = docTitles.get(`${chunk.collection}/${chunk.docSlug}`)!;
    const context =
      chunk.headingPath.length > 0
        ? `${title} — ${chunk.headingPath.join(" > ")}`
        : title;
    return formatDocumentForEmbedding(context, chunk.text);
  });
  const vectors = await embedTexts(embedInputs, (done, total) => {
    if (done % 10 === 0 || done === total) {
      process.stdout.write(`  ${done}/${total}\n`);
    }
  });

  // 6. Validate and write.
  const embedded: EmbeddedChunk[] = chunks.map((chunk, i) => {
    const embedding = vectors[i];
    if (
      embedding.length !== EMBEDDING_DIMENSIONS ||
      embedding.some((v) => !Number.isFinite(v))
    ) {
      fail(`chunk "${chunk.id}" produced an invalid embedding`);
    }
    return { ...chunk, embedding };
  });

  const artifact: CorpusArtifact = {
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    collections: corpusConfig.collections,
    docs,
    chunks: embedded,
    sources,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(artifact));

  const byCollection = new Map<string, number>();
  for (const chunk of embedded) {
    byCollection.set(chunk.collection, (byCollection.get(chunk.collection) ?? 0) + 1);
  }
  console.log(`\n✓ wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(`  ${docs.length} docs, ${embedded.length} chunks:`);
  for (const { slug } of corpusConfig.collections) {
    console.log(`    ${slug}: ${byCollection.get(slug) ?? 0} chunks`);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
