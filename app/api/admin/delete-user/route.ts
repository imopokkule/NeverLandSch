import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// DELETE /api/admin/delete-user?discord_id=xxx
export async function DELETE(req: NextRequest) {
  const discord_id = req.nextUrl.searchParams.get("discord_id");
  if (!discord_id) return NextResponse.json({ error: "discord_id required" }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ error: e1, count: c1 }, { error: e2, count: c2 }] = await Promise.all([
    supabase.from("schedules").delete({ count: "exact" }).eq("discord_id", discord_id),
    supabase.from("app_users").delete({ count: "exact" }).eq("discord_id", discord_id),
  ]);

  if (e1 || e2) {
    return NextResponse.json({ error: e1?.message ?? e2?.message }, { status: 500 });
  }

  return NextResponse.json({ discord_id, deletedSchedules: c1, deletedAppUsers: c2 });
}
