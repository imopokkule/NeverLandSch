import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/admin/sync-gm?name=おちゃ  → eventsテーブルでgm_name/creator_nameを検索
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: byGm }, { data: byCreator }] = await Promise.all([
    supabase.from("events").select("id, title, gm_id, gm_name, creator_id, creator_name, status, event_date, month").ilike("gm_name", `%${name}%`),
    supabase.from("events").select("id, title, gm_id, gm_name, creator_id, creator_name, status, event_date, month").ilike("creator_name", `%${name}%`),
  ]);

  return NextResponse.json({ byGm: byGm ?? [], byCreator: byCreator ?? [] });
}

// POST /api/admin/sync-gm
// body: { discord_id, month? }
//   discord_id: 正しいDiscord ID
//   month:      null月の完了セッションに割り当てる月（省略可）
//
// correctName は schedules テーブルから自動取得（リクエストボディの文字コード問題を回避）
export async function POST(req: Request) {
  const { discord_id, month: targetMonth } = await req.json();
  if (!discord_id) {
    return NextResponse.json({ error: "discord_id required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // schedules テーブルから正しい名前を取得
  const { data: scheduleRows } = await supabase
    .from("schedules")
    .select("user_name")
    .eq("discord_id", discord_id)
    .not("user_name", "is", null)
    .limit(1);

  const correctName = scheduleRows?.[0]?.user_name;
  if (!correctName) {
    return NextResponse.json({ error: "User not found in schedules" }, { status: 404 });
  }

  // ① gm_id が一致するものの gm_name を統一（文字化けの修復も含む）
  const { data: r1 } = await supabase
    .from("events").update({ gm_name: correctName })
    .eq("gm_id", discord_id).neq("gm_name", correctName)
    .select("id");

  // ② creator_id が一致するものの creator_name を統一
  const { data: r2 } = await supabase
    .from("events").update({ creator_name: correctName })
    .eq("creator_id", discord_id).neq("creator_name", correctName)
    .select("id");

  // ③ gm_name が一致するが gm_id が未設定のものに gm_id を付与
  const { data: r3, error: e3 } = await supabase
    .from("events").update({ gm_id: discord_id, creator_id: discord_id })
    .eq("gm_name", correctName).is("gm_id", null)
    .select("id");

  // ④ gm_id が一致して month が null の完了済みセッションに月を付与
  let r4count = 0;
  if (targetMonth) {
    const { data: r4 } = await supabase
      .from("events").update({ month: targetMonth })
      .eq("gm_id", discord_id).is("month", null).is("event_date", null)
      .select("id");
    r4count = r4?.length ?? 0;
  }

  // ⑤ gm_monthly_stats の古い名前エントリを削除（同IDで名前違いの重複を排除）
  await supabase.from("gm_monthly_stats").delete().neq("gm_name", correctName).eq("gm_id", discord_id);

  return NextResponse.json({
    discord_id,
    correctName,
    targetMonth,
    fixedGmName: r1?.length ?? 0,
    fixedCreatorName: r2?.length ?? 0,
    addedGmId: r3?.length ?? 0,
    addedGmIdError: e3 ? e3.message : null,
    assignedMonth: r4count,
  });
}
