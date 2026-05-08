import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel Cron: 毎月1日 00:00 UTC に実行（vercel.json で設定済み）
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 前月の年月を計算（例: 5/1実行 → "2026-04"）
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  // ① event_date が前月のセッションを削除
  const { data: deletedByDate, error: e1 } = await supabase
    .from("events")
    .delete()
    .like("event_date", `${prevMonth}%`)
    .select("id, title");

  // ② event_date 未設定で month が前月のセッションを削除（undated アーカイブ）
  const { data: deletedByMonth, error: e2 } = await supabase
    .from("events")
    .delete()
    .eq("month", prevMonth)
    .is("event_date", null)
    .select("id, title");

  // ③ gm_monthly_stats の前月分を削除
  const { error: e3 } = await supabase
    .from("gm_monthly_stats")
    .delete()
    .eq("month", prevMonth);

  const errors = [e1, e2, e3].filter(Boolean);
  if (errors.length > 0) {
    console.error("Cleanup errors:", errors);
    return NextResponse.json({ error: "Partial failure", details: errors }, { status: 500 });
  }

  const totalDeleted = (deletedByDate?.length ?? 0) + (deletedByMonth?.length ?? 0);
  console.log(`Cleanup complete: ${totalDeleted} sessions deleted for ${prevMonth}`);
  return NextResponse.json({ success: true, month: prevMonth, deleted: totalDeleted });
}
