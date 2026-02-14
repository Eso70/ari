import { NextRequest, NextResponse } from "next/server";
import { getLinkById } from "@/lib/db/queries";
import { extractAnalyticsData } from "@/lib/utils/analytics";
import { addClick } from "@/lib/utils/batch-queue";

// POST /api/public/links/[id]/click - Track unique link click
// Batched inserts reduce database load significantly
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID - skip if null/empty to reduce API calls
    if (!id || !id.trim()) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Validate UUID format (fail silently for analytics - don't break user experience)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id.trim())) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Try to get linktree_id from request body to avoid extra DB query
    let linktreeId: string | null = null;
    try {
      const body = await request.json().catch(() => ({}));
      linktreeId = (body as { linktree_id?: string })?.linktree_id || null;
    } catch {
      // If body parsing fails, continue without linktree_id
    }
    
    // Only query database if linktree_id not provided
    if (linktreeId && linktreeId.trim()) {
      // Use provided linktree_id - no DB query needed
      extractAnalyticsData(request)
        .then((analyticsData) => {
          // Validate analytics data before adding
          if (analyticsData.ip_address && analyticsData.ip_address.trim()) {
            addClick({
              link_id: id.trim(),
              linktree_id: linktreeId!.trim(),
              ip_address: analyticsData.ip_address.trim(),
              session_id: analyticsData.session_id?.trim() || null,
              clicked_at: new Date().toISOString(),
            }).catch(() => {
              // Silently fail
            });
          }
        })
        .catch(() => {
          // Silently fail
        });
    } else {
      Promise.all([getLinkById(id.trim()), extractAnalyticsData(request)])
        .then(async ([link, analyticsData]) => {
          if (!link?.linktree_id?.trim() || !analyticsData.ip_address?.trim()) return;
          addClick({
            link_id: id.trim(),
            linktree_id: link.linktree_id.trim(),
            ip_address: analyticsData.ip_address.trim(),
            session_id: analyticsData.session_id?.trim() || null,
            clicked_at: new Date().toISOString(),
          }).catch(() => {});
        })
        .catch(() => {});
    }

    // Return immediately - batch insert happens in background
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    // Always return success - analytics failures shouldn't break the page
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

