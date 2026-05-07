"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const OPT_ACTIVE_COLORS: Record<string, string> = {
  "0": "#e85050",
  "1": "#d8c840",
  "2": "#508cf0",
  "3": "#4ef0a0",
};
const OPT_GLOW: Record<string, string> = {
  "0": "rgba(232,80,80,0.5)",
  "1": "rgba(216,200,64,0.5)",
  "2": "rgba(80,140,240,0.5)",
  "3": "rgba(78,240,160,0.5)",
};

const OPTIONS = [
  { label: "不可", value: 0 },
  { label: "昼", value: 1 },
  { label: "夜", value: 2 },
  { label: "全日", value: 3 },
];

const getWeekdayColor = (dow: number) => {
  if (dow === 0) return "#e07070";
  if (dow === 6) return "#7099e0";
  return "#9ec9b4";
};

function defaultAvatarUrl(userId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> BigInt(22)) % 6}.png`;
}

export default function UserSchedulePage() {
  const params = useParams();
  const targetId = params.id as string;

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const daysInMonth = new Date(
    Number(month.split("-")[0]),
    Number(month.split("-")[1]),
    0
  ).getDate();

  // ユーザー名・アバターを取得
  useEffect(() => {
    if (!targetId) return;
    const fetchUser = async () => {
      // schedules からユーザー名を取得
      const { data } = await supabase
        .from("schedules")
        .select("user_name")
        .eq("discord_id", targetId)
        .not("user_name", "is", null)
        .limit(1)
        .maybeSingle();
      if (data?.user_name) setUserName(data.user_name);

      // app_users からアバターを取得
      const { data: appUser } = await supabase
        .from("app_users")
        .select("avatar_url")
        .eq("discord_id", targetId)
        .maybeSingle();
      setAvatarUrl(appUser?.avatar_url ?? null);
    };
    fetchUser();
  }, [targetId]);

  // スケジュールデータを取得
  useEffect(() => {
    if (!targetId) return;
    const fetchSchedule = async () => {
      const { data } = await supabase
        .from("schedules")
        .select("data")
        .eq("discord_id", targetId)
        .eq("month", month)
        .maybeSingle();
      setAvailability(data?.data || {});
    };
    fetchSchedule();
  }, [targetId, month]);

  const avatarSrc = avatarUrl ?? defaultAvatarUrl(targetId);

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <div className="flex items-center gap-4">
            <img
              src={avatarSrc}
              alt="avatar"
              className="w-12 h-12 rounded-full"
              style={{ border: "1px solid #4ecdc4" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = defaultAvatarUrl(targetId); }}
            />
            <div>
              <h1
                className="text-3xl font-bold tracking-widest"
                style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
              >
                {userName ?? "..."}
              </h1>
              <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
                Schedule
              </p>
            </div>
          </div>
        </div>

        {/* 月選択 */}
        <div className="flex items-center justify-between px-5 py-4 rounded-xl" style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}>
          <button
            onClick={() => shiftMonth(-1)}
            className="text-xl font-bold px-2 transition-opacity hover:opacity-70"
            style={{ color: "#4ecdc4" }}
          >
            ‹
          </button>
          <div className="text-center" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "900", letterSpacing: "0.05em" }}>{month.slice(0, 4)}</span>
            <span style={{ fontSize: "1.1rem", fontWeight: "400", margin: "0 0.4em", color: "#9ec9b4" }}>/</span>
            <span style={{ fontSize: "1.7rem", fontWeight: "900", letterSpacing: "0.05em" }}>{month.slice(5, 7)}</span>
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="text-xl font-bold px-2 transition-opacity hover:opacity-70"
            style={{ color: "#4ecdc4" }}
          >
            ›
          </button>
        </div>

        {/* 凡例 */}
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

        {/* 日程リスト（読み取り専用） */}
        <div className="space-y-2">
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const value = availability[day] ?? null;
            const dow = new Date(
              Number(month.split("-")[0]),
              Number(month.split("-")[1]) - 1,
              day
            ).getDay();
            const isSunOrSat = dow === 0 || dow === 6;

            const symbol = value === 3 ? "◎" : value === 1 ? "〇" : value === 2 ? "△" : value === 0 ? "×" : "－";
            const color = value === 3 ? "#4ef0a0" : value === 1 ? "#e8d040" : value === 2 ? "#508cf0" : value === 0 ? "#f04848" : "#3a5560";

            return (
              <div
                key={day}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  backgroundColor: "#112428",
                  border: `1px solid ${isSunOrSat ? (dow === 0 ? "#3d1e2a" : "#1e2a3d") : "#1e3d45"}`,
                }}
              >
                <div className="flex items-baseline gap-1.5 w-16 shrink-0">
                  <span className="text-sm font-bold" style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif" }}>
                    {day}
                  </span>
                  <span className="text-xs font-bold" style={{ color: getWeekdayColor(dow) }}>
                    {WEEKDAYS[dow]}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-1">
                  {/* シンボル表示 */}
                  <span
                    className="text-xl font-bold w-8 text-center"
                    style={{ color, textShadow: value !== null ? `0 0 8px ${color}` : "none" }}
                  >
                    {symbol}
                  </span>

                  {/* ラベルバッジ */}
                  {value !== null && (
                    <span
                      className="text-xs px-3 py-1 rounded-full font-bold"
                      style={{
                        backgroundColor: OPT_ACTIVE_COLORS[String(value)],
                        color: "#0a1a1e",
                        boxShadow: `0 0 8px ${OPT_GLOW[String(value)]}`,
                      }}
                    >
                      {OPTIONS.find((o) => o.value === value)?.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
