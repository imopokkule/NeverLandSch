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
// body: { discord_id, gm_name, month }
//   discord_id: 正しいDiscord ID
//   gm_name:    統一したい名前
//   month:      null月の完了セッションに割り当てる月（省略可）
export async function POST(req: Request) {
  const { discord_id, gm_name: targetName, month: targetMonth } = await req.json();
  if (!discord_id || !targetName) {
    return NextResponse.json({ error: "discord_id and gm_name required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ① gm_id が一致するものの gm_name を統一
  const { data: r1 } = await supabase
    .from("events").update({ gm_name: targetName })
    .eq("gm_id", discord_id).neq("gm_name", targetName)
    .select("id");

  // ② creator_id が一致するものの creator_name を統一
  const { data: r2 } = await supabase
    .from("events").update({ creator_name: targetName })
    .eq("creator_id", discord_id).neq("creator_name", targetName)
    .select("id");

  // ③ gm_name が一致するが gm_id が未設定のものに gm_id を付与
  const { data: r3 } = await supabase
    .from("events").update({ gm_id: discord_id, creator_id: discord_id })
    .eq("gm_name", targetName).is("gm_id", null)
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
  await supabase.from("gm_monthly_stats").delete().neq("gm_name", targetName).eq("gm_id", discord_id);

  return NextResponse.json({
    discord_id,
    targetName,
    targetMonth,
    fixedGmName: r1?.length ?? 0,
    fixedCreatorName: r2?.length ?? 0,
    addedGmId: r3?.length ?? 0,
    assignedMonth: r4count,
  });
}
