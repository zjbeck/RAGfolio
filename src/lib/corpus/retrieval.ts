import corpusArtifact from "@/generated/corpus.json";
import type { CorpusArtifact, EmbeddedChunk, FacetFilter } from "./types";

/** A retrieved chunk: embedding stripped, similarity score attached. */
export interface ScoredChunk extends Omit<EmbeddedChunk, "embedding"> {
  score: number;
}

/**
 * The ingest artifact, resolved at bundle time — not read from disk at
 * runtime. This survives Vercel's serverless bundling (which traces static
 * imports into the function bundle) in a way runtime fs/path resolution
 * relative to process.cwd() or __dirname does not. Retrieval is in-memory
 * cosine similarity over this array — there is deliberately no vector
 * database.
 */
export function loadCorpus(): CorpusArtifact {
  return corpusArtifact as CorpusArtifact;
}

/** Keep chunks whose facets match every key of the filter. Null/empty filter keeps all. */
export function applyFacetFilter(
  chunks: EmbeddedChunk[],
  filter: FacetFilter | null
): EmbeddedChunk[] {
  if (!filter || Object.keys(filter).length === 0) return chunks;
  return chunks.filter((chunk) =>
    Object.entries(filter).every(([key, value]) => chunk.facets[key] === value)
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Cosine top-k within the given chunk set, highest score first. */
export function topK(
  queryEmbedding: number[],
  chunks: EmbeddedChunk[],
  k: number
): ScoredChunk[] {
  return chunks
    .map((chunk) => {
      const { embedding, ...rest } = chunk;
      return { ...rest, score: cosineSimilarity(queryEmbedding, embedding) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
