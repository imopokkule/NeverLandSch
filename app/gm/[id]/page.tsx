"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
      className="block p-4 rounded-xl transition"
      style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#1e3d45"}
    >
      {ev.event_date && (
        <div className="text-xs font-mono mb-1" style={{ color: "#4ecdc4" }}>
          {ev.event_date.replace(/^(\d+)-(\d+)-(\d+)$/, "$2/$3")}
          {ev.event_time && <span style={{ color: "#9ec9b4" }}> {ev.event_time}</span>}
        </div>
      )}
      <div className="font-semibold" style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif" }}>
        {stripDatePrefix(ev.title)}
      </div>
      <div className="mt-1">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color, border: `1px solid ${color}` }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

export default function GmSessionsPage() {
  const params = useParams();
  const rawId = params.id as string;

  const [gmName, setGmName] = useState<string | null>(null);
  const [datedEvents, setDatedEvents] = useState<Event[]>([]);
  const [undatedConfirmed, setUndatedConfirmed] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // rawId が数値（Discord ID）かテキスト（名前）かを判定
      const isDiscordId = /^\d{10,}$/.test(rawId);
      const decodedName = decodeURIComponent(rawId);

      let allEvents: Event[] = [];

      if (isDiscordId) {
        // Discord ID で検索
        const { data: byId } = await supabase
          .from("events")
          .select("id, title, status, event_date, event_time, discord_channel_id, gm_name, creator_name, creator_image, gm_id, creator_id")
          .not("discord_channel_id", "is", null)
          .or(`gm_id.eq.${rawId},creator_id.eq.${rawId}`);
        allEvents = byId ?? [];

        // gm_name を確定
        const nameFromData = allEvents.find((e) => e.gm_name)?.gm_name
          || allEvents.find((e) => e.creator_name)?.creator_name
          || decodedName;
        setGmName(nameFromData);
      } else {
        // 名前で検索（gm_name または creator_name）
        const [{ data: byGm }, { data: byCreator }] = await Promise.all([
          supabase.from("events").select("id, title, status, event_date, event_time, discord_channel_id, gm_name, creator_name, creator_image").not("discord_channel_id", "is", null).eq("gm_name", decodedName),
          supabase.from("events").select("id, title, status, event_date, event_time, discord_channel_id, gm_name, creator_name, creator_image").not("discord_channel_id", "is", null).eq("creator_name", decodedName).is("gm_name", null),
        ]);
        allEvents = [...(byGm ?? []), ...(byCreator ?? [])];
        setGmName(decodedName);
      }

      // 分類
      // ① 日程未定 + 立卓済み → 別枠
      const undated = allEvents.filter((e) => e.status === "confirmed" && !e.event_date);
      // ② それ以外（日程あり、または立卓済み以外）
      const dated = allEvents
        .filter((e) => !(e.status === "confirmed" && !e.event_date))
        .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));

      setDatedEvents(dated);
      setUndatedConfirmed(undated);
      setLoading(false);
    };
    load();
  }, [rawId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e", color: "#4ecdc4" }}>
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <p className="text-xs tracking-widest" style={{ color: "#9ec9b4", fontFamily: "'Cinzel', serif" }}>GM Sessions</p>
          <h1 className="text-3xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            {gmName ?? "..."}
          </h1>
          <p className="text-sm" style={{ color: "#9ec9b4" }}>
            このGMが担当しているセッション一覧です。
          </p>
        </div>

        {/* 日程未定の立卓済みセクション */}
        {undatedConfirmed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold tracking-widest" style={{ color: "#d8c840", fontFamily: "'Cinzel', serif" }}>
              立卓済み（日程未定） — {undatedConfirmed.length}件
            </h2>
            <div className="space-y-2">
              {undatedConfirmed.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          </div>
        )}

        {/* 日程あり・その他セクション */}
        {datedEvents.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-bold tracking-widest" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>
              セッション一覧 — {datedEvents.length}件
            </h2>
            <div className="space-y-2">
              {datedEvents.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          </div>
        ) : undatedConfirmed.length === 0 ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>セッションがありません</p>
        ) : null}
      </div>
    </main>
  );
}
