# RAGfolio

A template for a password-gateable portfolio/docs chatbot with a live
RAG-traversal panel. Next.js (App Router) + TypeScript, LangGraph.js, and
Gemini — no vector database. Content is ingested at build time into a static
JSON artifact; retrieval is in-memory cosine similarity at runtime.

This repository never deploys itself. Consumers click **Use this template**,
generate a private repo, add their own markdown content and env vars, and
deploy that on Vercel.

> **Status: under construction.** This README grows into the full front door
> as the template lands. Project conventions and running decisions live in
> [CLAUDE.md](./CLAUDE.md).

Package manager: **npm**.

## License

[MIT](./LICENSE)
