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

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   Discord Client
=============================== */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* ===============================
   カテゴリマップ
=============================== */

const CATEGORY_MAP: Record<string, string | undefined> = {
  recruiting: CATEGORY_RECRUITING,
  confirmed: CATEGORY_CONFIRMED,
  closed_trpg: CATEGORY_CLOSED_TRPG,
  closed_murder: CATEGORY_CLOSED_MURDER,
};

/* ===============================
   Bot Ready
=============================== */

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID);

  console.log("🚀 Realtime listener started");

  /* ===============================
     INSERT → チャンネル作成
  =============================== */

  supabase
    .channel("events-insert")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "events" },
      async (payload) => {
        try {
          const event = payload.new;

          console.log("🆕 Event inserted:", event.title);

          const categoryId = CATEGORY_MAP[event.status];
          if (!categoryId) {
            console.log("⚠ カテゴリ未設定");
            return;
          }

          const channel = await guild.channels.create({
            name: event.title,
            type: ChannelType.GuildText,
            parent: categoryId,
          });

          await supabase
            .from("events")
            .update({ discord_channel_id: channel.id })
            .eq("id", event.id);

          console.log("✅ Channel created:", channel.name);
        } catch (err) {
          console.error("❌ INSERT error:", err);
        }
      }
    )
    .subscribe();

  /* ===============================
     UPDATE → 名前変更＋カテゴリ移動
  =============================== */

  supabase
    .channel("events-update")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "events" },
      async (payload) => {
        try {
          const event = payload.new;

          if (!event.discord_channel_id) return;

          const channel = await guild.channels.fetch(
            event.discord_channel_id
          );

          if (!channel) return;
          if (channel.type !== ChannelType.GuildText) return;

          const textChannel = channel as TextChannel;

          console.log("✏ Updating channel:", event.title);

          // 名前変更
          await textChannel.setName(event.title);

          // カテゴリ移動
          const categoryId = CATEGORY_MAP[event.status];
          if (categoryId) {
            await textChannel.edit({
              parent: categoryId,
            });
          }

          console.log("✅ Channel updated");
        } catch (err) {
          console.error("❌ UPDATE error:", err);
        }
      }
    )
    .subscribe();

  /* ===============================
     DELETE (DB側) → Discord削除
  =============================== */

  supabase
    .channel("events-delete")
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "events" },
      async (payload) => {
        try {
          const event = payload.old;

          if (!event.discord_channel_id) return;

          const channel = await guild.channels.fetch(
            event.discord_channel_id
          );

          if (!channel) return;

          await channel.delete();

          console.log("🗑 Channel deleted from Discord");
        } catch (err) {
          console.error("❌ DELETE error:", err);
        }
      }
    )
    .subscribe();
});

/* ===============================
   Discord削除 → DB削除
=============================== */

client.on("channelDelete", async (channel) => {
  try {
    if (channel.type !== ChannelType.GuildText) return;

    console.log("🗑 Discord channel deleted:", channel.id);

    await supabase
      .from("events")
      .delete()
      .eq("discord_channel_id", channel.id);

    console.log("✅ DB event deleted");
  } catch (err) {
    console.error("❌ channelDelete error:", err);
  }
});

/* ===============================
   Login
=============================== */

client.login(DISCORD_BOT_TOKEN);