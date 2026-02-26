"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSession } from "next-auth/react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const OPT_COLORS: Record<string, string> = {
  "null": "#0e2030",
  "0": "#200606",
  "1": "#201e08",
  "2": "#061220",
  "3": "#0a2818",
};
const OPT_ACTIVE_COLORS: Record<string, string> = {
  "null": "#2a5a3e",
  "0": "#e85050",
  "1": "#d8c840",
  "2": "#508cf0",
  "3": "#4ef0a0",
};
const OPT_GLOW: Record<string, string> = {
  "null": "rgba(78,205,196,0.4)",
  "0": "rgba(232,80,80,0.5)",
  "1": "rgba(216,200,64,0.5)",
  "2": "rgba(80,140,240,0.5)",
  "3": "rgba(78,240,160,0.5)",
};

export default function SchedulePage() {
  const { data: session } = useSession();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [availability, setAvailability] = useState<{ [day: number]: number | null }>({});
  const [saved, setSaved] = useState(false);

  const daysInMonth = new Date(
    Number(month.split("-")[0]),
    Number(month.split("-")[1]),
    0
  ).getDate();

  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchData = async () => {
      const { data } = await supabase
        .from("schedules")
        .select("data")
        .eq("discord_id", session.user?.id)
        .eq("month", month)
        .maybeSingle();
      setAvailability(data?.data || {});
    };
    fetchData();
  }, [session, month]);

  const handleSelect = async (day: number, value: number) => {
    const newAvailability = { ...availability, [day]: value };
    setAvailability(newAvailability);
    setSaved(false);
    await supabase.from("schedules").upsert(
      {
        discord_id: session?.user?.id,
        user_name: session?.user?.name,
        month,
        data: newAvailability,
      },
      { onConflict: "discord_id,month" }
    );
    setSaved(true);
  };

  const OPTIONS = [
    { label: "未入力", value: null },
    { label: "不可", value: 0 },
    { label: "昼", value: 1 },
    { label: "夜", value: 2 },
    { label: "全日", value: 3 },
  ];

  const getWeekdayColor = (dow: number) => {
    if (dow === 0) return "#e07070"; // 日曜
    if (dow === 6) return "#7099e0"; // 土曜
    return "#9ec9b4";
  };

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            Schedule
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            各日程の参加可否を入力してください。選択すると自動で保存されます。
          </p>
        </div>

        {/* 月選択 */}
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setSaved(false); }}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: "#112428",
              border: "1px solid #1e3d45",
              color: "#e8f5f0",
            }}
          />
          {saved && (
            <span className="text-sm" style={{ color: "#4ecdc4" }}>✓ 保存しました</span>
          )}
        </div>

        {/* 凡例 */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-xs">
            {OPTIONS.filter(o => o.value !== null).map(opt => (
              <span
                key={String(opt.value)}
                className="px-3 py-1 rounded-full"
                style={{
                  backgroundColor: OPT_ACTIVE_COLORS[String(opt.value)],
                  color: "#0a1a1e",
                  fontWeight: "bold",
                  boxShadow: `0 0 8px ${OPT_GLOW[String(opt.value)]}`,
                }}
              >
                {opt.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: "#9ec9b4" }}>
            {[
              { symbol: "◎", label: "全日",    color: "#4ef0a0" },
              { symbol: "〇", label: "昼のみ",  color: "#e8d040" },
              { symbol: "△", label: "夜のみ",  color: "#508cf0" },
              { symbol: "×", label: "参加不可", color: "#f04848" },
            ].map(({ symbol, label, color }) => (
              <span key={symbol} className="flex items-center gap-1">
                <span style={{ color, fontWeight: "bold", textShadow: `0 0 6px ${color}` }}>{symbol}</span>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 日程リスト */}
        <div className="space-y-2">
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const status = availability[day] ?? null;
            const dow = new Date(
              Number(month.split("-")[0]),
              Number(month.split("-")[1]) - 1,
              day
            ).getDay();
            const weekdayLabel = WEEKDAYS[dow];
            const weekdayColor = getWeekdayColor(dow);
            const isSunOrSat = dow === 0 || dow === 6;

            return (
              <div
                key={day}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  backgroundColor: "#112428",
                  border: `1px solid ${isSunOrSat ? (dow === 0 ? "#3d1e2a" : "#1e2a3d") : "#1e3d45"}`,
                }}
              >
                {/* 日付 + 曜日 */}
                <div className="flex items-baseline gap-1.5 w-16 shrink-0">
                  <span
                    className="text-sm font-bold"
                    style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif" }}
                  >
                    {day}
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: weekdayColor }}
                  >
                    {weekdayLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {OPTIONS.map((opt) => {
                    const isActive = status === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        onClick={() => handleSelect(day, opt.value as any)}
                        className="px-3 py-1 rounded text-xs transition"
                        style={{
                          backgroundColor: isActive
                            ? OPT_ACTIVE_COLORS[String(opt.value)]
                            : OPT_COLORS[String(opt.value)],
                          color: isActive ? "#0a1a1e" : "#9ec9b4",
                          fontWeight: isActive ? "bold" : "normal",
                          border: isActive ? "none" : "1px solid #1e3d45",
                          boxShadow: isActive ? `0 0 12px ${OPT_GLOW[String(opt.value)]}` : "none",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
