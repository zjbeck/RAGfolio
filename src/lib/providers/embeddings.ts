import { GoogleGenAI } from "@google/genai";

/**
 * Provider-agnostic embeddings seam (ABSTRACTION_AUDIT.md A3). Callers never
 * see provider-specific prompt formatting or model/dimension constants — they
 * hand over raw title+text (documents) or a raw question (queries) and get
 * vectors back. This is a separate decision from the chat provider: a
 * consumer could run Groq for chat and Gemini for embeddings, or vice versa
 * once a second embeddings adapter exists.
 */
export interface EmbeddingsAdapter {
  readonly model: string;
  readonly dimensions: number;
  /** Embed already-chunked documents for the corpus index (ingest-time). */
  embedDocuments(
    docs: { title: string; text: string }[],
    onProgress?: (done: number, total: number) => void
  ): Promise<number[][]>;
  /** Embed a single user query for retrieval (request-time). */
  embedQuery(question: string, signal?: AbortSignal): Promise<number[]>;
}

function isRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2_000;

/**
 * gemini-embedding-2 (verified against live docs 2026-07-06; gemini-embedding-001
 * is marked for migration). 768 dims keeps the static artifact small; the
 * model auto-normalizes truncated dimensions, so cosine similarity needs no
 * post-processing. It does not support taskType — asymmetric retrieval
 * formatting rides in the prompt text instead (the two private formatters
 * below), which is why that formatting lives inside this adapter and never
 * leaks to callers (ingest.ts, nodes.ts) — the A3 fix.
 */
class GeminiEmbeddingsAdapter implements EmbeddingsAdapter {
  readonly model = "gemini-embedding-2";
  readonly dimensions = 768;

  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!process.env.GEMINI_EMBEDDING_API_KEY) {
      throw new Error(
        "GEMINI_EMBEDDING_API_KEY is not set. Embeddings require it — see .env.example."
      );
    }
    this.client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_EMBEDDING_API_KEY });
    return this.client;
  }

  private formatDocument(title: string, text: string): string {
    return `title: ${title || "none"} | text: ${text}`;
  }

  private formatQuery(question: string): string {
    return `task: question answering | query: ${question}`;
  }

  /**
   * `signal` is optional (ingest's build-time calls have no request to cancel
   * against) — when given, it's forwarded to the SDK. Per @google/genai's own
   * docs, abort is client-side only: it stops us from waiting on a response
   * already in flight, but does not cancel billing for that specific call. Its
   * real value here is `throwIfAborted()` below, which skips starting the
   * call at all once a caller (the Retrieve node) already knows the client
   * is gone.
   */
  private async embedOne(text: string, signal?: AbortSignal): Promise<number[]> {
    for (let attempt = 1; ; attempt++) {
      signal?.throwIfAborted();
      try {
        const response = await this.getClient().models.embedContent({
          model: this.model,
          contents: text,
          config: { outputDimensionality: this.dimensions, abortSignal: signal },
        });
        const values = response.embeddings?.[0]?.values;
        if (!values || values.length !== this.dimensions) {
          throw new Error(
            `Embedding response had ${values?.length ?? 0} dimensions, expected ${this.dimensions}`
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

  /** Sequential (build-time tool; politeness beats throughput). */
  async embedDocuments(
    docs: { title: string; text: string }[],
    onProgress?: (done: number, total: number) => void
  ): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const [i, doc] of docs.entries()) {
      vectors.push(await this.embedOne(this.formatDocument(doc.title, doc.text)));
      onProgress?.(i + 1, docs.length);
    }
    return vectors;
  }

  async embedQuery(question: string, signal?: AbortSignal): Promise<number[]> {
    return this.embedOne(this.formatQuery(question), signal);
  }
}

/**
 * The embeddings seam: swap this export for a different EmbeddingsAdapter
 * implementation to change providers. No EMBEDDINGS_PROVIDER env var exists
 * yet — Gemini is the only implementation — so there's nothing to select.
 */
export const embeddings: EmbeddingsAdapter = new GeminiEmbeddingsAdapter();
