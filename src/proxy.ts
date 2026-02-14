import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { redisGet, redisSet } from "@/lib/redis-cache";

function createLoginRedirect(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("admin_session", "", { expires: new Date(0), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  return response;
}

async function validateSession(sessionToken: string): Promise<boolean> {
  const cached = await redisGet("session:valid:" + sessionToken);
  if (cached === "1") return true;
  if (cached === "0") return false;
  try {
    const { rows } = await query<{ is_session_valid: boolean }>("SELECT is_session_valid($1) AS is_session_valid", [sessionToken]);
    const v = rows?.[0]?.is_session_valid === true;
    await redisSet("session:valid:" + sessionToken, v ? "1" : "0", 30);
    return v;
  } catch {
    return false;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/api/")) {
    const sessionToken = request.cookies.get("admin_session")?.value;
    if (!sessionToken) return createLoginRedirect(request);
    const isValid = await validateSession(sessionToken);
    if (!isValid) return createLoginRedirect(request);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|images|uploads|fonts).*)"] };
