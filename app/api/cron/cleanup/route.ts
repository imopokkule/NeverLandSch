import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> ヘッダーを付与する
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 前月の年月を計算
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  // 前月の終了済みセッション（discord_channel_id = null のアーカイブ済み）を削除
  const { data: deleted, error } = await supabase
    .from("events")
    .delete()
    .in("status", ["closed_trpg", "closed_murder"])
    .is("discord_channel_id", null)
    .like("event_date", `${prevMonthStr}%`)
    .select("id, title");

  if (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`🗑 Cleaned up ${deleted?.length ?? 0} archived sessions from ${prevMonthStr}`);
  return NextResponse.json({
    month: prevMonthStr,
    deleted: deleted?.length ?? 0,
    titles: deleted?.map((e) => e.title) ?? [],
  });
}
