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

  const ids = Array.from(scheduleNameMap.keys());

  // app_users 全件取得（登録日・アバター・スケジュール未登録ユーザー検出に使用）
  const { data: allAppUsers } = await supabase
    .from("app_users")
    .select("discord_id, user_name, avatar_url, created_at");

  const appUsers = (allAppUsers ?? []).filter((u) => ids.includes(u.discord_id));

  const appUserMap = new Map<string, { user_name: string | null; avatar_url: string | null; created_at: string | null }>(
    (appUsers ?? []).map((u) => [u.discord_id, {
      user_name: u.user_name ?? null,
      avatar_url: u.avatar_url ?? null,
      created_at: u.created_at ?? null,
    }])
  );

  // Discord ギルドメンバー一覧を取得（アバター・global_name補完）
  const avatarMap = new Map<string, string>();
  const globalNameMap = new Map<string, string>();

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const USERLIST_CHANNEL_ID = "1501747391462637659";

  // ユーザーリストチャンネルに投稿したユーザーIDを取得（ページネーション対応）
  const userListPosters = new Set<string>();
  if (token) {
    try {
      let before: string | undefined;
      for (let page = 0; page < 20; page++) {
        const url = new URL(`https://discord.com/api/v10/channels/${USERLIST_CHANNEL_ID}/messages`);
        url.searchParams.set("limit", "100");
        if (before) url.searchParams.set("before", before);

        const msgRes = await fetch(url.toString(), {
          headers: { Authorization: `Bot ${token}` },
        });
        if (!msgRes.ok) break;

        const messages: Array<{ id: string; author: { id: string; bot?: boolean } }> = await msgRes.json();
        if (messages.length === 0) break;

        for (const msg of messages) {
          if (!msg.author.bot) userListPosters.add(msg.author.id);
        }

        if (messages.length < 100) break;
        before = messages[messages.length - 1].id;
      }
    } catch {
      // Discord API 失敗時はスキップ
    }
  }

  if (token && guildId) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
        { headers: { Authorization: `Bot ${token}` } }
      );
      if (res.ok) {
        const members: Array<{
          user: { id: string; username: string; global_name?: string | null; avatar?: string };
          avatar?: string;
        }> = await res.json();
        for (const m of members) {
          const uid = m.user.id;
          const hash = m.avatar ?? m.user.avatar;
          avatarMap.set(
            uid,
            hash
              ? `https://cdn.discordapp.com/avatars/${uid}/${hash}.png`
              : defaultAvatarUrl(uid)
          );
          if (m.user.global_name) {
            globalNameMap.set(uid, m.user.global_name);
          }
        }
      }
    } catch {
      // Discord API 失敗時はデフォルトで続行
    }
  }

  const now = Date.now();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const scheduleIds = new Set(ids);

  const result = ids
    .filter((id) => scheduleNameMap.has(id))
    .map((discord_id) => {
      const appUser = appUserMap.get(discord_id);
      const site_name = scheduleNameMap.get(discord_id)!;
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
        hasSchedule: true,
        inUserListChannel: userListPosters.has(discord_id),
      };
    })
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      return (a.site_name ?? "").localeCompare(b.site_name ?? "", "ja");
    });

  return NextResponse.json(result);
}
