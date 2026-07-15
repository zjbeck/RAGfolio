import Link from "next/link";
import { copy } from "@/copy";
import type { CollectionDocSummary } from "@/lib/corpus/server-data";

/**
 * A collection's index page: title + description (frontmatter, same schema
 * as docs) + a thumbnail grid of its sub-pages. No body content of its own —
 * the collection's own `_index.md` is excluded from ingest/retrieval
 * entirely (see ingest.ts's COLLECTION_INDEX_FILE handling).
 */
export function CollectionView({
  title,
  description,
  docs,
  collectionSlug,
}: {
  title: string;
  description: string;
  docs: CollectionDocSummary[];
  collectionSlug: string;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        {copy.docs.backHome}
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {docs.map((doc) => (
          <Link
            key={doc.docSlug}
            href={`/docs/${collectionSlug}/${doc.docSlug}`}
            className="rounded-[var(--radius)] border border-line bg-surface-2 p-4 transition-colors hover:border-accent"
          >
            <div className="font-medium text-ink">{doc.title}</div>
            <p className="mt-1 text-sm text-muted">{doc.description}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
