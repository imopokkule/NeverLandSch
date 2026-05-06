import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";
const MONTHLY_PATTERN = /立卓済み[〈<].+月[〉>]/;

const CATEGORY_MAP: Record<string, string> = {
  recruiting: process.env.CATEGORY_RECRUITING ?? "",
  confirmed: process.env.CATEGORY_CONFIRMED ?? "",
  closed_trpg: process.env.CATEGORY_CLOSED_TRPG ?? "",
  closed_murder: process.env.CATEGORY_CLOSED_MURDER ?? "",
};

const FIXED_LABELS: Record<string, string> = {
  recruiting: "募集中",
  confirmed: "立卓済み",
  closed_trpg: "〆済みTRPG",
  closed_murder: "〆済みマダミス",
};

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) return NextResponse.json([]);

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return NextResponse.json([]);

  const channels: { id: string; type: number; name: string }[] = await res.json();
  const channelIds = new Set(channels.map((c) => c.id));

  const options: { value: string; label: string }[] = [];

  for (const [key, label] of Object.entries(FIXED_LABELS)) {
    const catId = CATEGORY_MAP[key];
    if (catId && channelIds.has(catId)) {
      options.push({ value: key, label });
    }
  }

  for (const c of channels) {
    if (c.type === 4 && MONTHLY_PATTERN.test(c.name)) {
      options.push({ value: c.name, label: c.name });
    }
  }

  return NextResponse.json(options);
}
