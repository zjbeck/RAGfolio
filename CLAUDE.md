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
3. **Groq model choice, V2 Phase 1.** A web search claimed
   `llama-3.3-70b-versatile` is deprecated on Groq; `console.groq.com/docs/models`
   (fetched live 2026-07-14) still listed it under "Production Models" with no
   deprecation notice, which read as unconfirmed — but that page doesn't carry
   deprecation notices at all. **Confirmed 2026-07-14 against
   `console.groq.com/docs/deprecations`** (a separate page, checked on a
   follow-up pass): `llama-3.3-70b-versatile` is scheduled for shutdown
   **08/16/26**, with `openai/gpt-oss-120b` listed as one of its own two
   recommended replacements. `gpt-oss-120b` was already the choice going in
   (LangChain's ChatGroq docs use it as their canonical example); this
   confirms it was also the forward-looking one, not merely an ambiguity
   sidestep.

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
- **`chatModel()`'s `ChatGoogleGenerativeAI` sets `maxRetries: 1`** (was
  unset, defaulting to LangChain's `AsyncCaller` default of 6). Correction to
  the record: the note above about chat "failing fast on 429 by design" was
  aspirational, not actual, until this fix — a real 429 with a `Retry-After`
  ≤60s is classified by `AsyncCaller` as `"wait"` and retried silently,
  backing off across all three chat calls (Analyze, Grade, Answer) into a
  multi-minute hang. On the live deploy this surfaced as
  `FUNCTION_INVOCATION_TIMEOUT` (raising `maxDuration` 60→180 didn't help —
  confirming it was retries, not raw slowness). `1` keeps a single quick
  retry for a genuine transient blip without re-enabling the chain.
  ⚠️ **Phase 1 of the provider-abstraction refactor (V2) must preserve
  this.** When the Gemini chat call moves into its own provider adapter,
  `maxRetries: 1` (or the equivalent bounded-retry behavior in whatever HTTP
  client the adapter uses) has to travel with it — nothing fails a
  type-check or test if it's dropped, and the multi-minute hang only
  reappears under real sustained rate-limiting, not in dev.
  ✅ **Resolved in V2 Phase 1** (see below): `maxRetries: 1` is set on both
  the Gemini and Groq chat adapters in `src/lib/providers/chat.ts`.

## V2 Phase 1 — Provider Abstraction

Chat and embeddings are two independent seams (ABSTRACTION_AUDIT.md A3), each
with its own module under `src/lib/providers/`.

- **Chat** (`src/lib/providers/chat.ts`): `chatModel(thinkingBudget)` returns
  `BaseChatModel` (`@langchain/core/language_models/chat_models`) — not a
  bespoke wrapper interface. This is a deliberate, boring choice: both
  `ChatGoogleGenerativeAI` and `ChatGroq` already extend the exact same
  LangChain abstract class, and every graph node (`nodes.ts`) already only
  depended on that shape (`withStructuredOutput`, `.stream()`, `.invoke()`) —
  the old `ChatGoogleGenerativeAI` return-type annotation was the only
  Gemini-specific leak, and removing it required no changes to Analyze,
  Grade, or Answer beyond the import. Inventing a second, custom interface on
  top of an interface that already exists and already fits would be
  needless indirection.
  - Provider selection: `LLM_PROVIDER` env var, `"gemini" | "groq"`, resolved
    **once at module load** (`resolveProvider()`, same eager-throw pattern as
    the partial-Upstash-config check in `ratelimit.ts`) — fails at boot with
    a named error if unset or invalid, never silently defaults. `.env.example`
    ships with `LLM_PROVIDER=gemini` pre-filled as the *documented* default
    (a template file convenience), not a code-level fallback — delete that
    line and every entry point (the Next server, `scripts/ask.ts`,
    `scripts/eval.ts`) throws immediately on import, naming the fix.
  - Gemini: `gemini-3.5-flash` (unchanged), key `GEMINI_CHAT_API_KEY`.
  - Groq: `openai/gpt-oss-120b` — confirmed, not just picked-and-hoped: it's
    Groq's own listed replacement for `llama-3.3-70b-versatile` (shutting
    down 08/16/26, per the Research-first flag above), key `GROQ_API_KEY`
    (LangChain's own default lookup name for `ChatGroq`,
    verified against `docs.langchain.com/oss/javascript/integrations/chat/groq`
    2026-07-14 — passed explicitly rather than relying on the SDK's implicit
    lookup, for the same reason `nodes.ts` always did this for Gemini: a
    missing key produces this project's own named error, not LangChain's).
    `thinkingConfig` is Gemini-only; `chatModel()`'s `thinkingBudget` argument
    is silently a no-op on the Groq path (Groq has no equivalent dial).
  - **Live-verified 2026-07-14**: one real call through the Analyze node with
    `LLM_PROVIDER=groq` — correct intent (`"how-to"`) and facet extraction
    (`module: "sensors"`) from "How do I calibrate a soil-moisture sensor?",
    and — unexpectedly — `usage_metadata` was populated
    (`inputTokens: 488, outputTokens: 189`) with no Gemini-style `streamUsage`
    flag needed. This resolves what would otherwise have been an open
    question about usage-tracking parity across providers.
- **Embeddings** (`src/lib/providers/embeddings.ts`): a separate
  `EmbeddingsAdapter` interface — `{ model, dimensions, embedDocuments(docs),
  embedQuery(question) }` — replacing the old `src/lib/corpus/embedding.ts`.
  The actual A3 bug wasn't the missing interface so much as *where the
  Gemini-specific formatting lived*: `formatDocumentForEmbedding` /
  `formatQueryForEmbedding` (the `title: X | text: Y` / `task: … | query: Z`
  asymmetric-retrieval prefixes gemini-embedding-2 needs since it doesn't
  support `taskType`) were called by the *callers* (`ingest.ts`, `nodes.ts`),
  not the embeddings module — every caller had to know it was talking to
  Gemini. Both formatters are now private methods on
  `GeminiEmbeddingsAdapter`; callers pass raw `{title, text}` or a raw
  question and never see provider-specific formatting.
  - No `EMBEDDINGS_PROVIDER` env var exists — Gemini is the only
    implementation, so there is nothing to select yet. The seam is the
    `embeddings` export itself; a second adapter would just replace it.
  - Key renamed to `GEMINI_EMBEDDING_API_KEY` — independent of the chat key,
    so a Groq-chat + Gemini-embeddings deployment sets only
    `GEMINI_EMBEDDING_API_KEY`, never `GEMINI_CHAT_API_KEY`.
  - **Live-verified 2026-07-14**: one real `embedQuery` call through the
    refactored adapter → 768-dim vector, every value finite.
- ⚠️ **Breaking env var rename.** `GEMINI_API_KEY` (one var, shared by chat
  and embeddings) no longer exists. It's now `LLM_PROVIDER` +
  `GEMINI_CHAT_API_KEY` (or `GROQ_API_KEY`) + `GEMINI_EMBEDDING_API_KEY`.
  **The live `zacharybeck.dev` Vercel deployment still has the old
  `GEMINI_API_KEY` var set and does not yet have this Phase 1 code** — its
  env vars must be updated (and the deploy repo must receive this same
  refactor) before this change reaches that project, or the site fails
  closed at boot (by design — consistent with this project's fail-closed
  conventions elsewhere) rather than silently breaking.
- `@langchain/groq@1.3.1` added as a pinned exact dependency (peer dep
  `@langchain/core ^1.1.30`, satisfied by this project's `1.2.1`).

## V2 Phase 2 — Identity & Content Foundation

Per ABSTRACTION_AUDIT.md §4, A1 and A2 were folded into the same pass as the
Verdant-content removal rather than treated as separate cleanup — a
content-only swap would have shipped a still-Verdant-coupled pipeline.

- **Identity block**: `CorpusConfig.identity` (`name`, `role`, `bio`,
  `links`) added to `types.ts`/`corpus.config.ts` — schema-shaped, not prose
  (ABSTRACTION_AUDIT.md V2-15). ⚠️ **Not yet wired into any component.** No
  phase in the V2 spec explicitly claims that surfacing, and the obvious
  candidates (the landing greeting, a footer) overlap with Phase 4/5's
  planned redesigns and Phase 6's credential badge — wiring it in now risked
  colliding with work those phases own. Flagged rather than guessed at.
- **Analyze prompt (A1 fix)**: facet guidance in `nodes.ts` is now templated
  entirely from `corpus.config.ts`'s declared facets — each facet gets a line
  built from its own real allowed values (`values.slice(0, 2).join(" or ")`),
  replacing the old hardcoded `doc_type`/`module` names and Verdant examples
  ("soil-moisture sensor", "the API reference for…"). The "phrasing isn't
  evidence for a value" principle generalized from the old doc_type-specific
  "how do I… does NOT mean guide" line.
- **`requiredFacets` (A2 fix)**: `corpus.config.ts` now declares
  `requiredFacets: string[]` (empty by default); `ingest.ts` enforces
  membership generically instead of hardcoding `doc_type`. A config-
  consistency check (every `requiredFacets` key must exist in `facets`) runs
  once in `main()`, separate from the per-doc check.
- **Collection index pages**: each collection directory needs a reserved
  `_index.md` (title + description only) — parsed by
  `parseCollectionIndex()` in `ingest.ts`, stored in the artifact as
  `collectionPages` (keyed by slug), and **excluded from docs/chunks/
  embedding/retrieval entirely**. New route `src/app/docs/[collection]/
  page.tsx` + `CollectionView.tsx` render it as a container: title,
  description, and a thumbnail grid of the collection's docs (from the
  existing `DocMeta` list — no new per-doc data needed). `getNavTabs()` now
  links here instead of to each collection's first doc (the old behavior,
  and its "the spec defines per-doc pages, not collection indexes" comment,
  is gone — that constraint no longer holds).
- **Content scaffolding**: `content/` ships with the same 5 collection slugs
  (they're generic docs-taxonomy labels — Guides, API Reference, Concepts,
  Troubleshooting, Release Notes — not Verdant-specific, so kept rather than
  invented a new taxonomy the spec never asked for) but zero Verdant prose.
  Each collection has one `example-*.md` clearly marked `[PLACEHOLDER]`,
  demonstrating real frontmatter shape, one facet (`doc_type`), and
  heading-based chunking; `guides/example-guide.md` also demonstrates
  `cross_links`. The shipped `facets` vocabulary dropped the old `module`
  facet entirely (100% Verdant-specific, no generic replacement would be
  less arbitrary than just removing it) and kept `doc_type` (generic,
  structural) as the one demonstrative example.
- **Regression test for A1+A2 (task 6), both halves verified live**: a
  temporary fixture (`corpus.config.ts` + `content/notes/`, non-Verdant
  `category`/`year` facets, `requiredFacets: ["category"]`) was swapped in
  after staging the real Phase 2 files in the git index (so restoring via
  `git checkout -- corpus.config.ts content/` was safe). Confirmed:
  (1) `npm run ingest` succeeds against the fixture — A2; (2) removing the
  required `category` facet from the one test doc fails ingest with a named,
  config-driven error — proves `requiredFacets` is real enforcement, not
  decorative; (3) a live Analyze-node call ("Is there a tutorial on
  widgets?") against the fixture correctly extracted `category: "tutorial"`
  using only the generic, schema-derived prompt — proves A1 is fixed for
  genuinely arbitrary facet names, not just non-crashing. Fixture removed
  and real scaffold restored before committing.
- Unresolved gap surfaced, not fixed (out of scope for this phase):
  `scripts/eval.ts` and `docs/evals.md` still reference Verdant-specific
  content/questions. No phase in the V2 spec touches them; `npm run eval`
  will not pass against the new empty scaffold until something does.

## V2 Phase 3 — Hardening & Hygiene

Four independent ABSTRACTION_AUDIT.md findings, each verified via grep
(no remaining hardcoded instance) after the fix:

- **A4**: `copy.ts`'s panel footnote no longer names LangSmith — reworded
  vendor-neutral ("...for the underlying event data") rather than
  conditioning on the tracing flag, since the flag isn't otherwise plumbed
  into any client component and a wording fix is simpler and always
  accurate either way.
- **A5**: `CorpusConfig.repoUrl: string | null` replaces the hardcoded
  constant in `site.ts` (now a thin re-export, same pattern as `copy.ts`
  re-exporting `siteName`/`greeting`). Ships `null` by default — no GitHub
  icon, no repo link on how-it-works — rather than pointing at the
  template's own repo, which is the actual A5 bug (a forgotten deploy
  silently sending visitors to `zjbeck/RAGfolio`). `ingest.ts` warns
  (doesn't fail) at build time if `repoUrl` still equals the upstream
  template URL — verified live both ways: warns when set to it, silent
  when `null`. `TopNav.tsx`'s GitHub icon and `how-it-works/page.tsx`'s
  closing repo-link paragraph are both conditional on `REPO_URL` now.
- **A6**: Upstash keyspace prefix is now `` ragfolio:${VERCEL_ENV ?? "local"}:${kind} ``
  — Preview and Production no longer share a rate-limit bucket when they
  share one Redis instance (the default way Vercel env vars get set,
  per the audit). `VERCEL_ENV` is a Vercel system var, set automatically —
  no consumer configuration needed. Local dev (unset) gets `"local"`,
  distinct from both.
- **A7**: four strings moved out of components/pages that had them
  hardcoded, contradicting the project's own "components never contain
  literal user-facing strings" rule: the theme-toggle tooltip that leaked
  a source file path (now `copy.nav.themePaletteUnavailable`), the SEO
  meta description (now `copy.seo.description`), `TopNav`'s
  `aria-label="Collections"` (now `copy.nav.collections`), and `lang="en"`
  (now `CorpusConfig.lang`, read directly in `layout.tsx` — a locale/config
  value, not visitor-facing microcopy, so it goes through `corpus.config.ts`
  rather than `copy.ts`, consistent with how other structural config values
  are consumed elsewhere in this codebase).

## V2 Phase 4 — RAG Panel & Retrieval Visualization Redesign

A full redesign of `ForestView.tsx`, not a patch — all four decisions below
were live-verified with a real pipeline run (not just type-checked), since a
UI redesign that only compiles hasn't actually been verified.

- **Cross-links default to `onSelect`, not `always`.** The old default
  rendered every retrieved doc's links simultaneously as straight lines — an
  illegible overlapping web once more than a couple of docs were retrieved.
  `onSelect` (only the hovered/selected node's links render) was chosen over
  a permanent highlight-only mode because it still lets a visitor *discover*
  that cross-links exist by hovering around, rather than requiring them to
  already know to select a specific node. Lines are now quadratic-bezier
  curves (perpendicular control-point offset, capped at 40px of bow) with a
  3px accent dot at each endpoint — "routed," not straight, with legible
  endpoints, per the spec's own framing. Verified live: hovering a retrieved
  node renders exactly one curved `<path>` (confirmed via its `d` attribute
  containing a `Q` command) with two endpoint `<circle>`s, not the old
  overlapping set.
- **A genuine third node state: neutral.** Before Phase 4, a node was either
  "retrieved" (accent) or "not retrieved" (dimmed) — before any query ran,
  every node defaulted to the dimmed state, so dimming had no baseline to
  demote *from*. `ForestView` now takes a `queried: boolean` prop
  (`RetrievalGraph` passes `turn.started`); neutral reuses the same
  `border-line`/`text-ink` tokens already used for ordinary UI elements
  elsewhere (a doc card, a nav link) rather than introducing a new,
  contrast-unverified token pair. Verified live via computed styles on real
  DOM nodes post-query: the retrieved doc showed `--accent`/`--accent-soft`,
  the three non-retrieved docs showed `--dim-line`/`--dim-ink` — genuinely
  distinct, not just different class names. The neutral (pre-query) branch
  itself is the same ternary, type-checked and lint-clean, but its exact
  visual state wasn't independently screenshotted: it only exists in the
  brief window between sending a message and the first stream event
  arriving, which automated screenshot timing couldn't reliably catch — a
  disclosed gap, not a skipped one, in the same spirit as the Stage 5
  focus-ring verification note above.
- **Layout: one collection per full-width row**, vertical scroll accepted
  (the spec's own stated tradeoff) — replacing the old
  `auto-fill, minmax(190px, 1fr)` grid of clusters. Docs within a collection
  wrap in a `flex flex-wrap` row rather than a fixed 2-column grid, so node
  width follows content instead of a rigid column count.
- **Legend is now three states plus a cross-link explainer**, not a
  two-swatch color key: "Not yet searched" / "Retrieved — matched this
  question" / "Searched, not retrieved", plus a sentence explaining what a
  line means. `copy.panel.forest.crossLink` existed before Phase 4 but was
  never actually rendered anywhere (dead copy) — it's wired in now, reworded
  from the terse "claim → evidence" into a real explanation.
- **Scroll architecture: independent scrollable regions for panel vs.
  thread (wide layout), whole-page scroll (narrow/stacked layout) — both
  pre-existing and deliberately kept, not changed.** The actual "ad hoc per
  view" bug was `RawTraceView`'s own private `max-h-80 overflow-auto` box,
  nested a second scroll region inside whichever ambient one was already
  active — the only one of the four sub-views (RAG Files, RAG Pipeline,
  Sequence, Raw Trace) that did this. Removed; all four now rely solely on
  the ambient scroll container, consistently.
- **Raw Trace**: `whitespace-pre-wrap break-all` replaces the unwrapped
  `<pre>` — `break-all` specifically (not just `break-words`) because a
  chunk id or citation label can be one long token with no natural break
  point. Verified live: a long `Retrieve` event's JSON genuinely wraps
  mid-token (e.g. `"ancho` / `rId"`) rather than clipping or scrolling.
  Per-step latency deltas (`Δ{ms}`) now sit alongside the existing cumulative
  offset (`+{ms}`) on every line — verified live against a real run's actual
  numbers (e.g. `Grade +3132ms (Δ2654ms)`), not just that the code compiles.

## V2 Phase 5 — Conversation & Pipeline Behavior

All five implemented changes below were live-verified with real pipeline
runs (an off-topic question and a plausible-but-unanswerable on-topic one),
not just type-checked. Task 6 required no change — see its own entry.

- **Off-topic/adversarial short-circuit.** `PipelineState` gains
  `topicality: "on-topic" | "off-topic" | "adversarial"`, set by Analyze
  alongside `intent`/`filter`. A new conditional edge right after Analyze
  routes anything not `"on-topic"` straight to a new `Redirect` node —
  Filter, Retrieve, Grade, Route, and Answer never run. Redirect is
  templated from `copy.chat.offTopicRedirect`/`adversarialRedirect` (zero
  fabrication, same discipline as Refuse), distinct wording for the two
  cases since they're different situations, not the same message twice.
  `stepsForTurn` (`rag-turn.ts`) shows a 2-step Sequence (`Analyze` →
  `Redirect`) instead of the misleading full 6-step list with steps 2–5
  stuck "pending" forever. `PipelineView` adds `Redirect` as a third
  always-shown branch alongside Answer/Refuse. **Live-verified**: "What's
  the capital of France?" → only Analyze + Redirect fired (both boxes
  showed `off-topic`), the honest redirect text rendered, and one LLM call
  total instead of two or three.
- **Refusal state coherence (forest ↔ answer text).** Before this, a doc
  Retrieve found stayed in the confident "retrieved" accent state even after
  Grade judged the chunks insufficient and the pipeline refused — the panel
  visually implied relevance the answer text was actively denying. Fixed
  with a genuine 4th node state: `ForestView` takes a new `insufficient:
  boolean` prop (`RetrievalGraph` passes `Boolean(turn.byNode.Refuse)`).
  A retrieved-but-refused doc now renders `border-accent` with **no**
  `bg-accent-soft` fill and `text-muted` — accent-hued so it still reads as
  "this was a candidate," but visually distinct from the filled/confirmed
  state. First attempt used `border-line-strong`, which **live inspection
  caught** as identical to `border-dim-line` in both palettes (`globals.css`
  literally shares one hex between the two tokens) — would have made
  "retrieved but insufficient" indistinguishable from "never retrieved."
  Corrected before committing.
  ⚠️ Also corrected in the same pass: `queried` (the neutral vs.
  retrieved/dimmed gate) changed from `turn.started` to
  `Boolean(turn.byNode.Retrieve)` — the former flipped the forest into the
  dimmed baseline the instant Analyze fired, before Retrieve had actually
  run, which is also now what correctly keeps the forest neutral for an
  off-topic short-circuit (Retrieve never runs, so nothing should read as
  "searched, not found"). **Live-verified** both paths: the off-topic run's
  forest showed all 5 docs neutral; the refusal run showed exactly the 3
  retrieved docs in the new outlined-accent state, 2 untouched docs dimmed.
- **Thread bottom-anchored.** `Thread.tsx`'s wrapper changed from `flex
  flex-col gap-6` to `flex min-h-full flex-col justify-end gap-6` — flexbox
  only overrides alignment when content is shorter than the scroll
  container, never message order, so a short conversation sits near the
  input and a long one still scrolls normally top-to-bottom.
- **Suggested prompts, corpus-derived.** `corpus.config.ts`'s static
  `suggestedPrompts: string[]` field is gone entirely (dead once its
  replacement landed) — a new `getSuggestedPrompts()` in `server-data.ts`
  derives one prompt per collection from that collection's first doc title
  (`What does "{title}" cover?`), capped at 4. Computed server-side in
  `page.tsx`, threaded through `ChatApp` → `Chips` as a prop. Chips now
  render **landing-only** — removed from both active-state layouts, so they
  collapse after the first exchange rather than persisting through an
  ongoing conversation. **Live-verified**: 4 chips derived from the real
  scaffold's actual doc titles, gone immediately after sending a message.
- **"NOT IN THE DOCS" re-weighted.** The refusal tag was
  `border-line`/`text-muted` — barely distinguishable from ordinary UI
  chrome, for a site whose core thesis is honest refusal. Now
  `border-accent bg-accent-soft text-ink` with `font-semibold` (reusing the
  forest's already-AA-verified "retrieved" combination, not a new,
  unverified color) — genuinely more prominent. Live-verified against a
  real refusal.
- **Task 6 (full-pipeline loading indicator): no change made — already
  satisfied.** `Message.tsx`'s `!text && streaming` condition already spans
  the entire pre-Answer phase, not just token-streaming, since no text
  exists until Answer/Refuse/Redirect's first write. Confirmed against two
  independent live runs: "Searching the corpus…" stayed visible through a
  real Grade step that took 2654ms (captured in the Raw Trace as `Grade
  +3132ms (Δ2654ms)`) and through the refusal-path rerun. Modifying working
  code to satisfy an already-met requirement would have been needless
  churn.

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
- **Quota exhaustion shows honest, distinct copy** (pre-ship audit P2: a 429
  and a genuine bug both showed the same generic apology). `src/lib/errors.ts`
  exports `isQuotaExceededError`, checked against the exact shape of a real
  captured 429 (`RateLimitQuotaExhaustedError`, `status: 429`, message
  containing "429"/quota — LangChain's wrapped chat errors and the raw
  `@google/genai` embedding errors have different shapes, so it checks both).
  The route's `onError` returns `copy.chat.quotaExceeded` for a quota error,
  `copy.chat.error` otherwise. The client reads `error?.message` from
  `useChat` — **not** a hardcoded string — since the server's `onError`
  return value arrives there verbatim (`ai`'s runtime wraps it as
  `new Error(chunk.errorText)`). Verified: the classifier against the real
  captured 429 shape (true) and three negative cases (generic error, invalid
  API key error, non-Error value — all false); the client-rendering wiring
  live in-browser via a deliberately invalid `GEMINI_API_KEY` (a 400, not a
  429 — free to test, and confirms no false-positive), which rendered
  exactly `copy.chat.error`'s text end-to-end, proving the same code path a
  real quota error would take.
- **Every focusable element gets an explicit keyboard-focus ring**
  (pre-ship audit E2: no `:focus-visible` styling anywhere; the Send button's
  computed `outlineStyle` was `none`, relying entirely on inconsistent UA
  defaults). One global rule in `globals.css` — `:focus-visible { outline: 2px
  solid var(--accent); outline-offset: 2px; border-radius: var(--radius-sm);
  }` — covers every current and future focusable element site-wide; no
  per-component classes to add or keep in sync. Color choice reuses
  `--accent`, already confirmed ≥4.74:1 against `--canvas`/`--surface` in all
  four palettes (comfortably past the 3:1 WCAG 1.4.11 floor for a non-text UI
  indicator) — no new contrast check needed.
  ⚠️ **Verification gap, disclosed rather than papered over:** confirmed the
  rule is loaded correctly (read it back out of `document.styleSheets` —
  exact selector and declared values match) and re-confirmed the color
  choice's pre-computed AA numbers. Could **not** watch the ring render from
  an actual keypress: `document.hasFocus()` is `false` in the automated
  preview environment (no OS-level window focus), so `:focus`/`:focus-visible`
  never match regardless of technique tried (`.focus()`, a synthetic
  `keydown`) — a hard limitation of that tool, confirmed by direct
  diagnosis, not a flaw in the fix. None of the available preview tools
  dispatch a trusted keyboard event. A real Tab-key pass in an actual
  browser is the remaining check.
- **Sequence step completions are announced to screen readers**
  (pre-ship audit P2: the checkmarks narrated visually with nothing spoken).
  `RagSteps` renders a visually-hidden (`sr-only`) `role="status"
  aria-live="polite"` element announcing only the most recently completed
  step ("Retrieve complete", …) — not the whole six-row list, which would
  re-read all six on every update. It reads `turn` directly rather than the
  currently-toggled sub-view, so switching to Raw Trace doesn't silence it.
  `stepsForTurn` (`src/lib/panel/rag-turn.ts`) is the shared source for "which
  six steps, with Refuse swapped in for Answer when the pipeline declined" —
  extracted so `SequenceView` and this announcer can't disagree about the
  last step. Verified via a mock-turn page (no live call needed): both the
  DOM (`sr-only` computes to a real 1×1px hidden box) and the accessibility
  tree (a genuine `status` node) were inspected directly, at a partial state
  ("Retrieve complete") and a finished one ("Answer complete").
- **The active thread states plainly that it has no cross-turn memory**
  (pre-ship audit P2: a multi-message thread UI implies conversational
  context the pipeline doesn't carry — `questionFrom` in the chat route only
  ever reads the *last* user message; Analyze/Retrieve/Answer never see
  earlier turns). Deliberately **not** fixed by threading history into the
  graph: the build spec's state shape, the CLI, and the eval harness are all
  built around one question → one traced six-node run, and real conversational
  memory would need a query-rewriting step, growing per-turn token cost, and
  a rethink of what the RAG Panel shows per "turn" — a feature addition, not
  a remediation-pass fix. Instead, `copy.activeThread.footnote` ("Questions
  are answered independently — include full context in each one.") renders
  under the composer/chips once active, consistent with the project's
  honest-by-construction stance elsewhere (refusals name what was searched;
  this names what isn't remembered). Verified live in-browser.
- **Client disconnect aborts the pipeline** (pre-ship audit P2: an abandoned
  tab burned every remaining node's Gemini call). `POST /api/chat` passes
  `request.signal` into `graph.stream()`; every Gemini-calling node
  (`analyze`, `retrieve`, `grade`, `answer`) takes an optional
  `config?: RunnableConfig` second parameter and forwards it (or
  `config?.signal`, for `embedText`) into its call. Verified empirically:
  killing the client connection ~5s into a normal ~50–57s run made the
  server-logged request duration `5.0s`, not the full pipeline length — later
  nodes' calls never fired. One important caveat, from `@google/genai`'s own
  docs: abort is client-side only and does **not** cancel billing for a call
  already in flight when the signal fires — the real saving is every
  *subsequent* node's call never starting, not a refund on the current one.
  Also verified empirically: Next's `request.signal` fires with a
  `ResponseAborted` error (named in
  `next/dist/server/web/spec-extension/adapters/next-request.js`), not the
  generic DOM `AbortError` — the route's `onError` checks both names so an
  abandoned tab logs as a clean one-liner instead of a scary stack trace.
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

- **"No Upstash configured" is not truly a no-op for `/api/auth`** — a
  deliberate exception to the "absent → no limiting" rule stated above for
  chat. `checkRateLimit("auth", …)` falls back to an in-memory sliding-window
  limiter (5/min/IP, same threshold as the Upstash-configured case) when
  Upstash isn't set. Reason: bcrypt (cost 12) is real synchronous CPU work,
  so an unauthenticated flood of `/api/auth` POSTs is a local CPU-DoS vector
  regardless of whether the password is ever guessed — "unconfigured" should
  never quietly mean "unprotected" for the one endpoint that hashes on every
  request. This fallback is weaker than Upstash on purpose (in-memory, so
  per-instance and reset on cold start) and isn't a substitute for it on a
  real multi-instance deployment — it exists so an unconfigured deployment
  fails safe rather than wide open. Chat has no equivalent fallback: the
  upstream Gemini API's own quota is the backstop there, and there's no
  cheap local operation to protect.
  ⚠️ **Exactly one Upstash var set (not zero, not both) throws at module load**
  rather than silently falling back — a partial config looks configured but
  would otherwise quietly disable limiting, which is worse than an explicit
  failure. Verified live: 8-request burst against `/api/auth` with no
  Upstash configured → 5× 401 (real bcrypt ran), then 429; setting only
  `UPSTASH_REDIS_REST_URL` → 500 on first request, log shows the throw firing
  at module evaluation, not some unrelated failure.

## Don'ts
- No vector database — build-time ingest → static JSON → in-memory cosine.
- No Python, no second service.
- No GitHub token anywhere (Vercel's GitHub integration handles repo access).
- No real people, employers, or resume-shaped content. All example content is
  unmistakably fictional (Verdant, a smart-terrarium automation platform).
- Never silently public: gate misconfiguration must fail closed.
- Don't trust training data for model names or APIs — verify against live docs.
