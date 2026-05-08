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

  // 帰属月（event_date優先、なければevent.month、なければ現在月）
  const countMonth =
    event.event_date?.slice(0, 7) ||
    event.month ||
    new Date().toISOString().slice(0, 7);

  // Discord チャンネルを削除
  const token = process.env.DISCORD_BOT_TOKEN;
  if (token && event.discord_channel_id) {
    await fetch(`${DISCORD_API}/channels/${event.discord_channel_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${token}` },
    }).catch(() => {});
  }

  // DB にアーカイブ（削除せず discord_channel_id を null にして月を確定させる）
  await supabase.from("events").update({
    discord_channel_id: null,
    month: countMonth,
  }).eq("id", eventId);

  return NextResponse.json({ success: true, month: countMonth });
}
