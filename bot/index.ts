import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  TextChannel,
  ForumChannel,
} from "discord.js";
import { createClient } from "@supabase/supabase-js";
import {
  syncAllForumsToSupabase,
  getScenarioSystem,
} from "./forumSync.js";

/* ===============================
   環境変数
=============================== */

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CATEGORY_RECRUITING,
  CATEGORY_CONFIRMED,
  CATEGORY_CLOSED_TRPG,
  CATEGORY_CLOSED_MURDER,
} = process.env;

if (
  !DISCORD_BOT_TOKEN ||
  !DISCORD_GUILD_ID ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("❌ 環境変数不足");
}

/* ===============================
   Supabase
=============================== */

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ===============================
   Discord Client
=============================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ===============================
   カテゴリ ↔ ステータス マップ
=============================== */

const CATEGORY_MAP: Record<string, string> = {
  recruiting:    CATEGORY_RECRUITING    ?? "",
  confirmed:     CATEGORY_CONFIRMED     ?? "",
  closed_trpg:   CATEGORY_CLOSED_TRPG   ?? "",
  closed_murder: CATEGORY_CLOSED_MURDER ?? "",
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).filter(([, v]) => v).map(([k, v]) => [v, k])
);

const MONTHLY_CONFIRMED_PATTERN = /立卓済み[〈<].+月[〉>]/;

function resolveStatus(parentId: string | null | undefined): string | null {
  if (!parentId) return null;

  if (REVERSE_MAP[parentId]) return REVERSE_MAP[parentId];

  const category = client.channels.cache.get(parentId);
  if (category && "name" in category && typeof category.name === "string") {
    if (MONTHLY_CONFIRMED_PATTERN.test(category.name)) {
      console.log(`📅 月別カテゴリ検出: ${category.name}`);
      return category.name;
    }
  }

  return null;
}

/* ===============================
   Bot Ready
=============================== */

client.once("clientReady", async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log("👂 Listening for Discord events (Discord → DB direction)");

  // 起動時にシナリオ全件同期
  try {
    await syncAllForumsToSupabase(client, supabase);
  } catch (err) {
    console.error("❌ 起動時シナリオ同期エラー:", err);
  }
});

/* ===============================
   フォーラムスレッド作成 → シナリオDB追加
=============================== */

client.on("threadCreate", async (thread) => {
  try {
    if (!thread.parentId) return;

    const parentChannel = await client.channels
      .fetch(thread.parentId)
      .catch(() => null);

    if (!parentChannel || parentChannel.type !== ChannelType.GuildForum) return;

    const forum = parentChannel as ForumChannel;
    const system = getScenarioSystem(forum.parentId);
    if (!system) return;

    console.log(`📝 新シナリオ検出: "${thread.name}" in ${forum.name} (${system})`);

    const { error } = await supabase.from("scenarios").upsert(
      {
        thread_id: thread.id,
        thread_name: thread.name,
        channel_id: forum.id,
        channel_name: forum.name,
        system,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "thread_id" }
    );

    if (error) console.error("❌ シナリオ追加エラー:", error);
    else console.log(`✅ シナリオ追加: "${thread.name}"`);
  } catch (err) {
    console.error("❌ threadCreate error:", err);
  }
});

/* ===============================
   フォーラムスレッド削除 → シナリオDB削除
=============================== */

client.on("threadDelete", async (thread) => {
  try {
    const { error } = await supabase
      .from("scenarios")
      .delete()
      .eq("thread_id", thread.id);

    if (error) console.error("❌ シナリオ削除エラー:", error);
    else console.log(`✅ シナリオ削除: ${thread.id}`);
  } catch (err) {
    console.error("❌ threadDelete error:", err);
  }
});

/* ===============================
   フォーラムスレッド更新（名前変更）→ シナリオDB更新
=============================== */

client.on("threadUpdate", async (oldThread, newThread) => {
  try {
    if (oldThread.name === newThread.name) return;

    const { error } = await supabase
      .from("scenarios")
      .update({ thread_name: newThread.name, synced_at: new Date().toISOString() })
      .eq("thread_id", newThread.id);

    if (error) console.error("❌ シナリオ更新エラー:", error);
    else console.log(`✅ シナリオ名更新: "${oldThread.name}" → "${newThread.name}"`);
  } catch (err) {
    console.error("❌ threadUpdate error:", err);
  }
});

/* ===============================
   Discord チャンネル作成 → DB にイベント追加
=============================== */

client.on("channelCreate", async (channel) => {
  try {
    if (channel.type !== ChannelType.GuildText) return;
    if (channel.guildId !== DISCORD_GUILD_ID) return;

    const textChannel = channel as TextChannel;
    const status = resolveStatus(textChannel.parentId);

    if (!status) {
      console.log("⚠ 管理外カテゴリへの作成（無視）:", textChannel.parentId);
      return;
    }

    console.log(`📢 Discord channel created: ${channel.id} (${textChannel.name}) → status: ${status}`);

    const { error } = await supabase.from("events").insert({
      title: textChannel.name,
      status,
      discord_channel_id: channel.id,
    });

    if (error) {
      console.error("❌ DB insert error:", error);
    } else {
      console.log(`✅ Event added to DB: ${textChannel.name}`);
    }
  } catch (err) {
    console.error("❌ channelCreate error:", err);
  }
});

/* ===============================
   Discord チャンネル削除 → DB のイベント削除
=============================== */

client.on("channelDelete", async (channel) => {
  try {
    if (channel.type !== ChannelType.GuildText) return;

    console.log("🗑 Discord channel deleted:", channel.id);

    const { data: ev } = await supabase
      .from("events")
      .select("status")
      .eq("discord_channel_id", channel.id)
      .maybeSingle();

    if (!ev) {
      console.log("⚠ DB にイベントなし（無視）");
      return;
    }

    if (ev.status?.startsWith("closed_")) {
      const { error } = await supabase
        .from("events")
        .update({ discord_channel_id: null })
        .eq("discord_channel_id", channel.id);
      if (error) console.error("❌ DB archive error:", error);
      else console.log("📦 Closed event archived in DB");
    } else {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("discord_channel_id", channel.id);
      if (error) console.error("❌ DB delete error:", error);
      else console.log("✅ Event removed from DB");
    }
  } catch (err) {
    console.error("❌ channelDelete error:", err);
  }
});

/* ===============================
   Discord カテゴリ移動 → DB のステータス更新
=============================== */

client.on("channelUpdate", async (oldChannel, newChannel) => {
  try {
    if (newChannel.type !== ChannelType.GuildText) return;

    const oldText = oldChannel as Partial<TextChannel>;
    const newText = newChannel as TextChannel;

    if (oldText.parentId === newText.parentId) return;

    const newStatus = resolveStatus(newText.parentId);
    if (!newStatus) {
      console.log("⚠ 管理外カテゴリへの移動（無視）:", newText.parentId);
      return;
    }

    console.log(`📂 Channel moved: ${newChannel.id} → status: ${newStatus}`);

    const { error } = await supabase
      .from("events")
      .update({ status: newStatus })
      .eq("discord_channel_id", newChannel.id);

    if (error) {
      console.error("❌ DB status update error:", error);
    } else {
      console.log(`✅ Event status updated to "${newStatus}"`);
    }
  } catch (err) {
    console.error("❌ channelUpdate error:", err);
  }
});

/* ===============================
   Login
=============================== */

client.login(DISCORD_BOT_TOKEN);
