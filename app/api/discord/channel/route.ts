import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";
const TRPG_BOT_ID = process.env.TRPG_CALENDER_BOT_ID ?? "1473385891836985498";
const MEMBER_LIST_CHANNEL_ID = process.env.MEMBER_LIST_CHANNEL_ID ?? "1501747391462637659";

const CATEGORY_MAP: Record<string, string> = {
  recruiting: process.env.CATEGORY_RECRUITING ?? "",
  confirmed: process.env.CATEGORY_CONFIRMED ?? "",
  closed_trpg: process.env.CATEGORY_CLOSED_TRPG ?? "",
  closed_murder: process.env.CATEGORY_CLOSED_MURDER ?? "",
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).filter(([, v]) => v).map(([k, v]) => [v, k])
);

function defaultAvatarUrl(userId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> BigInt(22)) % 6}.png`;
}

type DiscordMessage = {
  id: string;
  author: { id: string };
  content: string;
  embeds: Array<{
    title?: string;
    description?: string;
    fields?: Array<{ name: string; value: string }>;
  }>;
};

// メッセージへのリアクションユーザー ID 一覧を取得（ボット除外）
async function fetchReactionUsers(
  token: string,
  channelId: string,
  messageId: string,
  emoji: string
): Promise<string[]> {
  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?limit=100`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  if (!res.ok) return [];
  const users: Array<{ id: string; bot?: boolean }> = await res.json();
  return users.filter((u) => !u.bot).map((u) => u.id);
}

// Discord表示名からユーザー情報を検索
async function searchMember(
  token: string,
  guildId: string,
  displayName: string
): Promise<{ id: string; avatar_url: string | null; global_name: string | null } | null> {
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/search?query=${encodeURIComponent(displayName)}&limit=10`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  if (!res.ok) return null;

  const members: Array<{
    user: { id: string; username: string; global_name?: string; avatar?: string };
    nick: string | null;
    avatar?: string;
  }> = await res.json();
  const lower = displayName.toLowerCase();

  const exact = members.find(
    (m) =>
      (m.nick ?? "").toLowerCase() === lower ||
      (m.user.global_name ?? "").toLowerCase() === lower ||
      m.user.username.toLowerCase() === lower
  );
  if (!exact) return null;

  const avatarHash = exact.avatar ?? exact.user.avatar;
  const avatar_url = avatarHash
    ? `https://cdn.discordapp.com/avatars/${exact.user.id}/${avatarHash}.png`
    : defaultAvatarUrl(exact.user.id);

  return {
    id: exact.user.id,
    avatar_url,
    global_name: exact.user.global_name ?? exact.user.username ?? null,
  };
}

// メンバー一覧から サイト名(lowercase) → {id, avatar_url, global_name} マッピングを取得
async function fetchMemberMapping(
  token: string,
  guildId: string
): Promise<Map<string, { id: string; avatar_url: string | null; global_name: string | null }>> {
  const mapping = new Map<string, { id: string; avatar_url: string | null; global_name: string | null }>();

  const res = await fetch(
    `${DISCORD_API}/channels/${MEMBER_LIST_CHANNEL_ID}/messages?limit=20`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  if (!res.ok) return mapping;

  const messages: DiscordMessage[] = await res.json();

  // メンバー一覧が含まれるメッセージを探す（投稿者問わず）
  const memberMsg = messages.find(
    (m) =>
      m.content.includes("→") &&
      (m.content.includes("紐付け") || m.content.includes("メンバー") ||
       m.embeds.some((e) =>
         (e.title ?? "").includes("メンバー一覧") ||
         (e.description ?? "").includes("紐付け")
       ))
  );
  if (!memberMsg) return mapping;

  const allText = [
    memberMsg.content,
    ...memberMsg.embeds.map((e) => e.description ?? ""),
  ].join("\n");

  const nameEntries: Array<{ displayName: string; siteName: string }> = [];

  for (const line of allText.split("\n")) {
    const arrowIdx = line.indexOf("→");
    if (arrowIdx === -1) continue;

    const left = line.slice(0, arrowIdx).trim();
    const siteName = line.slice(arrowIdx + 1).trim();
    if (!siteName || !left) continue;

    // <@userid> 形式 → IDからギルドメンバーを取得してアバターとグローバル表示名を補完
    const idMatch = left.match(/<@!?(\d{10,})/);
    if (idMatch) {
      const userId = idMatch[1];
      let avatar_url: string | null = null;
      let global_name: string | null = null;
      const memberRes = await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
        { headers: { Authorization: `Bot ${token}` } }
      );
      if (memberRes.ok) {
        const member = await memberRes.json();
        const avatarHash = member.avatar ?? member.user?.avatar;
        avatar_url = avatarHash
          ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`
          : defaultAvatarUrl(userId);
        global_name = member.user?.global_name ?? member.user?.username ?? null;
      }
      mapping.set(siteName.toLowerCase(), { id: userId, avatar_url, global_name });
      continue;
    }

    // @表示名 形式（複数@の場合は最後のセグメントをニックネームとして使用）
    if (left.includes("@")) {
      const parts = left.split("@").map((s) => s.trim()).filter(Boolean);
      const displayName = parts[parts.length - 1];
      if (displayName && displayName !== "不明なユーザー" && !mapping.has(siteName.toLowerCase())) {
        nameEntries.push({ displayName, siteName });
      }
    }
  }

  // メンバー検索でIDとアバターを補完
  for (const entry of nameEntries) {
    const member = await searchMember(token, guildId, entry.displayName);
    if (member) mapping.set(entry.siteName.toLowerCase(), member);
  }

  return mapping;
}

// セッションチャンネルのTRPGcalender確定メッセージからGM/PLを抽出
async function fetchSessionInfo(
  token: string,
  guildId: string,
  channelId: string,
  memberMapping: Map<string, { id: string; avatar_url: string | null; global_name: string | null }>
): Promise<{ gm_id: string | null; gm_name: string | null; gm_avatar: string | null; participants: string[] } | null> {
  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages?limit=50`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  if (!res.ok) return null;

  const messages: DiscordMessage[] = await res.json();

  const confirmMsg = messages.find(
    (m) =>
      m.author.id === TRPG_BOT_ID &&
      m.embeds.some((e) => (e.title ?? "").includes("卓が確定しました"))
  );

  // 確定メッセージがない場合は募集中メッセージの ✋ リアクション者を参加者として使用
  if (!confirmMsg) {
    const recruitMsg = messages.find(
      (m) =>
        m.author.id === TRPG_BOT_ID &&
        m.embeds.some((e) => (e.title ?? "").includes("参加者募集中"))
    );
    if (!recruitMsg) return null;

    const reactorIds = await fetchReactionUsers(token, channelId, recruitMsg.id, "✋");
    if (reactorIds.length === 0) return null;

    // id → {global_name} 逆引きマップ
    const idToInfo = new Map<string, { global_name: string | null }>();
    for (const info of memberMapping.values()) {
      if (info.id) idToInfo.set(info.id, { global_name: info.global_name });
    }

    const participants: string[] = [];
    for (const id of reactorIds) {
      let displayName = id;
      if (idToInfo.has(id)) {
        displayName = idToInfo.get(id)!.global_name ?? id;
      } else {
        const memberRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${id}`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (memberRes.ok) {
          const member = await memberRes.json();
          displayName = member.user?.global_name ?? member.user?.username ?? id;
        }
      }
      participants.push(JSON.stringify({ discord_id: id, user_name: displayName, role: "pl" }));
    }

    return { gm_id: null, gm_name: null, gm_avatar: null, participants };
  }

  const embed = confirmMsg.embeds.find((e) =>
    (e.title ?? "").includes("卓が確定しました")
  );
  if (!embed?.fields) return null;

  const gmField = embed.fields.find((f) => f.name === "GM");
  const plField = embed.fields.find((f) => f.name.startsWith("PL"));

  const gmName = gmField?.value?.trim() ?? null;
  const plNames = plField?.value
    ? plField.value.split(/[,、]/).map((s) => s.trim()).filter(Boolean)
    : [];

  // メッセージ本文のメンション（<@userid>）から Discord ID を直接取得
  const mentionedIds = Array.from(confirmMsg.content.matchAll(/<@!?(\d+)>/g)).map((m) => m[1]);

  // id → {global_name, avatar_url} の逆引きマップ
  const idToInfo = new Map<string, { global_name: string | null; avatar_url: string | null }>();
  for (const info of memberMapping.values()) {
    if (info.id) idToInfo.set(info.id, { global_name: info.global_name, avatar_url: info.avatar_url });
  }

  // GM解決（埋め込みのサイト名からメンバーマッピングで引く）
  let gmMember = gmName ? memberMapping.get(gmName.toLowerCase()) : null;
  if (!gmMember && gmName) {
    gmMember = await searchMember(token, guildId, gmName);
  }
  const gmId = gmMember?.id ?? null;
  const gmAvatar = gmMember?.avatar_url ?? null;
  const gmDisplayName = gmMember?.global_name ?? gmName;

  // GMをparticipantsの先頭に追加
  const participants: string[] = [];
  if (gmName) {
    const gmDiscordId = gmId ?? gmName;
    participants.push(JSON.stringify({ discord_id: gmDiscordId, user_name: gmDisplayName, role: "gm" }));
  }

  if (mentionedIds.length > 0) {
    // メンション ID からPLを構築（GMを除外）
    for (const id of mentionedIds) {
      if (gmId && id === gmId) continue;

      let displayName = id;
      if (idToInfo.has(id)) {
        displayName = idToInfo.get(id)!.global_name ?? id;
      } else {
        // マッピングにない場合は Discord API から直接取得
        const memberRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${id}`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (memberRes.ok) {
          const member = await memberRes.json();
          displayName = member.user?.global_name ?? member.user?.username ?? id;
        }
      }
      participants.push(JSON.stringify({ discord_id: id, user_name: displayName, role: "pl" }));
    }
  } else {
    // フォールバック：埋め込みの PL 名から解決
    for (const name of plNames) {
      const member = memberMapping.get(name.toLowerCase());
      const discordId = member?.id ?? name;
      const displayName = member?.global_name ?? name;
      participants.push(JSON.stringify({ discord_id: discordId, user_name: displayName, role: "pl" }));
    }
  }

  return { gm_id: gmId, gm_name: gmDisplayName, gm_avatar: gmAvatar, participants };
}

// 管理カテゴリ内のDiscordチャンネルをSupabaseに同期
export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Bot token or guild ID not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.message ?? "Discord error" }, { status: res.status });
    }

    const channels: { id: string; type: number; name: string; parent_id: string | null }[] =
      await res.json();

    const MONTHLY_PATTERN = /立卓済み[〈<].+月[〉>]/;
    const dynamicReverseMap: Record<string, string> = { ...REVERSE_MAP };
    for (const c of channels) {
      if (c.type === 4 && MONTHLY_PATTERN.test(c.name)) {
        dynamicReverseMap[c.id] = c.name;
      }
    }

    const managed = channels.filter(
      (c) => c.type === 0 && c.parent_id && dynamicReverseMap[c.parent_id]
    );

    if (managed.length === 0) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    const allChannelMap = new Map(channels.map((c) => [c.id, c]));

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await supabase
      .from("events")
      .select("discord_channel_id, status, gm_id, creator_name, creator_image");

    const existingMap = new Map(
      (existing ?? []).map((e: { discord_channel_id: string; status: string; gm_id: string | null; creator_name: string | null; creator_image: string | null }) => [
        e.discord_channel_id,
        e,
      ])
    );

    // 未登録チャンネルを挿入
    const toInsert = managed
      .filter((c) => !existingMap.has(c.id))
      .map((c) => ({
        title: c.name,
        status: dynamicReverseMap[c.parent_id!],
        discord_channel_id: c.id,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("events").insert(toInsert);
      if (error) {
        console.error("Supabase insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // 全DBレコードをDiscord上の現在のカテゴリと照合してstatusを更新
    let updatedCount = 0;
    for (const [channelId, ev] of existingMap) {
      const ch = allChannelMap.get(channelId);
      if (!ch || !ch.parent_id) continue;
      const newStatus = dynamicReverseMap[ch.parent_id];
      if (newStatus && newStatus !== ev.status) {
        await supabase
          .from("events")
          .update({ status: newStatus })
          .eq("discord_channel_id", channelId);
        updatedCount++;
      }
    }

    // Discordに存在しないチャンネルのイベントをDBから削除
    const discordChannelIds = new Set(channels.map((c) => c.id));
    const toDelete = (existing ?? [])
      .map((e: { discord_channel_id: string }) => e.discord_channel_id)
      .filter((id: string) => !discordChannelIds.has(id));

    if (toDelete.length > 0) {
      await supabase.from("events").delete().in("discord_channel_id", toDelete);
    }

    // TRPGcalenderのGM/PL情報を取得（gm_idが未設定のセッションのみ）
    const memberMapping = await fetchMemberMapping(token, guildId);
    const mappingDebug = Object.fromEntries(
      Array.from(memberMapping.entries()).map(([k, v]) => [k, { id: v.id, has_avatar: !!v.avatar_url, avatar_url: v.avatar_url, global_name: v.global_name }])
    );
    let participantCount = 0;

    const noGmChannels = managed.filter((c) => {
      const ev = existingMap.get(c.id);
      return !ev || !ev.gm_id || !ev.creator_name || !ev.creator_image;
    });

    for (const ch of noGmChannels) {
      const info = await fetchSessionInfo(token, guildId, ch.id, memberMapping);
      if (!info) continue;
      if (info.gm_name || info.participants.length > 0) {
        // GM/PL情報を更新
        await supabase
          .from("events")
          .update({
            gm_id: info.gm_id,
            gm_name: info.gm_name,
            ...(info.participants.length > 0 ? { participants: info.participants } : {}),
          })
          .eq("discord_channel_id", ch.id);

        // creator未設定の場合のみ名前・IDをセット
        if (info.gm_name) {
          await supabase
            .from("events")
            .update({
              creator_name: info.gm_name,
              ...(info.gm_id ? { creator_id: info.gm_id } : {}),
            })
            .eq("discord_channel_id", ch.id)
            .is("creator_name", null);

          // creator_imageが未設定の場合はアバターを個別に更新
          if (info.gm_avatar) {
            await supabase
              .from("events")
              .update({ creator_image: info.gm_avatar })
              .eq("discord_channel_id", ch.id)
              .is("creator_image", null);
          }
        }

        participantCount++;
      }
    }

    return NextResponse.json({
      synced: toInsert.length,
      updated: updatedCount,
      deleted: toDelete.length,
      participants_updated: participantCount,
      total: managed.length,
      mapping_debug: mappingDebug,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function toChannelName(title: string): string {
  return title
    .replace(/[：:]/g, "-")
    .replace(/[～〜~]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_\-]/gu, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100) || "untitled";
}

export async function POST(req: Request) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    console.error("Missing env: DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
    return NextResponse.json(
      { error: "Bot token or guild ID not configured" },
      { status: 500 }
    );
  }

  const headers: HeadersInit = {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };

  const { action, title, status, channelId } = await req.json();

  try {
    if (action === "create") {
      let categoryId: string | undefined = CATEGORY_MAP[status] || undefined;

      if (!categoryId) {
        const guildChRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (guildChRes.ok) {
          const allCh: { id: string; type: number; name: string }[] = await guildChRes.json();
          const match = allCh.find((c) => c.type === 4 && c.name === status);
          if (match) categoryId = match.id;
        }
      }

      const body: Record<string, unknown> = { name: toChannelName(title), type: 0 };
      if (categoryId) body.parent_id = categoryId;

      const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Discord create error:", data);
        return NextResponse.json({ error: data.message ?? "Discord error" }, { status: res.status });
      }
      return NextResponse.json({ channelId: data.id });
    }

    if (action === "update") {
      if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

      const categoryId = CATEGORY_MAP[status] || undefined;
      const body: Record<string, unknown> = { name: toChannelName(title) };
      if (categoryId) body.parent_id = categoryId;

      const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Discord update error:", data);
        return NextResponse.json({ error: data.message ?? "Discord error" }, { status: res.status });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

      const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Discord delete error:", data);
        return NextResponse.json({ error: data.message ?? "Discord error" }, { status: res.status });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Discord API route error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
