"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type CalEvent = {
  id: string;
  title: string;
  discord_channel_id: string | null;
  event_date: string;
  status: string;
};

type Tooltip = {
  date: string;
  events: CalEvent[];
  x: number;
  y: number;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const STATUS_COLORS: Record<string, string> = {
  recruiting:    "#4ecdc4",
  confirmed:     "#a8d8a8",
  closed_trpg:   "#9ec9b4",
  closed_murder: "#4a8c7a",
};

function stripDatePrefix(title: string): string {
  return title.replace(/^\d{1,2}月\d{1,2}日\d{1,2}時(半)?(?:[〜～]?[：:]\s*|[〜～]\s*)?/, "").trim() || title;
}

export default function CalendarPage() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const { data } = await supabase
        .from("events")
        .select("id, title, discord_channel_id, event_date, status")
        .gte("event_date", `${month}-01`)
        .lte("event_date", `${month}-${String(lastDay).padStart(2, "0")}`)
        .order("event_date");
      setEvents(data ?? []);
      setLoading(false);
    };
    load();
  }, [month]);

  const [y, m] = month.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const eventsMap = new Map<string, CalEvent[]>();
  for (const ev of events) {
    if (!ev.event_date) continue;
    if (!eventsMap.has(ev.event_date)) eventsMap.set(ev.event_date, []);
    eventsMap.get(ev.event_date)!.push(ev);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const showTooltip = (date: string, evs: CalEvent[], el: HTMLElement) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (evs.length === 0) { setTooltip(null); return; }
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 230);
    const y = rect.bottom + 6;
    setTooltip({ date, events: evs, x, y });
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setTooltip(null), 120);
  };

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  return (
    <main className="min-h-screen p-6 md:p-10" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-1 border-b pb-5" style={{ borderColor: "#1e3d45" }}>
          <h1 className="text-4xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            Calendar
          </h1>
          <p className="text-sm" style={{ color: "#9ec9b4" }}>
            日付をクリックするとその日の参加可能メンバー一覧を表示します。
          </p>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4 rounded-xl" style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}>
          <button onClick={() => shiftMonth(-1)} className="text-xl font-bold px-2 hover:opacity-70 transition" style={{ color: "#4ecdc4" }}>‹</button>
          <div className="text-center" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "900" }}>{month.slice(0, 4)}</span>
            <span style={{ fontSize: "1.1rem", margin: "0 0.4em", color: "#9ec9b4" }}>/</span>
            <span style={{ fontSize: "1.7rem", fontWeight: "900" }}>{month.slice(5, 7)}</span>
          </div>
          <button onClick={() => shiftMonth(1)} className="text-xl font-bold px-2 hover:opacity-70 transition" style={{ color: "#4ecdc4" }}>›</button>
        </div>

        {/* Calendar */}
        <div className="rounded-xl" style={{ border: "1px solid #1e3d45", overflow: "hidden" }}>
          {/* Weekday header */}
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className="py-2 text-center text-xs font-bold tracking-widest"
                style={{
                  backgroundColor: "#0d1e22",
                  color: i === 0 ? "#e07070" : i === 6 ? "#7099e0" : "#9ec9b4",
                  borderBottom: "1px solid #1e3d45",
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const col = idx % 7;
              const borderRight = col < 6 ? "1px solid #1e3d45" : "none";
              const borderBottom = "1px solid #1e3d45";

              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{ backgroundColor: "#0a1418", borderRight, borderBottom, minHeight: "72px" }}
                  />
                );
              }

              const dow = col;
              const dateStr = `${month}-${String(day).padStart(2, "0")}`;
              const dayEvents = eventsMap.get(dateStr) ?? [];
              const isToday = dateStr === today;

              return (
                <div
                  key={dateStr}
                  className="cursor-pointer transition-colors"
                  style={{ backgroundColor: "#112428", borderRight, borderBottom, minHeight: "72px", padding: "6px 8px", position: "relative" }}
                  onClick={() => router.push(`/calendar/${dateStr}`)}
                  onMouseEnter={(e) => showTooltip(dateStr, dayEvents, e.currentTarget)}
                  onMouseLeave={scheduleHide}
                >
                  {/* Day number */}
                  <div className="mb-1">
                    <span
                      className="text-sm font-bold"
                      style={isToday ? {
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "22px", height: "22px", borderRadius: "50%",
                        backgroundColor: "#4ecdc4", color: "#0a1a1e", fontSize: "12px",
                      } : {
                        color: dow === 0 ? "#e07070" : dow === 6 ? "#7099e0" : "#9ec9b4",
                        fontSize: "13px",
                      }}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Event chips */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const color = STATUS_COLORS[ev.status] ?? "#9ec9b4";
                      return (
                        <div
                          key={ev.id}
                          className="truncate rounded px-1"
                          style={{ backgroundColor: color + "28", color, fontSize: "10px", lineHeight: "16px" }}
                        >
                          {stripDatePrefix(ev.title)}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div style={{ color: "#4a7a6a", fontSize: "10px" }}>+{dayEvents.length - 2}件</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 flex-wrap">
          {(["recruiting", "confirmed", "closed_trpg", "closed_murder"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
              <span className="text-xs" style={{ color: "#9ec9b4" }}>
                {{ recruiting: "募集中", confirmed: "立卓済み", closed_trpg: "〆済みTRPG", closed_murder: "〆済みマダミス" }[key]}
              </span>
            </div>
          ))}
        </div>

        {loading && <p className="text-center py-4" style={{ color: "#9ec9b4" }}>読み込み中...</p>}
      </div>

      {/* Tooltip (fixed position, outside grid overflow) */}
      {tooltip && (
        <div
          className="rounded-xl shadow-xl"
          style={{
            position: "fixed",
            top: tooltip.y,
            left: tooltip.x,
            zIndex: 9999,
            backgroundColor: "#0d2a30",
            border: "1px solid #4ecdc4",
            minWidth: "220px",
            maxWidth: "300px",
            padding: "12px",
            pointerEvents: "auto",
          }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <div className="text-xs font-bold mb-2" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>
            {parseInt(tooltip.date.slice(5, 7))}月{parseInt(tooltip.date.slice(8, 10))}日のセッション
          </div>
          <div className="space-y-1">
            {tooltip.events.map((ev) => {
              const color = STATUS_COLORS[ev.status] ?? "#9ec9b4";
              const href = ev.discord_channel_id ? `/event/${ev.discord_channel_id}` : null;
              return href ? (
                <Link
                  key={ev.id}
                  href={href}
                  className="block text-xs hover:opacity-70 transition leading-5"
                  style={{ color }}
                >
                  {stripDatePrefix(ev.title)}
                </Link>
              ) : (
                <div key={ev.id} className="text-xs leading-5" style={{ color }}>
                  {stripDatePrefix(ev.title)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
