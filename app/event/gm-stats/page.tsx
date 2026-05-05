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

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("events")
        .select("gm_id, gm_name")
        .not("gm_name", "is", null);

      if (!data) { setLoading(false); return; }

      // gm_nameで集計（gm_idが取れていないセッションも含める）
      const countMap = new Map<string, { gm_id: string | null; count: number }>();
      for (const ev of data) {
        if (!ev.gm_name) continue;
        const existing = countMap.get(ev.gm_name);
        countMap.set(ev.gm_name, {
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
  }, []);

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
            GMとして卓を立てた回数の一覧です。
          </p>
        </div>

        {loading ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>読み込み中...</p>
        ) : stats.length === 0 ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>データがありません</p>
        ) : (
          <div className="space-y-2">
            {stats.map((s, i) => (
              <div
                key={s.gm_id}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="text-lg font-bold w-8 text-right"
                    style={{ color: i === 0 ? "#f0c040" : i === 1 ? "#b0b8c8" : i === 2 ? "#cd7f32" : "#4ecdc4", fontFamily: "'Cinzel', serif" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-base" style={{ color: "#e8f5f0" }}>
                    {s.gm_name}
                  </span>
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
