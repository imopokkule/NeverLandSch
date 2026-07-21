import { NextRequest, NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const checkId = req.nextUrl.searchParams.get("id");
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const ids = new Set<string>();
  let pages = 0;
  let after = "0";

  for (;;) {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
        { headers: { Authorization: `Bot ${token}` } }
      );
      if (r.status === 429) {
        const d = await r.json().catch(() => ({}));
        await sleep(((d.retry_after ?? 1) as number) * 1000);
        continue;
      }
      res = r;
      break;
    }
    if (!res || !res.ok) {
      return NextResponse.json({
        error: `API failed: HTTP ${res?.status}`,
        pages,
        total: ids.size,
      });
    }

    const members: { user: { id: string } }[] = await res.json();
    for (const m of members) ids.add(m.user.id);
    pages++;

    if (members.length < 1000) break;
    after = members[members.length - 1].user.id;
  }

  return NextResponse.json({
    pages,
    total: ids.size,
    found: checkId ? ids.has(checkId) : null,
    checkId,
  });
}
