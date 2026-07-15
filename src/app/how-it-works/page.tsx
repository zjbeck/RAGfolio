import { TopNav } from "@/components/nav/TopNav";
import { Markdown } from "@/components/Markdown";
import { copy } from "@/copy";
import { getNavTabs } from "@/lib/corpus/server-data";
import { REPO_URL } from "@/lib/site";

/**
 * [PLACEHOLDER] Example self-documentation of the pipeline. Consumers replace
 * this page's copy with their own; it ships to show what a "how it works" page
 * looks like and to link back to the template.
 */
const body = `
## What this site is

${copy.siteName} is a documentation chatbot that answers **only** from its own
corpus and shows its work while it does. Ask a question and the panel on the
left traces the retrieval pipeline live; the answer on the right cites the
exact sections it drew from.

## How an answer is built

Every question runs through a six-step graph:

1. **Analyze** — classify the question and, when it clearly targets one, pick a
   metadata filter (for example, a single module or document type).
2. **Filter** — narrow the corpus to the sections whose metadata matches.
3. **Retrieve** — rank those sections by meaning and keep the closest few.
4. **Grade** — a separate check: do the kept sections actually answer the
   question, or are they merely on-topic?
5. **Route** — answer from what was found, or say it isn't in the docs.
6. **Answer / Refuse** — write a cited reply, or refuse honestly and name what
   was searched.

## No vector database

Content is embedded once at build time into a single static JSON file. At
runtime, retrieval is in-memory cosine similarity over that file — there is no
vector database to run or pay for. The trade-off is deliberate: the corpus is
small and fixed per deploy, which is exactly the shape of a portfolio or a docs
set.

## Reading the panel

- **Retrieval Graph** shows either the corpus as a forest of documents (with
  the retrieved ones highlighted and cross-links drawn between them) or the
  pipeline as a row of nodes with the terse result of each.
- **RAG Steps** narrates the same run in plain language, or drops to the raw
  event trace behind it.

## Honest by construction

When the corpus doesn't contain an answer, the site refuses and tells you what
it checked — it never invents one. Every non-refusal answer ends with citations
that deep-link to the exact section, which you can read in full (rendered or as
raw source with its chunk boundaries).
` +
  (REPO_URL
    ? `\n---\n\nThis site was built from the open-source **RAGfolio** template. Read the code,\nincluding this page, at [${REPO_URL}](${REPO_URL}).\n`
    : "");

export default function HowItWorks() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav tabs={getNavTabs()} />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 rounded-[var(--radius)] border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
          [PLACEHOLDER] Example self-documentation — replace this page with your
          own explanation when you adopt the template.
        </div>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          {copy.nav.howItWorks}
        </h1>
        <Markdown>{body}</Markdown>
      </main>
    </div>
  );
}
