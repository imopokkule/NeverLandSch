import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  TextChannel,
} from "discord.js";
import { createClient } from "@supabase/supabase-js";

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
  intents: [GatewayIntentBits.Guilds],
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

// categoryId → status（固定カテゴリの逆引き）
const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).filter(([, v]) => v).map(([k, v]) => [v, k])
);

// 月別カテゴリのパターン（例: 立卓済み〈5月〉）
const MONTHLY_CONFIRMED_PATTERN = /立卓済み[〈<].+月[〉>]/;

/**
 * カテゴリIDからステータスを解決する
 * 固定カテゴリ → 逆引きマップ
 * 月別カテゴリ → 名前パターンでマッチ
 */
function resolveStatus(parentId: string | null | undefined): string | null {
  if (!parentId) return null;

  // 固定カテゴリの逆引き
  if (REVERSE_MAP[parentId]) return REVERSE_MAP[parentId];

  // 月別カテゴリ（「立卓済み〈X月〉」）をキャッシュから名前で判定
  const category = client.channels.cache.get(parentId);
  if (category && "name" in category && typeof category.name === "string") {
    if (MONTHLY_CONFIRMED_PATTERN.test(category.name)) {
      console.log(`📅 月別カテゴリ検出: ${category.name} → confirmed`);
      return "confirmed";
    }
  }

  return null;
}

/* ===============================
   Bot Ready
=============================== */

client.once("clientReady", (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log("👂 Listening for Discord events (Discord → DB direction)");
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

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("discord_channel_id", channel.id);

    if (error) {
      console.error("❌ DB delete error:", error);
    } else {
      console.log("✅ Event removed from DB");
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
