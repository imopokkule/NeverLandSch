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

  const [{ data: users }, { data: monthData }] = await Promise.all([
    supabase.from("schedules").select("discord_id, user_name").not("user_name", "is", null),
    supabase.from("schedules").select("discord_id, data").eq("month", month),
  ]);

  return NextResponse.json({
    users: users ?? [],
    monthData: monthData ?? [],
  });
}
