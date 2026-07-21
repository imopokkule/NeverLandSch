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

  // discord_id で重複排除
  const scheduleNameMap = new Map<string, string>();
  for (const row of scheduleData ?? []) {
    if (row.discord_id && row.user_name) {
      scheduleNameMap.set(row.discord_id, row.user_name);
    }
  }

  const scheduleIds = Array.from(scheduleNameMap.keys());

  // app_users 全件取得（登録日・アバター・スケジュール未登録ユーザー検出に使用）
  const { data: allAppUsers } = await supabase
    .from("app_users")
    .select("discord_id, user_name, avatar_url, created_at");

  const appUserMap = new Map<string, { user_name: string | null; avatar_url: string | null; created_at: string | null }>(
    (allAppUsers ?? []).map((u) => [u.discord_id, {
      user_name: u.user_name ?? null,
      avatar_url: u.avatar_url ?? null,
      created_at: u.created_at ?? null,
    }])
  );

  // schedules + app_users の和集合で表示対象を決定
  const appUserIds = (allAppUsers ?? []).map((u) => u.discord_id);
  const ids = Array.from(new Set([...scheduleIds, ...appUserIds]));

  // Discord ギルドメンバー一覧を取得（アバター・global_name補完・在籍確認）
  const avatarMap = new Map<string, string>();
  const globalNameMap = new Map<string, string>();
  const guildMemberIds = new Set<string>();

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (token && guildId) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
        { headers: { Authorization: `Bot ${token}` } }
      );
      if (res.ok) {
        const members: Array<{
          user: { id: string; username: string; global_name?: string | null; avatar?: string };
          nick?: string | null;
          avatar?: string;
        }> = await res.json();
        for (const m of members) {
          const uid = m.user.id;
          guildMemberIds.add(uid);
          const hash = m.avatar ?? m.user.avatar;
          avatarMap.set(
            uid,
            hash
              ? `https://cdn.discordapp.com/avatars/${uid}/${hash}.png`
              : defaultAvatarUrl(uid)
          );
          const nameToShow = m.nick ?? m.user.global_name;
          if (nameToShow) {
            globalNameMap.set(uid, nameToShow);
          }
        }
      }
    } catch {
      // Discord API 失敗時はデフォルトで続行
    }
  }

  // ギルドAPIから取得した最新アバターをapp_usersに書き戻す（古いURLを修正）
  if (avatarMap.size > 0) {
    const updates = Array.from(avatarMap.entries())
      .filter(([id]) => appUserMap.has(id))
      .map(([discord_id, avatar_url]) => ({ discord_id, avatar_url }));
    if (updates.length > 0) {
      await supabase.from("app_users").upsert(updates, { onConflict: "discord_id" });
    }
  }

  const isDiscordId = (name: string) => /^\d{15,20}$/.test(name);

  const now = Date.now();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const result = ids
    .map((discord_id) => {
      const appUser = appUserMap.get(discord_id);
      const rawSiteName = scheduleNameMap.get(discord_id);
      const hasSchedule = rawSiteName !== undefined;
      // schedules.user_name がDiscord IDの数値の場合はapp_users.user_nameで補完
      const site_name = rawSiteName
        ? (isDiscordId(rawSiteName) ? (appUser?.user_name ?? null) : rawSiteName)
        : null;
      const discord_name = appUser?.user_name ?? null;
      const display_name = globalNameMap.get(discord_id) ?? null;
      const created_at = appUser?.created_at ?? null;
      const isNew = created_at
        ? now - new Date(created_at).getTime() < ONE_WEEK_MS
        : false;

      return {
        discord_id,
        site_name,
        discord_name,
        display_name,
        avatar_url: avatarMap.get(discord_id) ?? appUser?.avatar_url ?? defaultAvatarUrl(discord_id),
        created_at,
        isNew,
        hasSchedule,
        inGuild: guildMemberIds.size === 0 || guildMemberIds.has(discord_id),
      };
    })
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      const nameA = a.display_name ?? a.site_name ?? a.discord_name ?? a.discord_id;
      const nameB = b.display_name ?? b.site_name ?? b.discord_name ?? b.discord_id;
      return nameA.localeCompare(nameB, "ja");
    });

  return NextResponse.json(result);
}
