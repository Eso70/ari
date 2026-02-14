import { NextRequest, NextResponse } from "next/server";
import {
  getLinktreeWithLinksByUid,
} from "@/lib/db/queries";

export const revalidate = 0;

// GET /api/public/linktrees/[uid] - Get linktree by UID (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    
    // Optimized: Fetch linktree and links in a single database query
    const { linktree, links } = await getLinktreeWithLinksByUid(uid);

    if (!linktree) {
      return NextResponse.json(
        { error: "Linktree not found" },
        { status: 404 }
      );
    }

    // View tracking is handled via dedicated view tracking API route (unique views only)

    return NextResponse.json(
      {
        data: {
          ...linktree,
          links,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error("Error fetching linktree:", error);
    return NextResponse.json(
      { error: "Failed to fetch linktree" },
      { status: 500 }
    );
  }
}

