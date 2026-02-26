"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Event = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  event_time: string | null;
  discord_channel_id: string | null;
};

const STATUS_OPTIONS = [
  { value: "recruiting", label: "募集中" },
  { value: "confirmed", label: "立卓済み" },
  { value: "closed_trpg", label: "〆済みTRPG" },
  { value: "closed_murder", label: "〆済みマダミス" },
];

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  /* ===============================
     データ取得
  =============================== */
  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("discord_channel_id", channelId)
        .single();

      if (!error) setEvent(data);
      setLoading(false);
    };

    fetchEvent();
  }, [channelId]);

  /* ===============================
     保存処理
  =============================== */
  const updateEvent = async () => {
    if (!event) return;

    const { error } = await supabase
      .from("events")
      .update({
        title: event.title,
        status: event.status,
        event_date: event.event_date,
        event_time: event.event_time,
      })
      .eq("id", event.id);

    if (error) {
      alert("更新失敗");
    } else {
      alert("更新成功");
    }
  };

  /* ===============================
     削除処理
  =============================== */
  const deleteEvent = async () => {
    if (!event) return;

    const confirmDelete = confirm("本当に削除しますか？");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id);

    if (error) {
      alert("削除失敗");
    } else {
      alert("削除しました");
      router.push("/event");
    }
  };

  if (loading)
    return (
      <div className="p-10 text-white bg-[#2b2d31]">
        Loading...
      </div>
    );

  if (!event)
    return (
      <div className="p-10 text-white bg-[#2b2d31]">
        Not Found
      </div>
    );

  return (
    <main className="min-h-screen bg-[#2b2d31] text-white p-10">
      <div className="max-w-3xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold">
          イベント編集
        </h1>

        {/* タイトル */}
        <div>
          <label className="block mb-1">タイトル</label>
          <input
            value={event.title ?? ""}
            onChange={(e) =>
              setEvent({ ...event, title: e.target.value })
            }
            className="w-full bg-[#1e1f22] p-2 rounded"
          />
        </div>

        {/* 日付 */}
        <div>
          <label className="block mb-1">日付</label>
          <input
            type="date"
            value={event.event_date ?? ""}
            onChange={(e) =>
              setEvent({
                ...event,
                event_date: e.target.value,
              })
            }
            className="w-full bg-[#1e1f22] p-2 rounded"
          />
        </div>

        {/* 時間（00 / 30のみ） */}
        <div>
          <label className="block mb-1">時間</label>

          <div className="flex gap-2">
            <select
              value={event.event_time?.split(":")[0] ?? "18"}
              onChange={(e) =>
                setEvent({
                  ...event,
                  event_time: `${e.target.value}:${
                    event.event_time?.split(":")[1] ?? "00"
                  }`,
                })
              }
              className="bg-[#1e1f22] p-2 rounded"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option
                  key={h}
                  value={h.toString().padStart(2, "0")}
                >
                  {h.toString().padStart(2, "0")}時
                </option>
              ))}
            </select>

            <select
              value={event.event_time?.split(":")[1] ?? "00"}
              onChange={(e) =>
                setEvent({
                  ...event,
                  event_time: `${
                    event.event_time?.split(":")[0] ?? "18"
                  }:${e.target.value}`,
                })
              }
              className="bg-[#1e1f22] p-2 rounded"
            >
              <option value="00">00分</option>
              <option value="30">30分</option>
            </select>
          </div>
        </div>

        {/* ステータス */}
        <div>
          <label className="block mb-1">ステータス</label>
          <select
            value={event.status}
            onChange={(e) =>
              setEvent({
                ...event,
                status: e.target.value,
              })
            }
            className="w-full bg-[#1e1f22] p-2 rounded"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 保存ボタン */}
        <button
          onClick={updateEvent}
          className="bg-[#5865F2] px-6 py-2 rounded hover:bg-[#4752c4]"
        >
          保存
        </button>

        {/* 削除ボタン */}
        <button
          onClick={deleteEvent}
          className="bg-[#f23f42] px-6 py-2 rounded hover:bg-[#d13235] mt-4"
        >
          削除
        </button>

      </div>
    </main>
  );
}