import { ChannelType, Client, ForumChannel } from "discord.js";
import { SupabaseClient } from "@supabase/supabase-js";

export const TRPG_CATEGORY_ID = "1425644276200767588";
export const MADAMIS_CATEGORY_ID = "1425644252179730532";

export function getScenarioSystem(
  parentId: string | null | undefined
): "trpg" | "madamis" | null {
  if (parentId === TRPG_CATEGORY_ID) return "trpg";
  if (parentId === MADAMIS_CATEGORY_ID) return "madamis";
  return null;
}

type ScenarioRow = {
  thread_id: string;
  thread_name: string;
  channel_id: string;
  channel_name: string;
  system: string;
};

async function getAllThreadsInForum(
  forum: ForumChannel
): Promise<{ id: string; name: string }[]> {
  const results: { id: string; name: string }[] = [];

  try {
    const active = await forum.threads.fetchActive();
    for (const [, t] of active.threads) {
      results.push({ id: t.id, name: t.name });
    }
  } catch (err) {
    console.error(`❌ active threads error (${forum.name}):`, err);
  }

  let before: string | undefined;
  for (let page = 0; page < 50; page++) {
    try {
      const archived = await forum.threads.fetchArchived({
        limit: 100,
        before,
        type: "public",
      });
      for (const [, t] of archived.threads) {
        results.push({ id: t.id, name: t.name });
      }
      if (!archived.hasMore) break;
      before = [...archived.threads.values()].pop()?.id;
      if (!before) break;
    } catch {
      break;
    }
  }

  return results;
}

export async function syncAllForumsToSupabase(
  client: Client,
  supabase: SupabaseClient
) {
  console.log("🔄 シナリオ全件同期開始...");

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error("❌ ギルドが見つかりません");
    return;
  }

  const allChannels = await guild.channels.fetch();
  const forumChannels = [...allChannels.values()].filter(
    (c) =>
      c &&
      c.type === ChannelType.GuildForum &&
      (c.parentId === TRPG_CATEGORY_ID || c.parentId === MADAMIS_CATEGORY_ID)
  ) as ForumChannel[];

  console.log(`📋 対象フォーラムチャンネル数: ${forumChannels.length}`);

  const rows: ScenarioRow[] = [];

  for (const forum of forumChannels) {
    const system = getScenarioSystem(forum.parentId);
    if (!system) continue;

    const threads = await getAllThreadsInForum(forum);
    for (const t of threads) {
      rows.push({
        thread_id: t.id,
        thread_name: t.name,
        channel_id: forum.id,
        channel_name: forum.name,
        system,
      });
    }
    console.log(`  📁 ${forum.name}: ${threads.length}件`);
  }

  // 100件ずつバッチupsert
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase
      .from("scenarios")
      .upsert(batch, { onConflict: "thread_id" });
    if (error) console.error(`❌ upsert エラー (batch ${i}):`, error);
  }

  console.log(`✅ シナリオ全件同期完了: ${rows.length}件`);
}
