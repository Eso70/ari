import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { query } from "@/lib/db";
import { z } from "zod";

const updateUsernameSchema = z.object({
  username: z.string().min(3).max(50),
  currentPassword: z.string().min(1),
});

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

const CH = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" };

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    const { rows: pv } = await query<{ verify_admin_password: boolean }>("SELECT verify_admin_password($1, $2) AS verify_admin_password", [session.user.username, body.currentPassword]);
    if (!pv?.[0]?.verify_admin_password) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

    if (body.username) {
      const u = updateUsernameSchema.safeParse({ username: body.username, currentPassword: body.currentPassword });
      if (!u.success) return NextResponse.json({ error: "Validation failed", details: u.error.issues }, { status: 400 });
      const { rows: ex } = await query<{ id: string }>("SELECT id FROM admins WHERE username = $1 AND id != $2", [body.username, session.user.id]);
      if (ex?.length) return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      await query("UPDATE admins SET username = $1 WHERE id = $2", [body.username, session.user.id]);
      return NextResponse.json({ message: "Username updated successfully", user: { id: session.user.id, username: body.username, name: session.user.name } }, { headers: CH });
    }

    if (body.newPassword) {
      const p = updatePasswordSchema.safeParse({ currentPassword: body.currentPassword, newPassword: body.newPassword, confirmPassword: body.confirmPassword });
      if (!p.success) return NextResponse.json({ error: "Validation failed", details: p.error.issues }, { status: 400 });
      await query("SELECT update_admin_password($1, $2)", [session.user.id, body.newPassword]);
      return NextResponse.json({ message: "Password updated successfully" }, { headers: CH });
    }

    return NextResponse.json({ error: "No update specified" }, { status: 400 });
  } catch (e) {
    console.error("Profile update error:", e);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
