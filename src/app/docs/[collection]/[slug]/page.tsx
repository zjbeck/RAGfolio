import { notFound } from "next/navigation";
import { DocView } from "@/components/docs/DocView";
import { TopNav } from "@/components/nav/TopNav";
import {
  getCollectionLabel,
  getDocChunks,
  getDocMeta,
  getDocParams,
  getDocSource,
  getNavTabs,
} from "@/lib/corpus/server-data";

/** Statically generate every doc page at build time from the corpus. */
export function generateStaticParams() {
  return getDocParams();
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ collection: string; slug: string }>;
}) {
  const { collection, slug } = await params;
  const meta = getDocMeta(collection, slug);
  if (!meta) notFound();

  const { frontmatterText, body } = getDocSource(collection, slug);
  const chunks = getDocChunks(collection, slug);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav tabs={getNavTabs()} />
      <DocView
        title={meta.title}
        description={meta.description}
        collectionLabel={getCollectionLabel(collection)}
        frontmatterText={frontmatterText}
        body={body}
        chunks={chunks}
      />
    </div>
  );
}
