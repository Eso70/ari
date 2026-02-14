import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { query } from "@/lib/db";
import { redisGet, redisSet } from "@/lib/redis-cache";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cached = await redisGet("lt:analytics:totals");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return NextResponse.json(
          { data },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } }
        );
      } catch { /* fall through */ }
    }

    const { rows } = await query<{ total_views: string; unique_views: string; total_clicks: string; unique_clicks: string }>("SELECT * FROM get_total_analytics_optimized()");
    const r = rows?.[0];
    const data = {
      total_views: r ? parseInt(String(r.total_views || "0"), 10) : 0,
      unique_views: r ? parseInt(String(r.unique_views || "0"), 10) : 0,
      total_clicks: r ? parseInt(String(r.total_clicks || "0"), 10) : 0,
      unique_clicks: r ? parseInt(String(r.unique_clicks || "0"), 10) : 0,
    };

    await redisSet("lt:analytics:totals", data, 120);

    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } }
    );
  } catch (e) {
    console.error("Error fetching totals:", e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
