import { NextResponse } from "next/server";

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

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  // ギルドの全チャンネルを取得
  const channelsRes = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/channels`,
    token
  );
  if (!channelsRes || !channelsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
  const allChannels: { id: string; name: string; type: number; parent_id: string | null }[] =
    await channelsRes.json();

  // カテゴリIDでフォーラム（type 15）またはメディア（type 16）チャンネルを絞り込み
  const trpgChannels = allChannels
    .filter((c) => c.parent_id === TRPG_CATEGORY_ID && (c.type === 15 || c.type === 16))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const madamisChannels = allChannels
    .filter((c) => c.parent_id === MADAMIS_CATEGORY_ID && (c.type === 15 || c.type === 16))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const allForumChannels = [...trpgChannels, ...madamisChannels];
  const forumIdSet = new Set(allForumChannels.map((c) => c.id));

  // ギルド全体のアクティブスレッドを取得
  const activeRes = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
    token
  );
  const { threads: activeThreads = [] }: { threads: { id: string; name: string; parent_id: string }[] } =
    activeRes?.ok ? await activeRes.json() : { threads: [] };

  // フォーラムチャンネルごとにスレッドをグルーピング（重複排除のためMapを使用）
  const threadsByChannel = new Map<string, Map<string, string>>();
  for (const t of activeThreads) {
    if (forumIdSet.has(t.parent_id)) {
      if (!threadsByChannel.has(t.parent_id)) threadsByChannel.set(t.parent_id, new Map());
      threadsByChannel.get(t.parent_id)!.set(t.id, t.name);
    }
  }

  // 各フォーラムチャンネルのアーカイブスレッドを取得（public + private）
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
  });
}
