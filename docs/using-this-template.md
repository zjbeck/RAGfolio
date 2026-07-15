# Using this template

RAGfolio is a template, not a hosted service. You generate your own repository
from it, replace the example content with yours, and deploy that. This guide is
the end-to-end path.

## 1. Generate your repository

On the GitHub repository page, click **Use this template → Create a new
repository**. Make it private if your content is private — the password gate
protects the deployed site, but the source is only as private as the repo.

Clone it and install:

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
npm install
```

## 2. Add your content

Content lives in `content/<collection>/<doc>.md`. Collections are just
directories; there is no registry to update beyond the config file.

1. Delete the example corpus: `rm -r content/*`.
2. Add your own markdown, grouped into collection directories.
3. Give every doc frontmatter:

   ```yaml
   ---
   title: Getting started
   description: One sentence used in the forest tooltip and search context.
   doc_type: guide          # must be a value you declare in corpus.config.ts
   module: onboarding       # any facet keys you declare; optional per doc
   cross_links:             # optional claim→evidence links, drawn in the forest
     - to: concepts/architecture
       label: how it fits together
   ---
   ```

4. Edit [`corpus.config.ts`](../corpus.config.ts): `siteName`, `greeting`, the
   `collections` list (slug + display label, in nav order), the `facets`
   vocabulary, `suggestedPrompts`, and retrieval knobs (`k`,
   `answerThinkingBudget`, `wholeDocChunkThreshold`, `minViewportWidth`).

`corpus.config.ts` is the single source of truth for collections and facets —
ingest validates your frontmatter against it and fails with the file and the
fix if they disagree.

## 3. Rewrite the words

- **Microcopy:** every visitor-facing string lives in
  [`src/copy.ts`](../src/copy.ts) — greeting, panel narration, refusal text,
  the gate page, footnotes. Rewrite it there; components never hold literal
  copy.
- **How this site works:** `src/app/how-it-works/page.tsx` ships as example
  self-documentation. Replace it with your own explanation (or delete it and
  the nav link in `src/copy.ts`).
- **Repo link:** point `REPO_URL` in [`src/lib/site.ts`](../src/lib/site.ts) at
  your repository.

## 4. Set environment variables

Copy `.env.example` to `.env.local` and fill in at least `GEMINI_EMBEDDING_API_KEY`
(embeddings) and `GEMINI_CHAT_API_KEY` (chat, since `LLM_PROVIDER=gemini` is the
documented default — switch to `groq` + `GROQ_API_KEY` if you'd rather). The
full reference — including the optional gate, rate limiting, and tracing — is in
[environment.md](./environment.md).

Verify locally:

```bash
npm run ingest       # embeds your corpus; needs GEMINI_EMBEDDING_API_KEY
npm run dev
```

## 5. Deploy on Vercel

1. Push your repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo. Vercel's GitHub
   integration handles access — this project stores **no** GitHub token.
3. Add your environment variables in the Vercel project settings.
   `GEMINI_EMBEDDING_API_KEY` is needed at **build** time too: `npm run build`
   runs ingest, which embeds your corpus during the build.
4. Deploy.

For a public deployment, set up the password gate and Upstash rate limiting
before you share the URL — an ungated, unlimited chat endpoint spends your LLM
quota for anyone who finds it. See [environment.md](./environment.md).

## Keeping up with the template

Your repo is a snapshot of the template at generation time. When RAGfolio
improves, [updating.md](./updating.md) explains how to pull changes in.
