import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 管理用: app_users の現在のusernameを events の gm_name/creator_name に同期する
// POST /api/admin/sync-gm  body: { discord_id: "..." }
export async function POST(req: Request) {
  const { discord_id } = await req.json();
  if (!discord_id) return NextResponse.json({ error: "discord_id required" }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // schedules テーブルから現在のusernameを取得（最新のレコードを使用）
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

  // events の gm_id が一致するもののgm_nameを更新
  const { data: updatedGm, error: e1 } = await supabase
    .from("events")
    .update({ gm_name: correctName })
    .eq("gm_id", discord_id)
    .neq("gm_name", correctName)
    .select("id, title, gm_name");

  // events の creator_id が一致するもののcreator_nameを更新
  const { data: updatedCreator, error: e2 } = await supabase
    .from("events")
    .update({ creator_name: correctName })
    .eq("creator_id", discord_id)
    .neq("creator_name", correctName)
    .select("id, title, creator_name");

  if (e1 || e2) {
    return NextResponse.json({ error: "Update failed", details: [e1, e2] }, { status: 500 });
  }

  return NextResponse.json({
    discord_id,
    correctName,
    updatedGm: updatedGm?.length ?? 0,
    updatedCreator: updatedCreator?.length ?? 0,
  });
}
