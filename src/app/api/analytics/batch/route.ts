import { NextRequest, NextResponse } from "next/server";
import { extractAnalyticsData } from "@/lib/utils/analytics";
import { getLinktreeIdsByUids } from "@/lib/db/queries";
import { addView, addClick } from "@/lib/utils/batch-queue";

// POST /api/analytics/batch - Queue views and clicks; no direct DB writes here.
// Single bulk UID lookup (no N+1), then push all events to Redis. Background flush writes to DB in batch.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { views = [], clicks = [] } = body as {
      views?: Array<{ uid: string }>;
      clicks?: Array<{ linkId: string; linktreeId: string }>;
    };

    const analyticsData = await extractAnalyticsData(request);
    const hasValidIp = analyticsData.ip_address && analyticsData.ip_address.trim();

    const [viewsResult, clicksResult] = await Promise.all([
      // Views: one bulk UID→linktree_id query, then queue all to Redis (batch flush writes to DB)
      (async () => {
        if (!Array.isArray(views) || views.length === 0 || !hasValidIp) {
          return { count: 0 };
        }
        const uids = views.map((v) => v.uid?.trim()).filter(Boolean) as string[];
        if (uids.length === 0) return { count: 0 };
        const uidToId = await getLinktreeIdsByUids(uids);
        const ip = analyticsData.ip_address.trim();
        const sessionId = analyticsData.session_id?.trim() || null;
        const viewedAt = new Date().toISOString();
        const viewPromises: Promise<void>[] = [];
        for (const view of views) {
          const uid = view.uid?.trim();
          if (!uid) continue;
          const linktreeId = uidToId.get(uid);
          if (linktreeId) {
            viewPromises.push(addView({ linktree_id: linktreeId, ip_address: ip, session_id: sessionId, viewed_at: viewedAt }));
          }
        }
        await Promise.all(viewPromises);
        return { count: viewPromises.length };
      })(),

      // Clicks: no DB lookup (client sends linktreeId); queue all to Redis
      (async () => {
        if (!Array.isArray(clicks) || clicks.length === 0 || !hasValidIp) {
          return { count: 0 };
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const ip = analyticsData.ip_address.trim();
        const sessionId = analyticsData.session_id?.trim() || null;
        const clickedAt = new Date().toISOString();
        const clickPromises: Promise<void>[] = [];
        for (const click of clicks) {
          const linkId = click.linkId?.trim();
          const linktreeId = click.linktreeId?.trim();
          if (!linkId || !linktreeId || !uuidRegex.test(linkId) || !uuidRegex.test(linktreeId)) continue;
          clickPromises.push(addClick({
            link_id: linkId,
            linktree_id: linktreeId,
            ip_address: ip,
            session_id: sessionId,
            clicked_at: clickedAt,
          }));
        }
        await Promise.all(clickPromises);
        return { count: clickPromises.length };
      })(),
    ]);

    return NextResponse.json({ 
      success: true,
      processed: {
        views: viewsResult.count,
        clicks: clicksResult.count,
      }
    }, { status: 200 });
  } catch (error) {
    // Always return success - analytics failures shouldn't break the page
    console.error("Batch analytics error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
