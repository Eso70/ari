import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateLink, deleteLink, getLinkById, invalidateLinktreeCacheById, invalidateLinkCache } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/get-session";

const CH = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid link ID format" }, { status: 400 });
    }

    const body = await request.json();
    const link = await updateLink(id, body);
    if (link?.linktree_id) {
      await invalidateLinktreeCacheById(link.linktree_id);
      await invalidateLinkCache(id);
      revalidatePath(`/api/linktrees/${link.linktree_id}/links`);
      revalidatePath(`/api/linktrees/${link.linktree_id}`);
      revalidatePath("/api/linktrees");
    }
    return NextResponse.json({ data: link }, { headers: CH });
  } catch (e) {
    console.error("Error updating link:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update link" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid link ID format" }, { status: 400 });
    }

    const linkData = await getLinkById(id);
    await deleteLink(id);
    if (linkData?.linktree_id) {
      await invalidateLinktreeCacheById(linkData.linktree_id);
      await invalidateLinkCache(id);
      revalidatePath(`/api/linktrees/${linkData.linktree_id}/links`);
      revalidatePath(`/api/linktrees/${linkData.linktree_id}`);
      revalidatePath("/api/linktrees");
    }
    return NextResponse.json({ message: "Link deleted successfully" }, { headers: CH });
  } catch (e) {
    console.error("Error deleting link:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete link" }, { status: 500 });
  }
}
