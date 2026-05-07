import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_DISCORD_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function defaultAvatarUrl(userId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> BigInt(22)) % 6}.png`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId || !ADMIN_IDS.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // schedules テーブルから discord_id ごとに最新の user_name を取得
  const { data: scheduleData, error } = await supabase
    .from("schedules")
    .select("discord_id, user_name")
    .not("discord_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // discord_id で重複排除（最後に出てきた user_name を採用）
  const userMap = new Map<string, string>();
  for (const row of scheduleData ?? []) {
    if (row.discord_id && row.user_name) {
      userMap.set(row.discord_id, row.user_name);
    }
  }

  // app_users からアバターを補完
  const ids = Array.from(userMap.keys());
  const { data: appUsers } = await supabase
    .from("app_users")
    .select("discord_id, avatar_url")
    .in("discord_id", ids);

  const avatarMap = new Map<string, string>(
    (appUsers ?? [])
      .filter((u) => u.avatar_url)
      .map((u) => [u.discord_id, u.avatar_url as string])
  );

  // app_users にアバターがないユーザーを Discord ギルドメンバー API で補完
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (token && guildId) {
    const missingIds = ids.filter((id) => !avatarMap.has(id));
    await Promise.all(
      missingIds.map(async (id) => {
        const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${id}`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (!res.ok) return;
        const member = await res.json();
        const hash = member.avatar ?? member.user?.avatar;
        avatarMap.set(
          id,
          hash
            ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png`
            : defaultAvatarUrl(id)
        );
      })
    );
  }

  const result = ids
    .filter((id) => userMap.has(id))
    .map((discord_id) => ({
      discord_id,
      user_name: userMap.get(discord_id)!,
      avatar_url: avatarMap.get(discord_id) ?? defaultAvatarUrl(discord_id),
    }))
    .sort((a, b) => a.user_name.localeCompare(b.user_name, "ja"));

  return NextResponse.json(result);
}
