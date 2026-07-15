# Swapping providers

Chat and embeddings are two independent decisions — different seams, different
env vars, different files. You can mix them freely (e.g. Groq for chat, Gemini
for embeddings).

## Chat: `src/lib/providers/chat.ts`

Set `LLM_PROVIDER` to `gemini` (documented default) or `groq`. It's read once,
at module load — an unset or invalid value fails immediately with a named
error, not a silent fallback.

| `LLM_PROVIDER` | Model | Required key |
| --- | --- | --- |
| `gemini` | `gemini-3.5-flash` | `GEMINI_CHAT_API_KEY` |
| `groq` | `openai/gpt-oss-120b` | `GROQ_API_KEY` (free tier: [console.groq.com/keys](https://console.groq.com/keys)) |

`chatModel(thinkingBudget)` returns a LangChain `BaseChatModel` — every graph
node (`analyze`, `grade`, `makeAnswer`, `redirect`) only depends on that shape
(`withStructuredOutput`, `.stream()`, `.invoke()`), never on a concrete SDK
class. That's what makes this swappable: `ChatGoogleGenerativeAI` and
`ChatGroq` both extend the same LangChain base class.

**`thinkingBudget` is Gemini-specific** (`corpus.config.ts`'s
`answerThinkingBudget`) — Groq has no equivalent dial and the Groq path
ignores it.

### Adding a third provider

1. Add the SDK's LangChain integration package (pinned exact, per this
   project's version-pinning convention).
2. Add a `"your-provider"` branch to the `LlmProvider` union and
   `resolveProvider()`'s validation.
3. Write a `yourProviderChatModel()` function returning a `BaseChatModel`,
   following `geminiChatModel()`/`groqChatModel()`'s shape: read its key via
   `requireEnv()` (so a missing key fails with this project's own named
   error, not the SDK's), set `temperature: 0`, set `maxRetries: 1` (default
   is usually 6 — see the Phase 1 note in `CLAUDE.md` for why that matters
   under sustained rate limiting).
4. Add the branch to `chatModel()`'s provider switch and to
   `activeChatModel()` (the credential badge).

## Embeddings: `src/lib/providers/embeddings.ts`

Only Gemini is implemented today (`gemini-embedding-2`, `GEMINI_EMBEDDING_API_KEY`)
— there's no `EMBEDDINGS_PROVIDER` env var yet because there's nothing to
select between. The seam is the `EmbeddingsAdapter` interface:

```ts
interface EmbeddingsAdapter {
  readonly model: string;
  readonly dimensions: number;
  embedDocuments(docs: { title: string; text: string }[], onProgress?): Promise<number[][]>;
  embedQuery(question: string, signal?: AbortSignal): Promise<number[]>;
}
```

Callers (`scripts/ingest.ts`, the Retrieve node) pass raw `{title, text}` or a
raw question string — any provider-specific prompt formatting (Gemini's
asymmetric-retrieval prefixes, for instance) stays inside that provider's own
adapter class and never leaks out. This was the actual bug the interface
fixes: the formatting used to be called by the callers directly, so every
caller had to know it was talking to Gemini.

### Adding a different embeddings provider

1. Add the SDK, pinned exact.
2. Write a class implementing `EmbeddingsAdapter` — `model` and `dimensions`
   as readonly properties (the ingest artifact stores both, and a
   model/dimension change invalidates the whole embedding cache, since old
   and new vectors aren't cosine-comparable).
3. Export it as `embeddings` in place of `new GeminiEmbeddingsAdapter()`.

That's the whole seam — `ingest.ts` and `nodes.ts` never reference a provider
name directly.

## Why this exists

Chat provider, embeddings provider, and rate limiting (see
[environment.md](./environment.md)) are the project's three genuinely
swappable seams. This page exists because none of them were documented before
— a consumer had no way to discover they were swappable at all short of
reading the source.
