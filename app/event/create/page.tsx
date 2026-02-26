"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/app/lib/supabase";

type User = {
  discord_id: string;
  user_name: string;
  data: Record<string, number>;
};

const STATUS_OPTIONS = [
  { value: "recruiting", label: "募集中" },
  { value: "confirmed", label: "立卓済み" },
  { value: "closed_trpg", label: "〆済みTRPG" },
  { value: "closed_murder", label: "〆済みマダミス" },
];

const getCellLabel = (value: number) => {
  if (value === 3) return "◎";
  if (value === 1) return "〇";
  if (value === 2) return "△";
  return "×";
};

const getCellBg = (value: number) => {
  if (value === 3) return "#1e4a2e";
  if (value === 1) return "#3a3a12";
  if (value === 2) return "#162545";
  return "#3a1212";
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const getWeekday = (yearMonth: string, day: number) => {
  const [y, m] = yearMonth.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, day).getDay()];
};

const getWeekdayColor = (yearMonth: string, day: number) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const dow = new Date(y, m - 1, day).getDay();
  if (dow === 0) return "#e07070";
  if (dow === 6) return "#7099e0";
  return "#9ec9b4";
};

export default function EventCreatePage() {
  const { data: session } = useSession();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("recruiting");
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [hour, setHour] = useState("18");
  const [minute, setMinute] = useState("00");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [creating, setCreating] = useState(false);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");

  // 全ユーザー取得 + 選択月のスケジュール取得
  useEffect(() => {
    const fetchUsers = async () => {
      const [{ data: allData }, { data: monthData }] = await Promise.all([
        supabase.from("schedules").select("discord_id, user_name").not("user_name", "is", null),
        supabase.from("schedules").select("discord_id, data").eq("month", selectedMonth),
      ]);

      const unique = Array.from(
        new Map((allData || []).map((u: any) => [u.discord_id, u])).values()
      ) as { discord_id: string; user_name: string }[];

      const scheduleMap = new Map((monthData || []).map((s: any) => [s.discord_id, s.data]));

      const merged: User[] = unique.map((u) => ({
        discord_id: u.discord_id,
        user_name: u.user_name,
        data: scheduleMap.get(u.discord_id) || {},
      }));

      setAllUsers(merged);

      // 選択済みユーザーのデータも更新
      setSelectedUsers(prev =>
        prev.map(su => ({
          ...su,
          data: scheduleMap.get(su.discord_id) || {},
        }))
      );
    };
    fetchUsers();
  }, [selectedMonth]);

  const toggleUser = (u: User) => {
    if (selectedUsers.find((x) => x.discord_id === u.discord_id)) {
      setSelectedUsers(selectedUsers.filter((x) => x.discord_id !== u.discord_id));
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  const getDayStatus = (day: number) => {
    if (selectedUsers.length === 0) return "";
    let hasAll = false, hasDay = false, hasNight = false;
    for (const user of selectedUsers) {
      const value = user.data?.[String(day)];
      if (value === 0) return "×";
      if (value === 3) hasAll = true;
      if (value === 1) hasDay = true;
      if (value === 2) hasNight = true;
    }
    if (hasAll || (hasDay && hasNight)) return "◎";
    if (hasDay) return "〇";
    if (hasNight) return "△";
    return "×";
  };

  const handleDateSelect = (day: number) => {
    const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    setEventDate(date);
  };

  const createEvent = async () => {
    if (!title || !eventDate || !session) {
      alert("タイトルと日付を入力してください");
      return;
    }
    setCreating(true);
    try {
      // 1. 先に Discord チャンネルを作成してIDを取得
      let discordChannelId: string | null = null;
      const res = await fetch("/api/discord/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title, status }),
      });

      if (res.ok) {
        const json = await res.json();
        discordChannelId = json.channelId ?? null;
      } else {
        console.error("Discord channel creation failed:", await res.text());
      }

      // 2. チャンネルIDを含めて Supabase にイベント挿入
      const { error } = await supabase.from("events").insert({
        title,
        status,
        event_date: eventDate,
        event_time: `${hour}:${minute}`,
        month: selectedMonth,
        creator_id: (session.user as any)?.id,
        creator_name: session.user?.name,
        creator_image: session.user?.image,
        participants: selectedUsers.map(u => ({ discord_id: u.discord_id, user_name: u.user_name })),
        discord_channel_id: discordChannelId,
      });

      if (error) throw error;

      alert("作成成功！");
      setTitle("");
      setEventDate(null);
      setSelectedUsers([]);
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    }
    setCreating(false);
  };

  const daysInMonth = new Date(
    Number(selectedMonth.slice(0, 4)),
    Number(selectedMonth.slice(5, 7)),
    0
  ).getDate();

  const filteredUsers = allUsers.filter(u =>
    u.user_name.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle = { backgroundColor: "#112428", border: "1px solid #1e3d45", color: "#e8f5f0" };

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e", color: "#e8f5f0" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1 className="text-4xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            Create Event
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            参加者のスケジュールを確認しながらイベントを作成できます。日程表のセルをクリックして開催日を選択してください。
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左カラム：入力フォーム */}
          <div className="space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトル"
              className="w-full p-3 rounded"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={eventDate ?? ""}
                onChange={(e) => setEventDate(e.target.value)}
                className="flex-1 p-3 rounded"
                style={inputStyle}
              />
            </div>
            <div className="flex gap-2">
              <select value={hour} onChange={(e) => setHour(e.target.value)} className="p-3 rounded" style={inputStyle}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h.toString().padStart(2, "0")}>{h.toString().padStart(2, "0")}時</option>
                ))}
              </select>
              <select value={minute} onChange={(e) => setMinute(e.target.value)} className="p-3 rounded" style={inputStyle}>
                <option value="00">00分</option>
                <option value="30">30分</option>
              </select>
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-3 rounded" style={inputStyle}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {/* 参加者検索 */}
            <div>
              <h2 className="font-bold mb-3 tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
                参加者
              </h2>
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4ecdc4" }}>@</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="名前で検索..."
                  className="w-full pl-8 p-3 rounded"
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredUsers.map((u) => {
                  const isSelected = !!selectedUsers.find(x => x.discord_id === u.discord_id);
                  return (
                    <button
                      key={u.discord_id}
                      onClick={() => toggleUser(u)}
                      className="px-4 py-2 rounded-lg text-sm transition"
                      style={{
                        backgroundColor: isSelected ? "#4ecdc4" : "#112428",
                        border: "1px solid " + (isSelected ? "#4ecdc4" : "#1e3d45"),
                        color: isSelected ? "#0b1a14" : "#e8f5f0",
                        fontWeight: isSelected ? "700" : "400",
                      }}
                    >
                      {isSelected ? "✓ " : ""}{u.user_name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={createEvent}
              disabled={creating}
              className="w-full px-8 py-4 rounded-xl font-bold tracking-widest transition"
              style={{ backgroundColor: "#4ecdc4", color: "#0b1a14", fontFamily: "'Cinzel', serif" }}
            >
              {creating ? "作成中..." : "Create Event"}
            </button>
          </div>

          {/* 右カラム：スケジュール表 */}
          <div className="space-y-4">
            {/* スケジュール表示月 */}
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}>
              <span className="text-sm font-bold tracking-widest whitespace-nowrap" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
                Schedule Month
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 p-2 rounded"
                style={{ backgroundColor: "#0a1a1e", border: "1px solid #1e3d45", color: "#e8f5f0" }}
              />
            </div>
            {selectedUsers.length > 0 ? (
              <div className="overflow-auto rounded-xl" style={{ border: "1px solid #1e3d45" }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#081519" }}>
                      <th className="p-2 text-center" style={{ color: "#9ec9b4", borderBottom: "1px solid #1e3d45", width: "32px" }}>日</th>
                      <th className="p-2 text-center" style={{ color: "#9ec9b4", borderBottom: "1px solid #1e3d45", width: "28px" }}>曜</th>
                      <th className="p-2 text-center" style={{ color: "#4ecdc4", borderBottom: "1px solid #1e3d45", width: "40px" }}>判定</th>
                      {selectedUsers.map((u) => (
                        <th key={u.discord_id} className="p-2 text-center text-xs" style={{ color: "#9ec9b4", borderBottom: "1px solid #1e3d45" }}>
                          {u.user_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const overall = getDayStatus(day);
                      const selected = eventDate === `${selectedMonth}-${String(day).padStart(2, "0")}`;

                      return (
                        <tr
                          key={day}
                          style={{ backgroundColor: selected ? "#1e3d45" : "transparent" }}
                        >
                          <td className="p-2 text-center text-xs" style={{ color: "#9ec9b4", borderBottom: "1px solid #163240" }}>{day}</td>
                          <td className="p-2 text-center text-xs font-bold" style={{ color: getWeekdayColor(selectedMonth, day), borderBottom: "1px solid #163240" }}>
                            {getWeekday(selectedMonth, day)}
                          </td>
                          <td
                            onClick={() => handleDateSelect(day)}
                            className="p-2 text-center font-bold cursor-pointer"
                            style={{
                              borderBottom: "1px solid #163240",
                              color: overall === "◎" ? "#4ecdc4" : overall === "×" ? "#c0392b" : "#e8f5f0",
                              outline: selected ? "2px solid #4ecdc4" : "none",
                            }}
                          >
                            {overall}
                          </td>
                          {selectedUsers.map((u) => {
                            const value = u.data?.[String(day)] ?? 0;
                            return (
                              <td
                                key={u.discord_id}
                                className="p-2 text-center text-xs"
                                style={{ backgroundColor: getCellBg(value), borderBottom: "1px solid #163240", color: "#fff" }}
                              >
                                {getCellLabel(value)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className="h-full flex items-center justify-center rounded-xl p-12 text-center"
                style={{ border: "1px dashed #1e3d45", color: "#9ec9b4" }}
              >
                参加者を選択するとスケジュール表が表示されます
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
