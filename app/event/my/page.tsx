"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { supabase } from "@/app/lib/supabase";

type Event = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  event_time: string | null;
  discord_channel_id: string;
  creator_id: string | null;
  creator_name: string | null;
  creator_image: string | null;
  participants: { discord_id: string; user_name: string }[] | null;
};

const FIXED_STATUS_LABELS: Record<string, string> = {
  recruiting: "募集中",
  confirmed: "立卓済み",
  closed_trpg: "〆済みTRPG",
  closed_murder: "〆済みマダミス",
};

const FIXED_STATUS_COLORS: Record<string, string> = {
  recruiting: "#4ecdc4",
  confirmed: "#a8d8a8",
  closed_trpg: "#9ec9b4",
  closed_murder: "#4a8c7a",
};

const getStatusLabel = (s: string) => FIXED_STATUS_LABELS[s] ?? s;
const getStatusColor = (s: string) => FIXED_STATUS_COLORS[s] ?? "#a8d8a8";

type FilterType = "all" | "joined" | "created";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all",     label: "すべて" },
  { value: "joined",  label: "参加中" },
  { value: "created", label: "作成済み" },
];

export default function MySessionsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const fetchMyEvents = async () => {
      const [{ data: created }, { data: joined }] = await Promise.all([
        supabase.from("events").select("*").eq("creator_id", userId),
        supabase.from("events").select("*").contains("participants", [{ discord_id: userId }]),
      ]);

      // 重複を除いてマージ・日付順に並べ替え
      const all = [...(created || []), ...(joined || [])];
      const unique = Array.from(new Map(all.map(e => [e.id, e])).values());
      unique.sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));

      setEvents(unique);
      setLoading(false);
    };

    fetchMyEvents();
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e", color: "#9ec9b4" }}>
        ログインしてください
      </div>
    );
  }

  const userId = session.user?.id;

  const filtered = events.filter((ev) => {
    if (filter === "created") return ev.creator_id === userId;
    if (filter === "joined")  return ev.participants?.some(p => p.discord_id === userId);
    return true;
  });

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            My Sessions
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            あなたに関連するセッション一覧です。
          </p>
        </div>

        {/* フィルター */}
        <div className="flex gap-2">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="px-4 py-2 rounded-full text-sm tracking-widest transition"
              style={{
                fontFamily: "'Cinzel', serif",
                backgroundColor: filter === value ? "#4ecdc4" : "#112428",
                color: filter === value ? "#0b1a14" : "#9ec9b4",
                border: `1px solid ${filter === value ? "#4ecdc4" : "#1e3d45"}`,
                fontWeight: filter === value ? "700" : "400",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: "#4ecdc4" }}>Loading...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ev) => (
              <Link
                key={ev.id}
                href={`/event/${ev.discord_channel_id}`}
                className="block p-5 rounded-xl transition"
                style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
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
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          color: getStatusColor(ev.status),
                          border: `1px solid ${getStatusColor(ev.status)}`,
                        }}
                      >
                        {getStatusLabel(ev.status)}
                      </span>
                      {ev.event_date && (
                        <span className="text-xs" style={{ color: "#9ec9b4" }}>
                          {ev.event_date}{ev.event_time ? ` ${ev.event_time}` : ""}
                        </span>
                      )}
                      {ev.creator_id === userId && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "#4ecdc4", border: "1px solid #4ecdc4" }}>
                          作成者
                        </span>
                      )}
                    </div>
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
              <p className="text-center py-12" style={{ color: "#9ec9b4" }}>該当するセッションがありません</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
