import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin_session")?.value;
    if (sessionToken) {
      await query("SELECT logout_admin($1)", [sessionToken]);
    }

    const res = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } }
    );
    res.cookies.set("admin_session", "", { expires: new Date(0), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    res.cookies.delete("admin_session");
    return res;
  } catch {
    const res = NextResponse.json({ error: "هەڵەیەکی نادیار ڕوویدا" }, { status: 500 });
    res.cookies.set("admin_session", "", { expires: new Date(0), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    res.cookies.delete("admin_session");
    return res;
  }
}
