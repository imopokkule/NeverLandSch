import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: schedUsers }, { data: monthData }, { data: appUsers }] = await Promise.all([
    supabase.from("schedules").select("discord_id, user_name").not("user_name", "is", null),
    supabase.from("schedules").select("discord_id, data").eq("month", month),
    supabase.from("app_users").select("discord_id, user_name"),
  ]);

  const appNameMap = new Map<string, string>(
    (appUsers ?? [])
      .filter((u) => u.user_name)
      .map((u) => [u.discord_id, u.user_name as string])
  );

  const isDiscordId = (name: string) => /^\d{15,20}$/.test(name);

  const users = (schedUsers ?? []).map((u) => ({
    discord_id: u.discord_id,
    user_name:
      !u.user_name || isDiscordId(u.user_name)
        ? (appNameMap.get(u.discord_id) ?? u.user_name)
        : u.user_name,
  }));

  return NextResponse.json({
    users,
    monthData: monthData ?? [],
  });
}
