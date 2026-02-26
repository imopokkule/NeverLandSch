import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const { eventId } = await req.json()

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 仮ユーザー（あとでOAuth連携）
  const user = {
    id: "demo-user",
    name: "テストユーザー",
  }

  await supabase.from("participants").insert({
    event_id: eventId,
    user_id: user.id,
    user_name: user.name,
  })

  return Response.json({ success: true })
}