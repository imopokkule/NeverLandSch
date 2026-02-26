"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type Event = {
  id: string;
  title: string;
  status: string;
  discord_channel_id: string;
  creator_name: string | null;
  creator_image: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  recruiting: "募集中",
  confirmed: "立卓済み",
  closed_trpg: "〆済みTRPG",
  closed_murder: "〆済みマダミス",
};

const STATUS_COLORS: Record<string, string> = {
  recruiting: "#4ecdc4",
  confirmed: "#a8d8a8",
  closed_trpg: "#9ec9b4",
  closed_murder: "#4a8c7a",
};

export default function EventPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      setEvents(data || []);
    };
    fetchEvents();
  }, []);

  const filtered = filter === "all" ? events : events.filter((ev) => ev.status === filter);

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            Events
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            開催予定・募集中のイベント一覧です。イベントをクリックすると詳細を確認できます。
          </p>
        </div>

        {/* フィルター */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 rounded text-sm"
          style={{
            backgroundColor: "#112428",
            border: "1px solid #1e3d45",
            color: "#e8f5f0",
            fontFamily: "'Cinzel', serif",
          }}
        >
          <option value="all">すべて</option>
          <option value="recruiting">募集中</option>
          <option value="confirmed">立卓済み</option>
          <option value="closed_trpg">〆済みTRPG</option>
          <option value="closed_murder">〆済みマダミス</option>
        </select>

        {/* 一覧 */}
        <div className="space-y-3">
          {filtered.map((ev) => (
            <Link
              key={ev.id}
              href={`/event/${ev.discord_channel_id}`}
              className="block p-5 rounded-xl transition"
              style={{
                backgroundColor: "#112428",
                border: "1px solid #1e3d45",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#1e3d45"}
            >
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif" }}
                  >
                    {ev.title}
                  </h2>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      color: STATUS_COLORS[ev.status] || "#9ec9b4",
                      border: `1px solid ${STATUS_COLORS[ev.status] || "#9ec9b4"}`,
                    }}
                  >
                    {STATUS_LABELS[ev.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ev.creator_image && (
                    <img src={ev.creator_image} alt="creator" className="w-8 h-8 rounded-full" style={{ border: "1px solid #1e3d45" }} />
                  )}
                  <span className="text-sm" style={{ color: "#9ec9b4" }}>{ev.creator_name}</span>
                </div>
              </div>
            </Link>
          ))}

          {filtered.length === 0 && (
            <p className="text-center py-12" style={{ color: "#9ec9b4" }}>イベントがありません</p>
          )}
        </div>
      </div>
    </main>
  );
}
