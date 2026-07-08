# Evals

The eval harness runs a question set through the graph and asserts what came
back: the right documents were retrieved, filters were extracted, and
out-of-scope questions were refused. It runs locally, traces to LangSmith when
configured, and can A/B the Answer node's thinking budget.

## Running

```bash
npm run eval                      # default thinking budget from corpus.config.ts
npm run eval -- --dry-run         # list the cases without any chat calls
npm run eval -- --budget 0,256    # A/B two Answer thinking budgets
npm run eval -- --evals path.json # a different eval set
npm run eval -- --delay 15        # seconds between cases (pace rate limits)
```

The harness exits non-zero if any case fails, so it drops into CI. Start with
`--dry-run` to confirm your set parses.

> **Free-tier reality:** each case is 2–3 chat calls, and `gemini-3.5-flash`
> free-tier allows ~5/min and ~20/day. The full example set (11 cases) exceeds
> the daily free quota. Pace with `--delay`, run subsets during development, or
> use a paid tier for the whole suite.

## Writing cases

Cases live in [`evals/verdant.evals.json`](../evals/verdant.evals.json). Each
has an `id`, a `question`, and an `expect` block. Three kinds:

```jsonc
{
  "cases": [
    // Retrieval: the named doc(s) must appear among retrieved chunks.
    { "id": "guide-misting", "question": "How do I switch to adaptive misting?",
      "expect": { "retrieve": ["guides/automated-misting"] } },

    // Filter: Analyze must extract this facet (partial match), and retrieve.
    { "id": "filter-watering", "question": "In the watering API, how do I trigger a run?",
      "expect": { "filter": { "module": "watering" }, "retrieve": ["api-reference/watering-api"] } },

    // Refuse: the pipeline must route to Refuse.
    { "id": "refuse-offtopic", "question": "What's the best sourdough recipe?",
      "expect": { "refuse": true } }
  ]
}
```

Doc ids are `collection/docSlug`. Ship a mix: per-collection retrieval hits,
filter-specific queries, and out-of-scope questions that must refuse — the
must-refuse cases are how you prove the site won't fabricate.

## A/B on thinking budget

The Answer node's thinking budget is a config value (default 0 — thinking off).
`--budget 0,256` runs the whole set at each budget and reports pass counts and
total answer tokens per budget, so you can see whether a modest thinking budget
changes outcomes and what it costs. Analyze and Grade always run with thinking
off; the A/B only moves the Answer node.

## LangSmith

When `LANGSMITH_API_KEY` (and `LANGSMITH_TRACING=true`) are set, every run is
traced and tagged (`ragfolio-eval`, `budget:<n>`) so the cases group into an
experiment in [LangSmith](https://smith.langchain.com/). Absent, the harness
runs fully locally and prints its results to the terminal.
