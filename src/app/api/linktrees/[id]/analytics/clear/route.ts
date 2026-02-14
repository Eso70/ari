import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/get-session";
import { query } from "@/lib/db";
import { getLinktreeById } from "@/lib/db/queries";
import { redisDel } from "@/lib/redis-cache";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid linktree ID format" }, { status: 400 });
    }

    const lt = await getLinktreeById(id);
    if (!lt) return NextResponse.json({ error: "Linktree not found" }, { status: 404 });

    await query("DELETE FROM page_views WHERE linktree_id = $1", [id]);
    await query("DELETE FROM link_clicks WHERE linktree_id = $1", [id]);
    await query("SELECT recalculate_all_linktree_counts($1)", [id]);

    await Promise.all([
      redisDel("lt:analytics:" + id),
      redisDel("lt:analytics:totals"),
      redisDel("lt:list:all:analytics"),
    ]);

    revalidatePath(`/api/linktrees/${id}/analytics`);
    revalidatePath(`/api/linktrees/${id}`);
    revalidatePath("/api/linktrees");

    return NextResponse.json(
      { message: "Analytics data cleared successfully", success: true },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } }
    );
  } catch (e) {
    console.error("Error clearing analytics:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
