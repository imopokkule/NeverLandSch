import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const discordId = req.nextUrl.searchParams.get("id");
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!discordId || !token || !guildId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
    { headers: { Authorization: `Bot ${token}` } }
  );

  const body = await res.json();
  return NextResponse.json({ status: res.status, body });
}
