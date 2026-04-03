import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";

const CATEGORY_MAP: Record<string, string> = {
  recruiting: process.env.CATEGORY_RECRUITING ?? "",
  confirmed: process.env.CATEGORY_CONFIRMED ?? "",
  closed_trpg: process.env.CATEGORY_CLOSED_TRPG ?? "",
  closed_murder: process.env.CATEGORY_CLOSED_MURDER ?? "",
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).filter(([, v]) => v).map(([k, v]) => [v, k])
);

// 管理カテゴリ内のDiscordチャンネルをSupabaseに同期
export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Bot token or guild ID not configured" }, { status: 500 });
  }

  try {
    // Discordのギルド内全チャンネル取得
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.message ?? "Discord error" }, { status: res.status });
    }

    const channels: { id: string; type: number; name: string; parent_id: string | null }[] = await res.json();

    // 管理対象カテゴリ内のテキストチャンネルのみ抽出
    const managed = channels.filter(
      (c) => c.type === 0 && c.parent_id && REVERSE_MAP[c.parent_id]
    );

    if (managed.length === 0) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    // Supabaseで既存のdiscord_channel_idを取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await supabase
      .from("events")
      .select("discord_channel_id");

    const existingIds = new Set((existing ?? []).map((e: { discord_channel_id: string }) => e.discord_channel_id));

    // 未登録チャンネルのみ挿入
    const toInsert = managed
      .filter((c) => !existingIds.has(c.id))
      .map((c) => ({
        title: c.name,
        status: REVERSE_MAP[c.parent_id!],
        discord_channel_id: c.id,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("events").insert(toInsert);
      if (error) {
        console.error("Supabase insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ synced: toInsert.length, total: managed.length });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Discord チャンネル名に使える形式へ変換（小文字・スペース→ハイフン・100文字以内）
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

      const body: Record<string, unknown> = {
        name: toChannelName(title),
        type: 0, // GUILD_TEXT
      };
      if (categoryId) body.parent_id = categoryId;

      const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Discord create error:", data);
        return NextResponse.json(
          { error: data.message ?? "Discord error" },
          { status: res.status }
        );
      }

      return NextResponse.json({ channelId: data.id });
    }

    if (action === "update") {
      if (!channelId) {
        return NextResponse.json({ error: "channelId required" }, { status: 400 });
      }

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
        return NextResponse.json(
          { error: data.message ?? "Discord error" },
          { status: res.status }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!channelId) {
        return NextResponse.json({ error: "channelId required" }, { status: 400 });
      }

      const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Discord delete error:", data);
        return NextResponse.json(
          { error: data.message ?? "Discord error" },
          { status: res.status }
        );
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
