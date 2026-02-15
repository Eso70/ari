import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { flushAllQueues } from "@/lib/utils/batch-queue";

// POST /api/analytics/flush - Flush server-side queues (Redis → DB), then fresh data is available
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await flushAllQueues();

    return NextResponse.json(
      { success: true, message: "Queues flushed successfully" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Analytics flush error:", error);
    return NextResponse.json(
      { error: "Failed to flush queues", message },
      { status: 500 }
    );
  }
}
