import { notFound } from "next/navigation";
import { CollectionView } from "@/components/docs/CollectionView";
import { TopNav } from "@/components/nav/TopNav";
import {
  getCollectionDocs,
  getCollectionMeta,
  getCollectionParams,
  getNavTabs,
} from "@/lib/corpus/server-data";

/** Statically generate every collection's index page at build time. */
export function generateStaticParams() {
  return getCollectionParams();
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  const meta = getCollectionMeta(collection);
  if (!meta) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav tabs={getNavTabs()} />
      <CollectionView
        title={meta.title}
        description={meta.description}
        docs={getCollectionDocs(collection)}
        collectionSlug={collection}
      />
    </div>
  );
}
