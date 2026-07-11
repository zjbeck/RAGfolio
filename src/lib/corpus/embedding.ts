import { GoogleGenAI } from "@google/genai";

/**
 * Current recommended Gemini embeddings model (verified against live docs
 * 2026-07-06; gemini-embedding-001 is marked for migration). 768 dims keeps
 * the static artifact small; gemini-embedding-2 auto-normalizes truncated
 * dimensions, so cosine similarity is safe without post-processing.
 */
export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 768;

/**
 * gemini-embedding-2 does not support taskType — asymmetric retrieval
 * formatting goes in the prompt text instead (per the Gemini embeddings
 * docs). Documents and queries use the documented templates below.
 */
export function formatDocumentForEmbedding(title: string, text: string): string {
  return `title: ${title || "none"} | text: ${text}`;
}

export function formatQueryForEmbedding(question: string): string {
  return `task: question answering | query: ${question}`;
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Embeddings require it — see .env.example."
    );
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2_000;

function isRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
}

/**
 * Embed a single text, retrying on rate limits with exponential backoff.
 * `signal` is optional (ingest's build-time calls have no request to cancel
 * against) — when given, it's forwarded to the SDK. Per @google/genai's own
 * docs, abort is client-side only: it stops us from waiting on a response
 * already in flight, but does not cancel billing for that specific call. Its
 * real value here is `throwIfAborted()` below, which skips starting the call
 * at all once a caller (the Retrieve node) already knows the client is gone.
 */
export async function embedText(text: string, signal?: AbortSignal): Promise<number[]> {
  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try {
      const response = await getClient().models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIMENSIONS, abortSignal: signal },
      });
      const values = response.embeddings?.[0]?.values;
      if (!values || values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding response had ${values?.length ?? 0} dimensions, expected ${EMBEDDING_DIMENSIONS}`
        );
      }
      return values;
    } catch (error) {
      if (!isRateLimit(error) || attempt >= MAX_ATTEMPTS) throw error;
      // Free-tier rate limits are per-project and not published; back off
      // politely instead of assuming a quota.
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Embed texts sequentially (build-time tool; politeness beats throughput). */
export async function embedTexts(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const [i, text] of texts.entries()) {
    vectors.push(await embedText(text));
    onProgress?.(i + 1, texts.length);
  }
  return vectors;
}
