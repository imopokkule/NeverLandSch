"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type UserEntry = {
  discord_id: string;
  user_name: string;
  value: number;
};

type CalEvent = {
  id: string;
  title: string;
  discord_channel_id: string | null;
  status: string;
};

const AVAIL_GROUPS = [
  { value: 3, symbol: "◎", label: "全日OK",  color: "#4ef0a0", bg: "#0a2818" },
  { value: 1, symbol: "〇", label: "昼のみ",  color: "#e8d040", bg: "#201e08" },
  { value: 2, symbol: "△", label: "夜のみ",  color: "#508cf0", bg: "#061220" },
];

const STATUS_COLORS: Record<string, string> = {
  recruiting:    "#4ecdc4",
  confirmed:     "#a8d8a8",
  closed_trpg:   "#9ec9b4",
  closed_murder: "#4a8c7a",
};

const STATUS_LABELS: Record<string, string> = {
  recruiting:    "募集中",
  confirmed:     "立卓済み",
  closed_trpg:   "〆済みTRPG",
  closed_murder: "〆済みマダミス",
};

function stripDatePrefix(title: string): string {
  return title.replace(/^\d{1,2}月\d{1,2}日\d{1,2}時(半)?(?:[〜～]?[：:]\s*|[〜～]\s*)?/, "").trim() || title;
}

export default function DateDetailPage() {
  const { date } = useParams() as { date: string };
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const month = date?.slice(0, 7) ?? "";
  const day = date ? String(parseInt(date.slice(8, 10))) : "";
  const dayNum = date ? parseInt(date.slice(8, 10)) : 0;
  const dateLabel = date
    ? `${parseInt(date.slice(0, 4))}年${parseInt(date.slice(5, 7))}月${parseInt(date.slice(8, 10))}日`
    : "";

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [y, mo, da] = date ? date.split("-").map(Number) : [0, 0, 0];
  const prevDate = date ? fmtDate(new Date(y, mo - 1, da - 1)) : "";
  const nextDate = date ? fmtDate(new Date(y, mo - 1, da + 1)) : "";

  useEffect(() => {
    if (!date || !month) return;

    const load = async () => {
      setLoading(true);

      // スケジュール取得（service role経由でRLSをバイパス）
      const schedRes = await fetch(`/api/schedules?month=${month}`);
      const schedData = await schedRes.json();

      const userNameMap = new Map<string, string>(
        (schedData.users ?? []).map((u: { discord_id: string; user_name: string }) => [u.discord_id, u.user_name])
      );

      const dayKey = String(dayNum);
      const available: UserEntry[] = [];

      for (const entry of schedData.monthData ?? []) {
        const value = entry.data?.[dayKey];
        if (value === 1 || value === 2 || value === 3) {
          available.push({
            discord_id: entry.discord_id,
            user_name: userNameMap.get(entry.discord_id) ?? entry.discord_id,
            value,
          });
        }
      }

      available.sort((a, b) => {
        if (a.value !== b.value) return b.value - a.value; // ◎ > 〇 > △
        return a.user_name.localeCompare(b.user_name, "ja");
      });

      setUsers(available);

      // その日のイベント取得
      const { data: evData } = await supabase
        .from("events")
        .select("id, title, discord_channel_id, status")
        .eq("event_date", date)
        .order("status");

      setEvents(evData ?? []);
      setLoading(false);
    };

    load();
  }, [date, month, dayNum]);

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-3 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <div className="flex items-center justify-between">
            <Link
              href="/calendar"
              className="text-xs tracking-widest hover:opacity-70 transition"
              style={{ color: "#9ec9b4", fontFamily: "'Cinzel', serif" }}
            >
              ← Calendar
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/calendar/${prevDate}`}
                className="px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-70 transition"
                style={{ color: "#4ecdc4", border: "1px solid #1e3d45", backgroundColor: "#112428" }}
              >
                ‹ 前日
              </Link>
              <Link
                href={`/calendar/${nextDate}`}
                className="px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-70 transition"
                style={{ color: "#4ecdc4", border: "1px solid #1e3d45", backgroundColor: "#112428" }}
              >
                翌日 ›
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            {dateLabel}
          </h1>
        </div>

        {loading ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>読み込み中...</p>
        ) : (
          <>
            {/* その日のセッション */}
            {events.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold tracking-widest" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>
                  Sessions — {events.length}件
                </h2>
                <div className="space-y-2">
                  {events.map((ev) => {
                    const color = STATUS_COLORS[ev.status] ?? "#9ec9b4";
                    const label = STATUS_LABELS[ev.status] ?? ev.status;
                    const href = ev.discord_channel_id ? `/event/${ev.discord_channel_id}` : null;
                    const inner = (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif" }}>
                          {stripDatePrefix(ev.title)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full ml-3 shrink-0" style={{ color, border: `1px solid ${color}` }}>
                          {label}
                        </span>
                      </div>
                    );
                    return href ? (
                      <Link
                        key={ev.id}
                        href={href}
                        className="block p-4 rounded-xl transition"
                        style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#1e3d45"}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div key={ev.id} className="p-4 rounded-xl" style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 参加可能メンバー */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold tracking-widest" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>
                Available Members — {users.length}人
              </h2>

              {users.length === 0 ? (
                <p className="text-center py-12" style={{ color: "#9ec9b4" }}>参加可能なメンバーがいません</p>
              ) : (
                AVAIL_GROUPS.map((group) => {
                  const grouped = users.filter((u) => u.value === group.value);
                  if (grouped.length === 0) return null;
                  return (
                    <div key={group.value} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{ color: group.color }}>{group.symbol}</span>
                        <span className="text-xs" style={{ color: group.color }}>{group.label}</span>
                        <span className="text-xs" style={{ color: "#4a7a6a" }}>（{grouped.length}人）</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {grouped.map((u) => (
                          <Link
                            key={u.discord_id}
                            href={`/schedule/${u.discord_id}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition"
                            style={{ backgroundColor: group.bg, border: `1px solid ${group.color}33` }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = group.color}
                            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = `${group.color}33`}
                          >
                            <span className="text-sm font-bold shrink-0" style={{ color: group.color }}>{group.symbol}</span>
                            <span className="text-sm truncate" style={{ color: "#e8f5f0" }}>{u.user_name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
