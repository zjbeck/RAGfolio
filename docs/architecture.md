# Architecture

RAGfolio is one Next.js app. There is no second service, no Python, and no
vector database. This document is the map; the `/how-it-works` page is the
visitor-facing version of the same story.

## The shape of it

```
content/**.md ──(build: npm run ingest)──▶ src/generated/corpus.json
                                                   │  (chunks + embeddings + raw sources)
                                                   ▼
   question ─▶ LangGraph pipeline ─▶ cited answer  +  live panel events
                (in-memory cosine over the artifact — no vector DB)
```

## Ingest (build time)

[`scripts/ingest.ts`](../scripts/ingest.ts) reads every `content/<collection>/`
directory, validates frontmatter against `corpus.config.ts`, and:

- **Chunks by markdown heading**, preserving the full heading path for each
  chunk. Docs shorter than `wholeDocChunkThreshold` become a single whole-doc
  chunk.
- **Assigns deterministic IDs** — `collection/docSlug#anchorId`, where
  `anchorId` is the github-slugger slug of the heading. That's the same slug
  `rehype-slug` puts on the rendered page, so a citation deep-links to its
  section with no mapping table. Unchanged content keeps the same ID across
  builds.
- **Embeds** each chunk with `gemini-embedding-2` (768 dimensions).
- **Emits one static JSON** — chunks, embeddings, doc metadata, and each doc's
  raw source (for the raw view). Nothing reads `content/` at runtime.

The artifact is a build product (gitignored). `npm run build` runs ingest
first, so `GEMINI_API_KEY` must be present at build time.

## The pipeline (LangGraph.js)

Six nodes over a typed state `{ question, filter, chunks, verdict, route,
answer, citations, usage }`:

1. **Analyze** — classify intent and extract a facet filter from the config
   vocabulary (self-query style). Thinking off.
2. **Filter** — narrow the corpus by facets. A filter that matches nothing is
   dropped and recorded as relaxed, rather than forcing a refusal on an
   answerable question.
3. **Retrieve** — cosine top-`k` within the filtered set.
4. **Grade** — a separate LLM judgment: do these chunks actually answer the
   question? `sufficient | insufficient`. Not a similarity threshold. Thinking
   off.
5. **Route** — a real node that records the decision, then a conditional edge.
6. **Answer** — a cited reply grounded only in the retrieved chunks; thinking
   budget from config (default 0). **Refuse** — templated honest copy that
   names the collections and filter searched. Zero fabrication.

Thinking is disabled where correctness doesn't need it (Analyze, Grade) and is a
tunable budget on Answer. See [evals.md](./evals.md) for A/B'ing that budget.

## One stream, two consumers

The graph is streamed with LangGraph's `streamMode: ["updates", "messages"]`:
node-level state updates and LLM token chunks come out of the **same** stream.

- The **CLI** ([`scripts/ask.ts`](../scripts/ask.ts)) consumes it directly and
  prints node events and the answer.
- The **chat route** ([`src/app/api/chat/route.ts`](../src/app/api/chat/route.ts))
  wraps it in the Vercel AI SDK's UI message stream: node updates become
  persistent `data-ragEvent` parts (one per node, reconciled by id), answer
  tokens become text parts. The client reads panel state from the assistant
  message's parts — no side channel.

LangSmith tracing turns on automatically when `LANGSMITH_API_KEY` is present and
is a silent no-op otherwise.

## Auth and rate limiting

Both are optional and off by default.

- **Gate:** [`src/proxy.ts`](../src/proxy.ts) (Next 16 renamed Middleware to
  Proxy) verifies a signed session cookie and redirects to `/gate`;
  `POST /api/auth` does the bcrypt compare and issues the cookie. If a password
  hash is set without a session secret, it **fails closed** with an explicit
  error — never silently public.
- **Rate limiting:** Upstash sliding windows on the chat and auth endpoints,
  active only when the Upstash env vars are set.

See [environment.md](./environment.md) for the exact variables.

## Where things live

```
content/                    your markdown, grouped into collections
corpus.config.ts            collections, facets, chips, retrieval knobs
src/
  copy.ts                   ALL visitor-facing strings
  proxy.ts                  the password gate
  app/
    page.tsx                landing + active chat
    api/chat, api/auth      streaming chat, gate auth
    docs/[collection]/[slug] document pages (rendered/raw)
    how-it-works            example self-documentation (replace it)
  lib/
    graph/                  state, nodes, graph assembly
    corpus/                 chunker, embedding, retrieval, server-data
    panel/                  turning stream events into panel state
  components/               nav, chat, panel, docs, ui
  styles/theme.custom.css   optional custom palette
scripts/                    ingest, ask, eval, hash-password, detect-theme
```
