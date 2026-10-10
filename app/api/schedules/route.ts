import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: schedUsers }, { data: monthData }, { data: appUsers }] = await Promise.all([
    supabase.from("schedules").select("discord_id, user_name").not("discord_id", "is", null),
    supabase.from("schedules").select("discord_id, data").eq("month", month),
    supabase.from("app_users").select("discord_id, user_name"),
  ]);

  // Discord global_name（表示名）を優先名として取得
  const globalNameMap = new Map<string, string>();
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (token && guildId) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
        { headers: { Authorization: `Bot ${token}` } }
      );
      if (res.ok) {
        const members: Array<{ user: { id: string; global_name?: string | null } }> = await res.json();
        for (const m of members) {
          if (m.user.global_name) globalNameMap.set(String(m.user.id), m.user.global_name);
        }
      }
    } catch {}
  }

  // discord_id は bigint 精度ズレ防止のため必ずString変換してから扱う
  const appNameMap = new Map<string, string>(
    (appUsers ?? [])
      .filter((u) => u.user_name)
      .map((u) => [String(u.discord_id), u.user_name as string])
  );

  const isDiscordId = (name: string) => /^\d{15,20}$/.test(name);

  // 重複排除
  const unique = Array.from(
    new Map((schedUsers ?? []).map((u) => [String(u.discord_id), u])).values()
  );

  const users = unique.map((u) => {
    const discordId = String(u.discord_id);
    return {
      discord_id: discordId,
      // 優先順位: Discord global_name > schedules.user_name（IDでなければ） > app_users.user_name
      user_name:
        globalNameMap.get(discordId) ??
        (!u.user_name || isDiscordId(u.user_name)
          ? (appNameMap.get(discordId) ?? u.user_name ?? discordId)
          : u.user_name),
    };
  });

  return NextResponse.json({
    users,
    monthData: (monthData ?? []).map((m) => ({ ...m, discord_id: String(m.discord_id) })),
  });
}

// セッションの日程が確定した際に、参加者の該当日のスケジュールを自動更新する。
// 昼枠/夜枠のどちらが埋まるかに応じて既存の回答を段階的に降格させる
// （例: 全日◎＋夜セッション確定 → 昼のみ〇。未回答だった日は不可に設定）。
const degradeForSlot = (current: number | null | undefined, slot: "day" | "night"): number => {
  if (current == null) return 0;
  if (slot === "night") {
    if (current === 3) return 1;
    if (current === 2) return 0;
    return current; // 0, 1 はそのまま
  }
  // slot === "day"
  if (current === 3) return 2;
  if (current === 1) return 0;
  return current; // 0, 2 はそのまま
};

export async function POST(req: Request) {
  const { participants, month, day, eventTime } = await req.json() as {
    participants: { discord_id: string; user_name?: string }[];
    month: string;
    day: number;
    eventTime?: string | null;
  };

  if (!Array.isArray(participants) || participants.length === 0 || !month || !day) {
    return NextResponse.json({ error: "participants, month, day are required" }, { status: 400 });
  }

  const hour = eventTime ? parseInt(eventTime.split(":")[0], 10) : 18;
  const slot: "day" | "night" = hour >= 17 ? "night" : "day";

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const discordIds = participants.map((p) => p.discord_id).filter(Boolean);
  const { data: existingRows, error: fetchError } = await supabase
    .from("schedules")
    .select("discord_id, user_name, data")
    .eq("month", month)
    .in("discord_id", discordIds);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  // discord_id は bigint 精度ズレ防止のため必ずString変換してから扱う
  const existingMap = new Map(
    (existingRows ?? []).map((r) => [String(r.discord_id), r])
  );

  const rowsToUpsert = participants
    .filter((p) => p.discord_id)
    .map((p) => {
      const discordId = String(p.discord_id);
      const existing = existingMap.get(discordId);
      const currentData = (existing?.data ?? {}) as Record<string, number | null>;
      const currentValue = currentData[String(day)];
      const newValue = degradeForSlot(currentValue, slot);
      if (newValue === (currentValue ?? null)) return null;
      return {
        discord_id: discordId,
        user_name: existing?.user_name ?? p.user_name ?? discordId,
        month,
        data: { ...currentData, [String(day)]: newValue },
      };
    })
    .filter(Boolean);

  if (rowsToUpsert.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { error: upsertError } = await supabase
    .from("schedules")
    .upsert(rowsToUpsert, { onConflict: "discord_id,month" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: rowsToUpsert.length });
}
