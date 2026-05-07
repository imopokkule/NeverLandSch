"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type GmStat = {
  gm_id: string | null;
  gm_name: string;
  count: number;
};

export default function GmStatsPage() {
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

      // event_date が選択月のセッションを取得（discord_channel_id が null のアーカイブ済みも含む）
      const { data } = await supabase
        .from("events")
        .select("gm_id, gm_name, creator_name, status")
        .not("gm_name", "is", null)
        .like("event_date", `${month}%`);

      if (!data) { setLoading(false); return; }

      const countMap = new Map<string, { gm_id: string | null; count: number }>();
      for (const ev of data) {
        const name = ev.gm_name || ev.creator_name;
        if (!name) continue;
        const existing = countMap.get(name);
        countMap.set(name, {
          gm_id: ev.gm_id ?? existing?.gm_id ?? null,
          count: (existing?.count ?? 0) + 1,
        });
      }

      const sorted = Array.from(countMap.entries())
        .map(([gm_name, { gm_id, count }]) => ({ gm_id, gm_name, count }))
        .sort((a, b) => b.count - a.count);

      setStats(sorted);
      setLoading(false);
    };
    load();
  }, [month]);

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            GM Stats
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            選択月に開催日があるセッションのGM集計です。
          </p>
        </div>

        {/* 月選択 */}
        <div className="flex items-center justify-between px-5 py-4 rounded-xl" style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}>
          <button
            onClick={() => shiftMonth(-1)}
            className="text-xl font-bold px-2 hover:opacity-70 transition"
            style={{ color: "#4ecdc4" }}
          >
            ‹
          </button>
          <div className="text-center" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "900" }}>{month.slice(0, 4)}</span>
            <span style={{ fontSize: "1.1rem", margin: "0 0.4em", color: "#9ec9b4" }}>/</span>
            <span style={{ fontSize: "1.7rem", fontWeight: "900" }}>{month.slice(5, 7)}</span>
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="text-xl font-bold px-2 hover:opacity-70 transition"
            style={{ color: "#4ecdc4" }}
          >
            ›
          </button>
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
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="text-lg font-bold w-8 text-right"
                    style={{
                      color: i === 0 ? "#f0c040" : i === 1 ? "#b0b8c8" : i === 2 ? "#cd7f32" : "#4ecdc4",
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-base" style={{ color: "#e8f5f0" }}>{s.gm_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}>
                    {s.count}
                  </span>
                  <span className="text-sm" style={{ color: "#9ec9b4" }}>回</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
