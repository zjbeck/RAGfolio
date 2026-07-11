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

### Anti-stuck rules
1. **An interrupted edit may not have landed.** Re-read the file before
   re-editing it — never assume your last edit applied.
2. **Two failed attempts at the same fix → stop.** List 2–3 alternatives with
   tradeoffs, pick the most boring one, or escalate to the user.
3. **Never poll background tasks.** Wait for the completion notification
   instead of checking in on a loop.
4. **On 429s, back off to the quota window.** Batch remaining API-dependent
   verifications together at the end of the stage instead of retrying inline
   one at a time.
5. **Prefer bundler/framework-native mechanisms over runtime fs/path logic**
   (e.g., a static JSON import over `fs.readFileSync` against a
   `process.cwd()`- or `__dirname`-resolved path) — they survive bundling and
   deployment environments that runtime path math doesn't.

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
- **Ingest caches embeddings by content hash** (pre-ship audit P1: every
  deploy was re-embedding all 82 chunks regardless of changes). Each `DocMeta`
  carries `contentHash` (sha256 of raw frontmatter+body). Ingest reads the
  *previous* `corpus.json` (if present and its `embeddingModel`/`dimensions`
  match current — a model/dimension change invalidates the whole cache, since
  old and new vectors wouldn't be cosine-comparable) and reuses a doc's chunk
  embeddings wholesale when its hash is unchanged. Granularity is **per-doc,
  not per-chunk**: the chunker is a deterministic pure function of body text,
  so an unchanged hash guarantees an identical chunk list, and any edit inside
  a doc re-embeds all of that doc's chunks (not just the changed section).
  Verified empirically: unmodified re-run → 0 calls; editing one doc → only
  that doc's chunks (6 of 82) re-embed; `npm run build` (the real deploy path)
  benefits identically.
- **The corpus is loaded via a static import**
  (`import corpus from "@/generated/corpus.json"` in
  `src/lib/corpus/retrieval.ts`), not `fs.readFileSync` against a
  `process.cwd()`- or `__dirname`-resolved path. Bundler-resolved beats
  runtime path math: it survives Vercel's serverless bundling (which traces
  static imports into the function bundle), where both `process.cwd()` and
  `__dirname` are unreliable. Consequence: **re-running `npm run ingest`
  requires a dev-server restart** to pick up the new artifact — it's a
  build-time artifact by design, not hot-reloaded data. A `predev` script
  (`scripts/check-corpus.ts`) fails fast with a clear message if the
  artifact doesn't exist yet, since a missing static import otherwise
  surfaces as an opaque bundler error instead of an actionable one.
- **Auth split:** `src/proxy.ts` only verifies the signed session cookie
  (jose JWT) and redirects to `/gate`; the `POST /api/auth` route handler does
  the bcryptjs hash compare and issues the cookie. Fail closed:
  `SITE_PASSWORD_HASH` set but `SESSION_SECRET` missing → explicit error,
  never silently public.
- **`SITE_PASSWORD_HASH` is stored base64-encoded, not as the raw bcrypt
  hash.** Verified empirically 2026-07-07: Next's env loader expands
  `$identifier` sequences (identifier starting with a letter/underscore) in
  `.env.local` values — even quoted ones — to that variable's value, empty if
  undefined. A bcrypt hash's `$2b$12$` prefix survives (digits can't start an
  identifier) but the salt/hash body after the third `$` starts with a letter
  often enough to get silently deleted. Shell-style `$$`-doubling does **not**
  reliably fix this — outcome depends on what follows each `$` in the
  specific hash. Base64 has no `$` at all, so nothing gets matched, for any
  hash. `scripts/hash-password.ts` outputs the encoded form directly; decode
  with `decodePasswordHash` (`src/lib/auth/password-hash.ts`) at the one call
  site that needs the real hash (`POST /api/auth`) — `proxy.ts` never touches
  the hash value itself, only its presence.
- **Sliding expiry is throttled to daily re-issue** (not per-request). The
  spec says "7-day sliding expiry" without a cadence; this is a deliberate
  choice, not doc-driven. Strict per-request sliding re-signs the JWT and
  sets a cookie on every response for no security gain; re-issuing once the
  token is >24 h old keeps the sliding guarantee at day granularity (visit
  at least once every 7 days and you stay in — the window end just moves in
  24 h steps instead of continuously). Switching to per-request sliding is a
  two-line change in `src/proxy.ts`: drop the `shouldReissue` check.
- **Doc sources are baked into the corpus artifact** (`sources` map, keyed
  `collection/docSlug`), read via the static import in `getDocSource` — never
  `fs` at runtime. Same reason as the corpus static import: `process.cwd()` is
  not the project root under every launcher (it was the Desktop under the
  preview launcher) or on Vercel. Server-side only; never sent to the client
  forest (which gets doc metadata, not bodies).
- **Design tokens ship in Stage 5 as vanilla light + dark via
  `prefers-color-scheme`** (media query). Stage 6 formalizes into a
  toggle-driven vanilla/custom × light/dark with persistence. Components
  reference `--` tokens only, so Stage 6 is a palette swap. Dimmed forest
  nodes use dedicated `--dim-*` tokens (not opacity); AA verified at forest
  render — dim-ink text 4.75:1 (light) / 7.43:1 (dark); the faint node border
  is intentional (a not-retrieved node recedes and is identified by its
  AA-passing label, not its border).
- **Sequence sentences vs Pipeline data are separated by location**, which
  enforces the differentiation rule structurally: explanatory prose lives in
  `copy.ts` (`panel.sequence`), terse results data in code
  (`components/panel/format.ts`). They can't drift into duplication.
- **Forest cross-link labels reveal on node hover/select**, not on hovering
  the thin SVG lines (unreliable). displayMode (always | onSelect | off)
  controls line rendering; default always.
- **The responsive panel breakpoint is `corpus.config.ts` `minViewportWidth`**
  (not a Tailwind breakpoint), read via `useMediaQuery` (useSyncExternalStore).
  At/above it: two-column with the landing→active flex-grow-spacer slide.
  Below it: single column, panel stacked beneath the thread behind a "Show RAG
  Panel" disclosure. Chat column steps 760→680px below 1536 (internal
  constant).
- **AI SDK v7 client**: `useChat` + `DefaultChatTransport({ api })` +
  `sendMessage({ text })` + `status`. Panel events arrive as persistent
  `data-ragEvent` parts (reconciled by the per-node `id` set server-side), read
  from `message.parts` via `collectRagTurn` — no `onData` side channel needed.
- Theme toggles live in the **top nav, right side** (documented in README).
- Forest dimming uses **dedicated dimmed color tokens**, never raw opacity —
  raw 30% opacity would break AA contrast.
- **Theming is toggle-driven** (`data-mode` + `data-palette` on `<html>`),
  set before paint by a no-FOUC inline script in the layout (stored preference,
  else system for mode). Preferences persist in localStorage. `<html>` carries
  `suppressHydrationWarning` — the script mutates its attributes before React
  hydrates, so client and server markup differ by design (the standard
  next-themes pattern). Without it, the console shows a legitimate hydration
  mismatch on `<html>` every load; the app still hydrates and is interactive,
  but a stray console error is exactly the kind of thing the docs-team
  reviewers would flag. Caught in the live-chat pass, since the script
  postdates the last live test. Two vanilla
  palettes (light/dark) live in `globals.css`; the optional custom palette
  lives in `src/styles/theme.custom.css` (ships as the "Verdant" green palette).
  Toggles are in the nav (right); `ThemeToggles` reads the `<html>` attributes
  via `useSyncExternalStore` + a MutationObserver (no state-in-effect).
- **Custom-theme degradation is genuinely non-breaking**, via a generated
  shim: `scripts/detect-theme.ts` (run in predev/prebuild) writes
  `src/styles/theme.generated.css`, which `@import`s `theme.custom.css` only
  if it exists, else is empty. globals.css imports the shim, so deleting the
  custom theme never leaves a dangling `@import` — the build still succeeds and
  the palette toggle disables. `next.config.ts` independently detects the file
  to set `NEXT_PUBLIC_HAS_CUSTOM_THEME`.
  ⚠️ `next.config.ts` anchors its existence check to the config file's own
  directory via `import.meta` — NOT `process.cwd()`, which under the preview
  launcher was the Desktop (third instance of this cwd trap; see the corpus
  and doc-source notes).
- **AA verified for all four palettes** at forest render (dimmed-node text,
  the flagged requirement): vanilla light 4.75 / dark 7.43; custom light 5.24 /
  dark 6.81 — all ≥ 4.5:1. Regenerate these if palettes change.
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
