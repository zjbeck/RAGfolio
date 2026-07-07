@AGENTS.md

# CLAUDE.md — RAGfolio

RAGfolio is a public, MIT-licensed **template** for a password-gateable
portfolio/docs chatbot with a live RAG-traversal panel. It never deploys
itself — consumers generate a private repo from it, add their own markdown
content and env vars, and deploy that on Vercel. The repo is a writing sample:
code, commits, and every word of documentation are read by expert reviewers.

## Rules

### Docs win over the spec
When current library docs contradict an API detail in the build spec, implement
per the docs and flag the discrepancy (here and in the commit message).
Flagged so far:

1. **`streamEvents` → stream modes.** The spec calls for `streamEvents`;
   LangGraph.js v1 replaced it with the stream-mode API:
   `graph.stream(input, { streamMode: ["updates", "messages"] })`.
   The spec's guarantee is preserved — one stream carries both node-level
   updates and LLM token chunks.
2. **`middleware.ts` → `proxy.ts`.** Next 16 renamed Middleware to Proxy
   (same functionality; Node.js runtime by default; exports a `proxy`
   function). The password gate lives in `src/proxy.ts`.

### Research-first
Consult current docs before writing integration code — training data is stale.
(The embeddings model recommendation had already changed at project start.)

- Gemini API: https://ai.google.dev/gemini-api/docs (models, embeddings, rate limits)
- LangChain / LangGraph JS: https://docs.langchain.com
- LangChain JS API reference: https://reference.langchain.com/javascript/
- Vercel AI SDK (v7): https://ai-sdk.dev/docs
- Next.js 16: `node_modules/next/dist/docs/` — shipped with the framework
  (see AGENTS.md); prefer it over web copies.

### Version pinning
Every dependency in `package.json` is pinned exact — no `^` or `~`. When adding
a package, resolve the current version (`npm view <pkg> version`) and pin it.

## Verified API facts
- Chat model: **`gemini-3.5-flash`** (stable). Thinking is disableable —
  empirically verified: `generationConfig.thinkingConfig.thinkingBudget: 0`
  was accepted; usage dropped ~93% (400 → 27 total tokens), no
  `thoughtsTokenCount`. Thinking OFF for the Analyze and Grade nodes; the
  Answer node's budget is a config value (default 0).
- Embeddings: **`gemini-embedding-2`** is the current recommended model
  (verified against live docs 2026-07-06; `gemini-embedding-001` is marked
  for migration). We request 768-dim output. Three details verified against
  live docs: it does **not** support `taskType` — asymmetric retrieval
  formatting rides in the prompt text (document side:
  `title: {title} | text: {content}`; query side:
  `task: question answering | query: {content}`); input is limited to 8,192
  tokens per call; truncated dimensions (768/1536) are auto-normalized, so
  cosine similarity needs no post-processing.
- `ChatGoogleGenerativeAI` (`@langchain/google-genai`) accepts a
  `thinkingConfig` constructor option, and it works on gemini-3.5-flash —
  verified empirically both ways: budget 0 → no thought tokens; budget 512 →
  raw SDK reports `thoughtsTokenCount: 295` for the same prompt. Two
  accounting quirks (both verified 2026-07-06):
  - The integration does **not** map thought tokens into
    `output_token_details.reasoning`; they appear only inside `total_tokens`.
    Recover them as `total − input − output` (see `usageOf` in
    `src/lib/graph/nodes.ts`).
  - In streaming, `usage_metadata` rides on content chunks and the final
    chunk reports zeros — sum across the stream; and `streamUsage: true`
    must be set or no chunk carries usage at all.
- Gemini free-tier rate limits are per-project (AI Studio dashboard), not
  published statically. Ingest batches embedding calls and backs off on 429.
- Observed empirically 2026-07-06: the free tier allows **5 requests/min for
  gemini-3.5-flash** (`GenerateRequestsPerMinutePerProjectPerModel-FreeTier`).
  One pipeline run costs 2–3 chat calls (Analyze, Grade, Answer), so roughly
  two questions/minute on the free tier. Consequences: the eval harness must
  pace runs; interactive chat fails fast on 429 by design (a 48 s in-request
  retry would be worse UX than an honest error).

## Decisions (spec was silent; boring option chosen)
- **Package manager: npm** (pnpm not assumed; stated in README).
- The spec places the greeting in corpus.config.ts but also says all
  microcopy lives in the copy module. Resolution: **corpus.config.ts is the
  single source for the greeting; `src/copy.ts` re-exports it** — components
  only ever import copy.
- Embeddings are called via `@google/genai` directly (ingest + query time).
  Chat goes through `@langchain/google-genai` so tokens flow through the
  graph's stream.
- **Chunk anchors:** `anchorId` = github-slugger slug of the heading —
  identical to the slugs `rehype-slug` generates on rendered pages, so
  citations deep-link with no mapping table. `chunkId` =
  `{collection}/{docSlug}#{anchorId}`. Deterministic: unchanged content →
  unchanged IDs.
- **Route is a real pass-through node** that writes `route: "answer" | "refuse"`
  to state (so the decision is visible in `updates` events), followed by a
  conditional edge that reads it.
- **Graph node names are the spec's display names, capitalized** ("Analyze",
  "Filter", …). LangGraph puts node names and state channels in one
  namespace, and the state key `filter` (spec-named) collides with a
  lowercase `filter` node.
- **A filter that matches zero chunks is dropped, not obeyed** — recorded as
  `filterRelaxed: true` in state (the panel shows it; nothing is silent).
  Refusing an answerable question over a self-inflicted over-narrow filter
  helps no one; honest refusals are for content that genuinely isn't there.
- **Each LLM node reports its own token usage into state** (`usage` field,
  spread-merged — safe because the graph is sequential). Structured-output
  calls don't surface usage through the messages stream, and Gemini streams
  put usage on content chunks (the final chunk reports zeros — sum across
  the stream). `streamUsage: true` must be set on the model.
- **Citations**: the Answer prompt requires inline `[n]` markers; they parse
  into `{ ref, collection, docSlug, anchorId, label }`. If the model cites
  nothing, the full retrieved set is cited — the answer was generated from
  exactly that set, so the pills stay honest.
- **Refuse is templated from authored copy, not LLM-generated** — zero
  fabrication by construction. It interpolates the collections/filter searched.
- `src/generated/corpus.json` is a **gitignored build artifact**; `npm run
  build` runs ingest first, so `GEMINI_API_KEY` must be present at build time
  (on Vercel: a project env var covers build and runtime).
- **Auth split:** `src/proxy.ts` only verifies the signed session cookie
  (jose JWT) and redirects to `/gate`; the `POST /api/auth` route handler does
  the bcryptjs hash compare and issues the cookie. Sliding 7-day expiry —
  re-issued when older than 24 h. Fail closed: `SITE_PASSWORD_HASH` set but
  `SESSION_SECRET` missing → explicit error, never silently public.
- Theme toggles live in the **top nav, right side** (documented in README).
- Forest dimming uses **dedicated dimmed color tokens**, never raw opacity —
  raw 30% opacity would break AA contrast.
- Custom-theme detection: `next.config.ts` checks for
  `src/styles/theme.custom.css` at build time and exposes
  `NEXT_PUBLIC_HAS_CUSTOM_THEME`; the palette toggle renders disabled when
  absent.
- `@types/node` pinned to 22.x to match Vercel's Node runtime;
  `engines.node >= 20`.
- `npm audit` reports 2 moderate advisories in next@16.2.10's own bundled
  postcss — upstream, not actionable here (the suggested "fix" downgrades
  Next to 9.x).

## Conventions
- **All user-facing microcopy lives in `src/copy.ts`** — components never
  contain literal user-facing strings. Consumers rewrite every word without
  touching components.
- **Nothing about collections is hardcoded in components** — everything derives
  from `content/` directory structure + `corpus.config.ts`.
- Consumer-replaceable content is marked with `[PLACEHOLDER]` notes.
- Commits: conventional (`feat:` / `fix:` / `docs:` / `chore:`), imperative
  mood, no noise. Commit messages are part of the writing sample.
- Standalone scripts run with tsx: `scripts/ingest.ts`, `scripts/ask.ts`,
  `scripts/eval.ts`.

## Don'ts
- No vector database — build-time ingest → static JSON → in-memory cosine.
- No Python, no second service.
- No GitHub token anywhere (Vercel's GitHub integration handles repo access).
- No real people, employers, or resume-shaped content. All example content is
  unmistakably fictional (Verdant, a smart-terrarium automation platform).
- Never silently public: gate misconfiguration must fail closed.
- Don't trust training data for model names or APIs — verify against live docs.
