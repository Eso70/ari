import { getLinktreeWithLinksByUid } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";

// Dynamically import LinktreePage to reduce initial bundle size
// Use ssr: true to enable server-side rendering for better SEO and initial load
const LinktreePage = dynamicImport(() => import("@/components/public/LinktreePage").then(mod => ({ default: mod.LinktreePage })), {
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  ),
  ssr: true,
});

// No caching - always fetch fresh data for accuracy
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Get default Ari Sponsar linktree (matches admin username)
  const linktreeUid = "ari";

  const result = await getLinktreeWithLinksByUid(linktreeUid);
  const { linktree, links, schemaMissing } = result;

  if (schemaMissing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-white">
        <h1 className="mb-4 text-xl font-bold">Database setup required</h1>
        <p className="mb-6 max-w-md text-center text-white/90">
          Run the schema to create tables. Using PostgreSQL, execute:
        </p>
        <pre className="mb-6 rounded bg-black/30 p-4 text-left text-sm">
          psql -U postgres -d ari -f src/schemas/complete_schema.sql
        </pre>
        <p className="text-sm text-white/70">
          Or run the file in your DB client (e.g. pgAdmin). Then refresh.
        </p>
      </div>
    );
  }

  if (!linktree) {
    notFound();
  }

  // View tracking is handled client-side via API route (unique views only)
  return <LinktreePage linktree={linktree} links={links} />;
}

export async function generateMetadata() {
  const { linktree, schemaMissing } = await getLinktreeWithLinksByUid("ari");

  if (schemaMissing || !linktree) {
    return {
      title: "Ari Sponsar",
      description: "بۆ پەیوەندی کردن, کلیک لەم لینکانەی خوارەوە بکە",
    };
  }

  return {
    title: linktree.name,
    description: linktree.subtitle || "بۆ پەیوەندی کردن, کلیک لەم لینکانەی خوارەوە بکە",
    openGraph: {
      title: linktree.name,
      description: linktree.subtitle || "بۆ پەیوەندی کردن, کلیک لەم لینکانەی خوارەوە بکە",
      images: linktree.image ? [linktree.image] : [],
    },
  };
}
