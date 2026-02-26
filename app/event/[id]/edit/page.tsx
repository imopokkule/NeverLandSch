"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function EventEditPage() {
  const params = useParams();
  const router = useRouter();
  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : undefined;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("20");
  const [minute, setMinute] = useState("00");
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchEvent = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setTitle(data.title);
        setDate(data.event_date);
        setChannelId(data.discord_channel_id);

        if (data.event_time) {
          const [h, m] = data.event_time.split(":");
          setHour(h);
          setMinute(m);
        }
      }
    };

    fetchEvent();
  }, [id]);

  const handleSave = async () => {
    if (!title || !date) {
      alert("全て入力してください");
      return;
    }

    const time = `${hour}:${minute}`;
    setSaving(true);

    // DB更新
    const { error } = await supabase
      .from("events")
      .update({
        title,
        event_date: date,
        event_time: time,
      })
      .eq("id", id);

    if (error) {
      alert("更新失敗");
      setSaving(false);
      return;
    }

    // 月日を日本語形式に変換
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();

    const newChannelName =
      `${month}月${day}日${hour}時～${title}`;

    // Discordチャンネル名変更
    await fetch("/api/discord/rename-channel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId,
        newName: newChannelName,
      }),
    });

    setSaving(false);
    router.push(`/event/${id}`);
  };

  return (
    <main className="min-h-screen bg-white text-black p-10">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">イベント編集</h1>

        <input
          className="w-full border p-3 rounded-xl"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
        />

        <input
          type="date"
          className="w-full border p-3 rounded-xl"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* 時間選択（30分単位） */}
        <div className="flex gap-4">
          <select
            className="border p-3 rounded-xl"
            value={hour}
            onChange={(e) => setHour(e.target.value)}
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <option key={i} value={i.toString().padStart(2, "0")}>
                {i.toString().padStart(2, "0")}
              </option>
            ))}
          </select>

          <select
            className="border p-3 rounded-xl"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          >
            <option value="00">00</option>
            <option value="30">30</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-black text-white p-3 rounded-xl"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </main>
  );
}
