"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSession } from "next-auth/react";

const OPT_COLORS: Record<string, string> = {
  "null": "#1a3a2e",
  "0": "#5c1a1a",
  "1": "#4a6c2a",
  "2": "#1a3a5c",
  "3": "#1a4a3a",
};
const OPT_ACTIVE_COLORS: Record<string, string> = {
  "null": "#2a5a3e",
  "0": "#c0392b",
  "1": "#7ab648",
  "2": "#3498db",
  "3": "#4ecdc4",
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
    await supabase.from("schedules").upsert({
      discord_id: session?.user?.id,
      user_name: session?.user?.name,
      month,
      data: newAvailability,
    });
    setSaved(true);
  };

  const OPTIONS = [
    { label: "未入力", value: null },
    { label: "不可", value: 0 },
    { label: "昼", value: 1 },
    { label: "夜", value: 2 },
    { label: "全日", value: 3 },
  ];

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0b1a14" }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1a3a2e" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            Schedule
          </h1>
          <p style={{ color: "#7aad99" }} className="text-sm tracking-wide">
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
              backgroundColor: "#112018",
              border: "1px solid #1a3a2e",
              color: "#d4e8e0",
            }}
          />
          {saved && (
            <span className="text-sm" style={{ color: "#4ecdc4" }}>✓ 保存しました</span>
          )}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 text-xs">
          {OPTIONS.filter(o => o.value !== null).map(opt => (
            <span
              key={String(opt.value)}
              className="px-3 py-1 rounded-full"
              style={{
                backgroundColor: OPT_ACTIVE_COLORS[String(opt.value)],
                color: "#0b1a14",
                fontWeight: "bold",
              }}
            >
              {opt.label}
            </span>
          ))}
        </div>

        {/* 日程リスト */}
        <div className="space-y-2">
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const status = availability[day] ?? null;

            return (
              <div
                key={day}
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e" }}
              >
                <div
                  className="w-12 text-sm font-bold"
                  style={{ color: "#7aad99", fontFamily: "'Cinzel', serif" }}
                >
                  {day}
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
                          color: isActive ? "#0b1a14" : "#7aad99",
                          fontWeight: isActive ? "bold" : "normal",
                          border: isActive ? "none" : "1px solid #2a4a3a",
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
