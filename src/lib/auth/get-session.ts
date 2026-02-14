import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { redisGet, redisSet } from "@/lib/redis-cache";

const SESSION_CACHE_TTL = 30;

export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;

  if (!sessionToken) return null;

  const cached = await redisGet("session:admin:" + sessionToken);
  if (cached) {
    try {
      return JSON.parse(cached) as { user: { id: string; username: string; name: string } };
    } catch {
      /* stale */
    }
  }

  const { rows } = await query<{ admin_id: string; username: string; name: string }>("SELECT * FROM get_admin_by_session($1)", [sessionToken]);
  const admin = rows?.[0];
  if (!admin?.admin_id) return null;

  const session = { user: { id: admin.admin_id, username: admin.username, name: admin.name } };
  await redisSet("session:admin:" + sessionToken, session, SESSION_CACHE_TTL);
  return session;
}
