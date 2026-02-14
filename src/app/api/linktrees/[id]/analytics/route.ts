import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getLinktreeAnalytics, getLinktreeById, invalidateLinktreeCacheById } from "@/lib/db/queries";

export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid linktree ID format" }, { status: 400 });
    }

    const lt = await getLinktreeById(id);
    if (!lt) return NextResponse.json({ error: "Linktree not found" }, { status: 404 });

    const analytics = await getLinktreeAnalytics(id);
    return NextResponse.json({ data: analytics }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (e) {
    console.error("Error fetching analytics:", e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
