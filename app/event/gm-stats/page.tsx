"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type GmStat = {
  gm_id: string | null;
  gm_name: string;
  count: number;         // 合計（日程あり + 日程未定含む）
  undatedCount: number;  // 立卓済み かつ event_date 未設定の数
};

export default function GmStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<GmStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const currentMonth = new Date().toISOString().slice(0, 7);
      // gm_id があればそれをキーに、なければ名前をキーにして同一ユーザーの重複を防ぐ
      type Entry = { gm_id: string | null; gm_name: string; count: number; undatedCount: number };
      const countMap = new Map<string, Entry>();
      const getKey = (gm_id: string | null | undefined, gm_name: string) => gm_id ?? gm_name;

      // ① 完了済みカウント（gm_monthly_stats）
      const { data: statsData } = await supabase
        .from("gm_monthly_stats")
        .select("gm_id, gm_name, count")
        .eq("month", month);

      for (const s of statsData ?? []) {
        const key = getKey(s.gm_id, s.gm_name);
        const prev = countMap.get(key);
        countMap.set(key, {
          gm_id: prev?.gm_id ?? s.gm_id,
          gm_name: prev?.gm_name ?? s.gm_name,
          count: (prev?.count ?? 0) + s.count,
          undatedCount: prev?.undatedCount ?? 0,
        });
      }

      // ② 当月以降はアクティブセッションも集計（翌月以降も未完了セッションを含める）
      if (month >= currentMonth) {
        const { data: activeData } = await supabase
          .from("events")
          .select("gm_id, gm_name, creator_name, creator_id, status, event_date")
          .not("discord_channel_id", "is", null)
          .or("gm_name.not.is.null,creator_name.not.is.null");

        for (const ev of activeData ?? []) {
          const name = ev.gm_name || ev.creator_name;
          const evId = ev.gm_id ?? ev.creator_id;
          if (!name) continue;
          const isUndated = !ev.event_date;
          const isThisMonth = ev.event_date?.startsWith(month) ?? false;
          // 当月の開催日があるか、日程未登録のみカウント
          if (!isThisMonth && !isUndated) continue;
          const key = getKey(evId, name);
          const prev = countMap.get(key);
          countMap.set(key, {
            gm_id: prev?.gm_id ?? evId ?? null,
            gm_name: prev?.gm_name ?? name,
            count: (prev?.count ?? 0) + 1,
            undatedCount: (prev?.undatedCount ?? 0) + (isUndated ? 1 : 0),
          });
        }
      }

      const sorted = Array.from(countMap.values())
        .sort((a, b) => b.count - a.count);

      setStats(sorted);
      setLoading(false);
    };
    load();
  }, [month]);

  const handleCardClick = (s: GmStat) => {
    // gm_id（Discord ID）があればそれを使い、なければ名前をエンコード
    const param = s.gm_id ?? encodeURIComponent(s.gm_name);
    router.push(`/gm/${param}`);
  };

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1 className="text-4xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            GM Stats
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            当月のGM別セッション数。カードをクリックするとセッション一覧を表示します。
          </p>
        </div>

        {/* 月選択 */}
        <div className="flex items-center justify-between px-5 py-4 rounded-xl" style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}>
          <button onClick={() => shiftMonth(-1)} className="text-xl font-bold px-2 hover:opacity-70 transition" style={{ color: "#4ecdc4" }}>‹</button>
          <div className="text-center" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "900" }}>{month.slice(0, 4)}</span>
            <span style={{ fontSize: "1.1rem", margin: "0 0.4em", color: "#9ec9b4" }}>/</span>
            <span style={{ fontSize: "1.7rem", fontWeight: "900" }}>{month.slice(5, 7)}</span>
          </div>
          <button onClick={() => shiftMonth(1)} className="text-xl font-bold px-2 hover:opacity-70 transition" style={{ color: "#4ecdc4" }}>›</button>
        </div>

        {loading ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>読み込み中...</p>
        ) : stats.length === 0 ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>該当月のデータがありません</p>
        ) : (
          <div className="space-y-2">
            {stats.map((s, i) => (
              <div
                key={s.gm_id ?? s.gm_name}
                onClick={() => handleCardClick(s)}
                className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition"
                style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#1e3d45"}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="text-lg font-bold w-8 text-right"
                    style={{ color: i === 0 ? "#f0c040" : i === 1 ? "#b0b8c8" : i === 2 ? "#cd7f32" : "#4ecdc4", fontFamily: "'Cinzel', serif" }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-base" style={{ color: "#e8f5f0" }}>{s.gm_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {s.undatedCount > 0 && (
                    <div className="text-right">
                      <div className="text-xs" style={{ color: "#9ec9b4" }}>日程未登録</div>
                      <div className="text-lg font-bold" style={{ color: "#d8c840", fontFamily: "'Cinzel', serif" }}>
                        {s.undatedCount}
                      </div>
                    </div>
                  )}
                  <div className="text-right">
                    {s.undatedCount > 0 && <div className="text-xs" style={{ color: "#9ec9b4" }}>日程あり</div>}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>{s.count - s.undatedCount}</span>
                      <span className="text-sm" style={{ color: "#9ec9b4" }}>件</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
