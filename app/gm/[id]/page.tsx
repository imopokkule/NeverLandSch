"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type Event = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  event_time: string | null;
  discord_channel_id: string | null;
  gm_name: string | null;
  creator_name: string | null;
  creator_image: string | null;
  month: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  recruiting:    "募集中",
  confirmed:     "立卓済み",
  closed_trpg:   "〆済みTRPG",
  closed_murder: "〆済みマダミス",
};
const STATUS_COLORS: Record<string, string> = {
  recruiting:    "#4ecdc4",
  confirmed:     "#a8d8a8",
  closed_trpg:   "#9ec9b4",
  closed_murder: "#4a8c7a",
};

function stripDatePrefix(title: string): string {
  const stripped = title.replace(/^\d{1,2}月\d{1,2}日\d{1,2}時(半)?(?:[〜～]?[：:]\s*|[〜～]\s*)?/, "").trim();
  return stripped || title;
}

function EventCard({ ev }: { ev: Event }) {
  const color = STATUS_COLORS[ev.status] ?? "#9ec9b4";
  const label = STATUS_LABELS[ev.status] ?? ev.status;
  const href = ev.discord_channel_id ? `/event/${ev.discord_channel_id}` : "#";

  return (
    <Link
      href={href}
      className="block p-5 rounded-xl transition"
      style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#1e3d45"}
    >
      <div className="space-y-1">
        {ev.event_date ? (
          <div className="text-xs font-mono" style={{ color: "#4ecdc4" }}>
            {ev.event_date.replace(/^(\d+)-(\d+)-(\d+)$/, "$2/$3")}
            {ev.event_time && <span style={{ color: "#9ec9b4" }}> {ev.event_time}</span>}
          </div>
        ) : (
          <div className="text-xs" style={{ color: "#d8c840" }}>日程未定</div>
        )}
        <div className="text-base font-semibold leading-tight" style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif" }}>
          {stripDatePrefix(ev.title)}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color, border: `1px solid ${color}` }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

export default function GmSessionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params.id as string;
  const monthParam = searchParams.get("month");

  const [gmName, setGmName] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const isDiscordId = /^\d{10,}$/.test(rawId);
      const decodedName = decodeURIComponent(rawId);

      let allEvents: Event[] = [];

      if (isDiscordId) {
        const { data: byId } = await supabase
          .from("events")
          .select("id, title, status, event_date, event_time, discord_channel_id, gm_name, creator_name, creator_image, month, gm_id, creator_id")
          .or(`gm_id.eq.${rawId},creator_id.eq.${rawId}`);
        allEvents = (byId ?? []).filter(
          (e) => e.discord_channel_id !== null
            || e.status?.startsWith("closed_")
            || (e.discord_channel_id === null && !!e.month)
        );
        const nameFromData = allEvents.find((e) => e.gm_name)?.gm_name
          || allEvents.find((e) => e.creator_name)?.creator_name
          || decodedName;
        setGmName(nameFromData);
      } else {
        const [{ data: byGm }, { data: byCreator }] = await Promise.all([
          supabase.from("events").select("id, title, status, event_date, event_time, discord_channel_id, gm_name, creator_name, creator_image, month").eq("gm_name", decodedName),
          supabase.from("events").select("id, title, status, event_date, event_time, discord_channel_id, gm_name, creator_name, creator_image, month").eq("creator_name", decodedName).is("gm_name", null),
        ]);
        const combined = [...(byGm ?? []), ...(byCreator ?? [])];
        allEvents = combined.filter(
          (e) => e.discord_channel_id !== null || (e.status && e.status.startsWith("closed_"))
        );
        setGmName(decodedName);
      }

      // 月フィルター（monthParam がある場合は該当月のみ）
      if (monthParam) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        allEvents = allEvents.filter((e) => {
          const effective = e.event_date?.slice(0, 7) || e.month || null;
          if (effective === monthParam) return true;
          // 日程未定かつ月未確定のアクティブセッションは当月以降のみ表示
          if (!e.event_date && !e.month && e.discord_channel_id && monthParam >= currentMonth) return true;
          return false;
        });
      }

      // 日付昇順、日程未定は末尾
      allEvents.sort((a, b) => {
        if (!a.event_date && !b.event_date) return 0;
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return a.event_date.localeCompare(b.event_date);
      });

      setEvents(allEvents);
      setLoading(false);
    };
    load();
  }, [rawId, monthParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e", color: "#4ecdc4" }}>
        Loading...
      </div>
    );
  }

  const monthLabel = monthParam
    ? `${monthParam.slice(0, 4)}年${monthParam.slice(5, 7)}月`
    : null;

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <Link href="/event/gm-stats" className="text-xs tracking-widest hover:opacity-70 transition" style={{ color: "#9ec9b4", fontFamily: "'Cinzel', serif" }}>
            ← GM Stats
          </Link>
          <h1 className="text-3xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            {gmName ?? "..."}
          </h1>
          {monthLabel && (
            <p className="text-sm" style={{ color: "#9ec9b4" }}>
              {monthLabel}のセッション一覧
            </p>
          )}
        </div>

        {/* セッション一覧 */}
        {events.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>
              Sessions — {events.length}件
            </h2>
            <div className="space-y-2">
              {events.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>セッションがありません</p>
        )}
      </div>
    </main>
  );
}
