import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";

export async function POST(req: Request) {
  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // イベント取得
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // カウント対象の月（セッションの開催月 or 現在月）
  const countMonth =
    event.month ||
    event.event_date?.slice(0, 7) ||
    new Date().toISOString().slice(0, 7);

  const gmName = event.gm_name || event.creator_name;
  const gmId   = event.gm_id   || event.creator_id;

  // GM が特定できる場合のみカウントをインクリメント
  if (gmName) {
    const { data: existing } = await supabase
      .from("gm_monthly_stats")
      .select("count")
      .eq("gm_name", gmName)
      .eq("month", countMonth)
      .maybeSingle();

    await supabase
      .from("gm_monthly_stats")
      .upsert(
        {
          gm_name: gmName,
          gm_id: gmId ?? null,
          month: countMonth,
          count: (existing?.count ?? 0) + 1,
        },
        { onConflict: "gm_name,month" }
      );
  }

  // Discord チャンネルを削除
  const token = process.env.DISCORD_BOT_TOKEN;
  if (token && event.discord_channel_id) {
    await fetch(`${DISCORD_API}/channels/${event.discord_channel_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${token}` },
    }).catch(() => {});
  }

  // DB からセッションを削除
  await supabase.from("events").delete().eq("id", eventId);

  return NextResponse.json({ success: true, month: countMonth, gmName });
}
