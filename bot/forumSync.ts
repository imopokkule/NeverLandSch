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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchArchivedViaRest(
  channelId: string,
  token: string,
  type: "public" | "private"
): Promise<{ id: string; name: string }[]> {
  const results: { id: string; name: string }[] = [];
  let before: string | undefined;

  for (let page = 0; page < 50; page++) {
    const url = new URL(
      `https://discord.com/api/v10/channels/${channelId}/threads/archived/${type}`
    );
    url.searchParams.set("limit", "100");
    if (before) url.searchParams.set("before", before);

    let res: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bot ${token}` },
      });
      if (r.status === 429) {
        const d = await r.json().catch(() => ({}));
        await sleep(((d.retry_after ?? 1) as number) * 1000);
        continue;
      }
      res = r;
      break;
    }
    if (!res || !res.ok) break;

    const data = await res.json();
    const batch: { id: string; name: string; thread_metadata?: { archive_timestamp?: string } }[] =
      data.threads ?? [];

    for (const t of batch) results.push({ id: t.id, name: t.name });

    if (!data.has_more || batch.length === 0) break;
    before = batch[batch.length - 1].thread_metadata?.archive_timestamp;
    if (!before) break;
  }

  return results;
}

async function getAllThreadsInForum(
  forum: ForumChannel,
  token: string
): Promise<{ id: string; name: string }[]> {
  const seen = new Map<string, string>();

  try {
    const active = await forum.threads.fetchActive();
    for (const [, t] of active.threads) seen.set(t.id, t.name);
  } catch (err) {
    console.error(`  ⚠ active fetch error (${forum.name}):`, err);
  }

  const [pub, priv] = await Promise.all([
    fetchArchivedViaRest(forum.id, token, "public"),
    fetchArchivedViaRest(forum.id, token, "private"),
  ]);
  for (const t of [...pub, ...priv]) {
    if (!seen.has(t.id)) seen.set(t.id, t.name);
  }

  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

export async function syncAllForumsToSupabase(
  client: Client,
  supabase: SupabaseClient,
  guildId?: string
) {
  console.log("🔄 シナリオ全件同期開始...");

  const guild = guildId
    ? (client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null))
    : client.guilds.cache.first();

  if (!guild) {
    console.error("❌ ギルドが見つかりません");
    return;
  }
  console.log(`🏰 ギルド: ${guild.name} (${guild.id})`);

  const allChannels = await guild.channels.fetch();
  console.log(`📡 全チャンネル数: ${allChannels.size}`);

  // デバッグ: カテゴリ周辺のチャンネルを出力
  for (const [, c] of allChannels) {
    if (!c) continue;
    if (
      c.parentId === TRPG_CATEGORY_ID ||
      c.parentId === MADAMIS_CATEGORY_ID ||
      c.id === TRPG_CATEGORY_ID ||
      c.id === MADAMIS_CATEGORY_ID
    ) {
      console.log(`  🔍 ${c.name} | type=${c.type} | parentId=${c.parentId ?? "null"}`);
    }
  }

  const forumChannels = [...allChannels.values()].filter(
    (c) =>
      c &&
      (c.type === ChannelType.GuildForum || c.type === 16) &&
      (c.parentId === TRPG_CATEGORY_ID || c.parentId === MADAMIS_CATEGORY_ID)
  ) as ForumChannel[];

  console.log(`📋 対象フォーラムチャンネル数: ${forumChannels.length}`);

  const token = client.token!;
  const rows: ScenarioRow[] = [];

  for (const forum of forumChannels) {
    const system = getScenarioSystem(forum.parentId);
    if (!system) continue;

    const threads = await getAllThreadsInForum(forum, token);
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
