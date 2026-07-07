import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TRPG_CATEGORY_ID = "1425644276200767588";
const MADAMIS_CATEGORY_ID = "1425644252179730532";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function discordFetch(url: string, token: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const wait = ((data.retry_after ?? 1) as number) * 1000;
      await sleep(wait);
      continue;
    }
    return res;
  }
  return null;
}

async function fetchArchivedThreads(channelId: string, token: string, type: "public" | "private") {
  const threads: { id: string; name: string }[] = [];
  let before: string | undefined;

  for (let page = 0; page < 50; page++) {
    const url = new URL(
      `https://discord.com/api/v10/channels/${channelId}/threads/archived/${type}`
    );
    url.searchParams.set("limit", "100");
    if (before) url.searchParams.set("before", before);

    const res = await discordFetch(url.toString(), token);
    if (!res || !res.ok) break;

    const data = await res.json();
    const batch: { id: string; name: string; thread_metadata?: { archive_timestamp?: string } }[] =
      data.threads ?? [];

    for (const t of batch) {
      threads.push({ id: t.id, name: t.name });
    }

    if (!data.has_more || batch.length === 0) break;
    before = batch[batch.length - 1].thread_metadata?.archive_timestamp;
    if (!before) break;
  }

  return threads;
}

type DbRow = {
  thread_id: string;
  thread_name: string;
  channel_id: string;
  channel_name: string;
  system: string;
};

type UserChannel = { id: string; name: string; scenarios: { id: string; name: string }[] };

function buildFromDbRows(rows: DbRow[], system: string): UserChannel[] {
  const channelMap = new Map<string, UserChannel>();

  for (const row of rows) {
    if (row.system !== system) continue;
    if (!channelMap.has(row.channel_id)) {
      channelMap.set(row.channel_id, {
        id: row.channel_id,
        name: row.channel_name,
        scenarios: [],
      });
    }
    channelMap.get(row.channel_id)!.scenarios.push({
      id: row.thread_id,
      name: row.thread_name,
    });
  }

  return [...channelMap.values()]
    .map((u) => ({
      ...u,
      scenarios: u.scenarios.sort((a, b) => a.name.localeCompare(b.name, "ja")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  // Supabaseキャッシュを優先して読み込む
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from("scenarios")
        .select("thread_id, thread_name, channel_id, channel_name, system")
        .order("thread_name", { ascending: true });

      if (!error && data && data.length > 0) {
        return NextResponse.json({
          trpg: buildFromDbRows(data, "trpg"),
          madamis: buildFromDbRows(data, "madamis"),
          cached: true,
        });
      }
    } catch {
      // Supabase取得失敗時はDiscord APIにフォールバック
    }
  }

  // Supabaseにデータなし → Discord APIから直接取得（初回のみ/フォールバック）
  const channelsRes = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/channels`,
    token
  );
  if (!channelsRes || !channelsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
  const allChannels: { id: string; name: string; type: number; parent_id: string | null }[] =
    await channelsRes.json();

  const trpgChannels = allChannels
    .filter((c) => c.parent_id === TRPG_CATEGORY_ID && (c.type === 15 || c.type === 16))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const madamisChannels = allChannels
    .filter((c) => c.parent_id === MADAMIS_CATEGORY_ID && (c.type === 15 || c.type === 16))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const allForumChannels = [...trpgChannels, ...madamisChannels];
  const forumIdSet = new Set(allForumChannels.map((c) => c.id));

  const activeRes = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
    token
  );
  const { threads: activeThreads = [] }: { threads: { id: string; name: string; parent_id: string }[] } =
    activeRes?.ok ? await activeRes.json() : { threads: [] };

  const threadsByChannel = new Map<string, Map<string, string>>();
  for (const t of activeThreads) {
    if (forumIdSet.has(t.parent_id)) {
      if (!threadsByChannel.has(t.parent_id)) threadsByChannel.set(t.parent_id, new Map());
      threadsByChannel.get(t.parent_id)!.set(t.id, t.name);
    }
  }

  for (const ch of allForumChannels) {
    if (!threadsByChannel.has(ch.id)) threadsByChannel.set(ch.id, new Map());
    const map = threadsByChannel.get(ch.id)!;

    const [pub, priv] = await Promise.all([
      fetchArchivedThreads(ch.id, token, "public"),
      fetchArchivedThreads(ch.id, token, "private"),
    ]);

    for (const t of [...pub, ...priv]) {
      if (!map.has(t.id)) map.set(t.id, t.name);
    }
  }

  const buildResult = (channels: typeof trpgChannels) =>
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      scenarios: Array.from(threadsByChannel.get(c.id)?.entries() ?? [])
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    }));

  return NextResponse.json({
    trpg: buildResult(trpgChannels),
    madamis: buildResult(madamisChannels),
    cached: false,
  });
}
