import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/get-session";
import { query } from "@/lib/db";
import { getAllLinktrees } from "@/lib/db/queries";
import { redisDel, redisDelPattern } from "@/lib/redis-cache";

export async function DELETE(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rows: pv } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM page_views");
    const { rows: lc } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM link_clicks");
    const pageViewsDeleted = parseInt(pv?.[0]?.count ?? "0", 10);
    const linkClicksDeleted = parseInt(lc?.[0]?.count ?? "0", 10);

    await query("DELETE FROM page_views");
    await query("DELETE FROM link_clicks");
    await query("UPDATE links SET click_count = 0");

    await Promise.all([
      redisDelPattern("lt:analytics:*"),
      redisDel("lt:analytics:totals"),
      redisDel("lt:list:all:analytics"),
    ]);

    revalidatePath("/api/linktrees");
    revalidatePath("/api/analytics/totals");
    revalidatePath("/api/analytics/batch");
    const all = await getAllLinktrees();
    for (const lt of all) {
      revalidatePath(`/api/linktrees/${lt.id}/analytics`);
      revalidatePath(`/api/linktrees/${lt.id}`);
    }

    return NextResponse.json(
      { message: "All analytics data cleared successfully", success: true, deleted: { page_views: pageViewsDeleted, link_clicks: linkClicksDeleted } },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } }
    );
  } catch (e) {
    console.error("Error clearing analytics:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
