import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const v = loginSchema.safeParse(body);
    if (!v.success) {
      return NextResponse.json({ error: "ناوی بەکارهێنەر یان تێپەڕەوشە هەڵەیە" }, { status: 400 });
    }
    const { username, password, rememberMe } = v.data;

    const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
    const clientIp = rawIp && rawIp !== "unknown" ? rawIp : null;
    const sessionToken = crypto.randomUUID();
    const sessionDuration = rememberMe ? 365 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
    const sessionExpiresAt = new Date(Date.now() + sessionDuration);
    const userAgent = request.headers.get("user-agent") || null;

    const { rows } = await query<{ success: boolean; admin_id: string; username: string; name: string }>(
      "SELECT * FROM authenticate_and_create_session($1, $2, $3, $4, $5::inet, $6)",
      [username, password, sessionToken, sessionExpiresAt.toISOString(), clientIp, userAgent]
    );
    const r = rows?.[0];
    if (!r?.success) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth/login] Login failed for username:", username, "(check admins table and password)");
      }
      return NextResponse.json({ error: "ناوی بەکارهێنەر یان تێپەڕەوشە هەڵەیە" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: rememberMe ? 365 * 24 * 60 * 60 : 30 * 60,
      path: "/",
    });

    return NextResponse.json(
      { message: "Login successful", user: { id: r.admin_id, username: r.username, name: r.name } },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" },
      }
    );
  } catch {
    return NextResponse.json({ error: "هەڵەیەکی نادیار ڕوویدا" }, { status: 500 });
  }
}
