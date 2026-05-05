import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";
const MEMBER_LIST_CHANNEL_ID = process.env.MEMBER_LIST_CHANNEL_ID ?? "1486015924786958398";

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" });

  const res = await fetch(
    `${DISCORD_API}/channels/${MEMBER_LIST_CHANNEL_ID}/messages?limit=5`,
    { headers: { Authorization: `Bot ${token}` } }
  );

  const status = res.status;
  const body = await res.json().catch(() => null);

  return NextResponse.json({
    status,
    channel_id: MEMBER_LIST_CHANNEL_ID,
    messages: Array.isArray(body)
      ? body.map((m: { id: string; author: { username: string }; content: string }) => ({
          id: m.id,
          author: m.author?.username,
          content_preview: m.content?.slice(0, 200),
        }))
      : body,
  });
}
