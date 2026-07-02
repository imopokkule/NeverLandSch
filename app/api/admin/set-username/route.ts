import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { discord_id, user_name } = await req.json();
  if (!discord_id || !user_name?.trim()) {
    return NextResponse.json({ error: "discord_id and user_name are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("schedules")
    .update({ user_name: user_name.trim() })
    .eq("discord_id", discord_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
