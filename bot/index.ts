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

// status → categoryId（DB→Discord 方向は Web App の API ルートが担当）
const CATEGORY_MAP: Record<string, string> = {
  recruiting:    CATEGORY_RECRUITING    ?? "",
  confirmed:     CATEGORY_CONFIRMED     ?? "",
  closed_trpg:   CATEGORY_CLOSED_TRPG   ?? "",
  closed_murder: CATEGORY_CLOSED_MURDER ?? "",
};

// categoryId → status（Discord→DB 方向の逆引き）
const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).filter(([, v]) => v).map(([k, v]) => [v, k])
);

/* ===============================
   Bot Ready
=============================== */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  console.log("👂 Listening for Discord events (Discord → DB direction)");
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

    // カテゴリが変わっていない場合はスキップ
    if (oldText.parentId === newText.parentId) return;

    const newStatus = REVERSE_MAP[newText.parentId ?? ""];
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
