# RAGfolio

A template for a password-gateable portfolio or docs chatbot that answers
**only** from its own corpus, cites every claim, and shows its retrieval work
in a live side panel. Next.js (App Router) + TypeScript, LangGraph.js, and
Gemini — **no vector database**.

Content is embedded once at build time into a single static JSON file; at
runtime, retrieval is in-memory cosine similarity over that file. The corpus is
small and fixed per deploy — exactly the shape of a portfolio or a docs set — so
there is no vector database to run, scale, or pay for.

This repository never deploys itself. You click **Use this template**, generate
your own repo, replace the example content with yours, set a few environment
variables, and deploy that on Vercel.

## What you get

- **Grounded answers with citations.** A six-node LangGraph pipeline
  (Analyze → Filter → Retrieve → Grade → Route → Answer/Refuse) that refuses
  honestly when the corpus has no answer, naming what it searched — zero
  fabrication by construction.
- **A live RAG panel.** The same stream that renders the answer drives a panel
  showing the corpus as a forest of documents, the pipeline as a row of nodes
  with per-step results, and a plain-language step-by-step with a raw-trace
  toggle.
- **Content pages** with a rendered/raw toggle and a chunk-boundary overlay, so
  every citation deep-links to the exact section it came from.
- **An optional password gate** (fails closed, never silently public) and
  **optional rate limiting** — both dormant until you configure them.
- **Theming** — vanilla light/dark out of the box, an optional custom palette,
  and graceful degradation when you don't add one.

Everything a visitor reads — greeting, panel narration, refusals, the gate —
lives in one [`src/copy.ts`](./src/copy.ts) module. Everything about your
collections and facets is derived from your content and
[`corpus.config.ts`](./corpus.config.ts); nothing is hardcoded in components.

## Quickstart (run the example locally)

Requires Node 20+ and a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local
# then fill in GEMINI_CHAT_API_KEY and GEMINI_EMBEDDING_API_KEY in .env.local
npm run ingest     # embed the example corpus → src/generated/corpus.json
npm run dev        # http://localhost:3000
```

Chat provider defaults to Gemini (`LLM_PROVIDER=gemini`, pre-set in
`.env.example`); see [environment.md](./docs/environment.md) to switch to Groq.

Prefer the terminal? `npm run ask -- "What webhook events does Verdant send?"`
runs the whole pipeline and prints the node events and the cited answer.

## Make it yours

1. **Generate your repo** with *Use this template*, then clone it.
2. **Replace the corpus:** delete `content/**`, add your own markdown, and edit
   [`corpus.config.ts`](./corpus.config.ts) (site name, greeting, collections,
   facet vocabulary, suggested prompts).
3. **Rewrite the microcopy** in [`src/copy.ts`](./src/copy.ts) and the
   `/how-it-works` page.
4. **Set environment variables** and **deploy on Vercel** — its GitHub
   integration handles repo access; no tokens live in this project.

Full walkthrough: **[docs/using-this-template.md](./docs/using-this-template.md)**.

## Documentation

| Guide | What's in it |
| --- | --- |
| [Using this template](./docs/using-this-template.md) | Generate a repo, add content, connect Vercel |
| [Architecture](./docs/architecture.md) | The pipeline, the ingest artifact, how the stream drives the panel |
| [Environment variables](./docs/environment.md) | Every variable, what it enables, and what happens when it's absent |
| [Theming](./docs/theming.md) | Tokens, adding a custom palette, graceful degradation |
| [Evals](./docs/evals.md) | Writing cases, running locally and on LangSmith, A/B on thinking budget |
| [Updating your copy](./docs/updating.md) | The template is a snapshot — how to pull in later improvements |

Project conventions and the running log of design decisions live in
[CLAUDE.md](./CLAUDE.md). The `/how-it-works` page is example
self-documentation of the pipeline that you replace with your own.

## Example corpus

The template ships with **Verdant**, a fictional smart-terrarium automation
platform (~16 docs across Guides, API Reference, Concepts, Troubleshooting, and
Release Notes). It exists to demo the tool — filtering, cross-links, refusals —
and is entirely made up. Replace it.

## License

[MIT](./LICENSE). Package manager: **npm**.
