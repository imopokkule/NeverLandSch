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
    supabase.from("schedules").select("discord_id, user_name").not("discord_id", "is", null),
    supabase.from("schedules").select("discord_id, data").eq("month", month),
    supabase.from("app_users").select("discord_id, user_name"),
  ]);

  // Discord global_name（表示名）を優先名として取得
  const globalNameMap = new Map<string, string>();
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (token && guildId) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
        { headers: { Authorization: `Bot ${token}` } }
      );
      if (res.ok) {
        const members: Array<{ user: { id: string; global_name?: string | null } }> = await res.json();
        for (const m of members) {
          if (m.user.global_name) globalNameMap.set(m.user.id, m.user.global_name);
        }
      }
    } catch {}
  }

  const appNameMap = new Map<string, string>(
    (appUsers ?? [])
      .filter((u) => u.user_name)
      .map((u) => [u.discord_id, u.user_name as string])
  );

  const isDiscordId = (name: string) => /^\d{15,20}$/.test(name);

  // 重複排除
  const unique = Array.from(
    new Map((schedUsers ?? []).map((u) => [u.discord_id, u])).values()
  );

  const users = unique.map((u) => ({
    discord_id: u.discord_id,
    // 優先順位: Discord global_name > schedules.user_name（IDでなければ） > app_users.user_name
    user_name:
      globalNameMap.get(u.discord_id) ??
      (!u.user_name || isDiscordId(u.user_name)
        ? (appNameMap.get(u.discord_id) ?? u.user_name ?? u.discord_id)
        : u.user_name),
  }));

  return NextResponse.json({
    users,
    monthData: monthData ?? [],
  });
}
