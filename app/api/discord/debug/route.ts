import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";
const MEMBER_LIST_CHANNEL_ID = process.env.MEMBER_LIST_CHANNEL_ID ?? "1486015924786958398";
const TRPG_BOT_ID = process.env.TRPG_CALENDER_BOT_ID ?? "1473385891836985498";

export async function GET(req: Request) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return NextResponse.json({ error: "no token/guild" });

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channel");

  // セッションチャンネルのメッセージ確認モード
  if (channelId) {
    const res = await fetch(
      `${DISCORD_API}/channels/${channelId}/messages?limit=50`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    const msgs = await res.json();
    if (!Array.isArray(msgs)) return NextResponse.json({ status: res.status, body: msgs });
    const botMsgs = msgs.filter((m: { author: { id: string } }) => m.author.id === TRPG_BOT_ID);
    return NextResponse.json({
      total_messages: msgs.length,
      trpg_bot_messages: botMsgs.length,
      bot_messages_preview: botMsgs.map((m: { embeds: Array<{ title?: string; fields?: unknown[] }> }) => ({
        embed_titles: m.embeds?.map(e => e.title),
        embed_field_names: m.embeds?.[0]?.fields?.map((f: unknown) => (f as { name: string }).name),
      })),
    });
  }

  // メンバーチャンネルのメッセージ確認モード（デフォルト）
  const res = await fetch(
    `${DISCORD_API}/channels/${MEMBER_LIST_CHANNEL_ID}/messages?limit=5`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  const messages = await res.json();
  if (!Array.isArray(messages)) return NextResponse.json({ status: res.status, body: messages });

  const memberMsg = messages.find(
    (m: { content: string }) =>
      m.content.includes("→") &&
      (m.content.includes("紐付け") || m.content.includes("メンバー"))
  );

  // マッピング解析
  const mapping: Record<string, string> = {};
  if (memberMsg) {
    for (const line of memberMsg.content.split("\n")) {
      const arrowIdx = line.indexOf("→");
      if (arrowIdx === -1) continue;
      const left = line.slice(0, arrowIdx).trim();
      const siteName = line.slice(arrowIdx + 1).trim();
      if (!siteName || !left) continue;

      const idMatch = left.match(/<@(\d{10,})/);
      if (idMatch) { mapping[siteName] = idMatch[1]; continue; }

      if (left.includes("@")) {
        const parts = left.split("@").map(s => s.trim()).filter(Boolean);
        const displayName = parts[parts.length - 1];
        if (displayName && displayName !== "不明なユーザー") {
          mapping[siteName] = `NEEDS_LOOKUP:${displayName}`;
        }
      }
    }
  }

  return NextResponse.json({
    member_msg_found: !!memberMsg,
    member_msg_author: memberMsg?.author?.username,
    parsed_mapping_count: Object.keys(mapping).length,
    mapping_sample: Object.fromEntries(Object.entries(mapping).slice(0, 5)),
  });
}
