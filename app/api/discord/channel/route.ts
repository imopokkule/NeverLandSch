import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";
const TRPG_BOT_ID = process.env.TRPG_CALENDER_BOT_ID ?? "1473385891836985498";
const MEMBER_LIST_CHANNEL_ID = process.env.MEMBER_LIST_CHANNEL_ID ?? "1486015924786958398";

const CATEGORY_MAP: Record<string, string> = {
  recruiting: process.env.CATEGORY_RECRUITING ?? "",
  confirmed: process.env.CATEGORY_CONFIRMED ?? "",
  closed_trpg: process.env.CATEGORY_CLOSED_TRPG ?? "",
  closed_murder: process.env.CATEGORY_CLOSED_MURDER ?? "",
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).filter(([, v]) => v).map(([k, v]) => [v, k])
);

type DiscordMessage = {
  author: { id: string };
  content: string;
  embeds: Array<{
    title?: string;
    description?: string;
    fields?: Array<{ name: string; value: string }>;
  }>;
};

// Discord表示名からユーザーIDを検索
async function searchMemberId(token: string, guildId: string, displayName: string): Promise<string | null> {
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/search?query=${encodeURIComponent(displayName)}&limit=10`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  if (!res.ok) return null;

  const members: Array<{ user: { id: string; username: string; global_name?: string }; nick: string | null }> = await res.json();
  const lower = displayName.toLowerCase();

  const exact = members.find(
    (m) =>
      (m.nick ?? "").toLowerCase() === lower ||
      (m.user.global_name ?? "").toLowerCase() === lower ||
      m.user.username.toLowerCase() === lower
  );
  return exact?.user.id ?? null;
}

// メンバー一覧から サイト名(lowercase) → Discord ID マッピングを取得
async function fetchMemberMapping(token: string, guildId: string): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();

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

    // <@userid> 形式 → IDを直接使用
    const idMatch = left.match(/<@(\d{10,})/);
    if (idMatch) {
      mapping.set(siteName.toLowerCase(), idMatch[1]);
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

  // メンバー検索でIDを補完
  for (const entry of nameEntries) {
    const id = await searchMemberId(token, guildId, entry.displayName);
    if (id) mapping.set(entry.siteName.toLowerCase(), id);
  }

  return mapping;
}

// セッションチャンネルのTRPGcalender確定メッセージからGM/PLを抽出
async function fetchSessionInfo(
  token: string,
  channelId: string,
  memberMapping: Map<string, string>
): Promise<{ gm_id: string | null; gm_name: string | null; participants: string[] } | null> {
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
  if (!confirmMsg) return null;

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

  const gmId = gmName
    ? (memberMapping.get(gmName.toLowerCase()) ?? null)
    : null;

  const participants = plNames.map((name) => {
    const discordId = memberMapping.get(name.toLowerCase()) ?? name;
    return JSON.stringify({ discord_id: discordId, user_name: name });
  });

  return { gm_id: gmId, gm_name: gmName, participants };
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
      .select("discord_channel_id, status, gm_id");

    const existingMap = new Map(
      (existing ?? []).map((e: { discord_channel_id: string; status: string; gm_id: string | null }) => [
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
    let participantCount = 0;

    if (memberMapping.size > 0) {
      const noGmChannels = managed.filter((c) => {
        const ev = existingMap.get(c.id);
        return !ev || !ev.gm_id;
      });

      for (const ch of noGmChannels) {
        const info = await fetchSessionInfo(token, ch.id, memberMapping);
        if (!info) continue;
        if (info.gm_id || info.participants.length > 0) {
          await supabase
            .from("events")
            .update({
              gm_id: info.gm_id,
              gm_name: info.gm_name,
              ...(info.participants.length > 0 ? { participants: info.participants } : {}),
            })
            .eq("discord_channel_id", ch.id);
          participantCount++;
        }
      }
    }

    return NextResponse.json({
      synced: toInsert.length,
      updated: updatedCount,
      deleted: toDelete.length,
      participants_updated: participantCount,
      total: managed.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function toChannelName(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_\-]/gu, "")
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
      const categoryId = CATEGORY_MAP[status] || undefined;
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
