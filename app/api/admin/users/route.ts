import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function defaultAvatarUrl(userId: string): string {
  try {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> BigInt(22)) % 6}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

export async function GET() {

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

  // アバター未保存のユーザーはIDから計算したデフォルトアバターを使用（API呼び出し不要）
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
