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

export default function EventCreatePage() {
  const { data: session } = useSession();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("recruiting");
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [hour, setHour] = useState("18");
  const [minute, setMinute] = useState("00");

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [creating, setCreating] = useState(false);

  /* ===============================
     ユーザー取得
  =============================== */
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("month", selectedMonth);

      setUsers(data || []);
    };

    fetchUsers();
  }, [selectedMonth]);

  /* ===============================
     参加者トグル
  =============================== */
  const toggleUser = (u: User) => {
    if (selectedUsers.find((x) => x.discord_id === u.discord_id)) {
      setSelectedUsers(
        selectedUsers.filter((x) => x.discord_id !== u.discord_id)
      );
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  /* ===============================
     開催可否判定
  =============================== */
  const getDayStatus = (day: number) => {
    if (selectedUsers.length === 0) return "";

    let hasAll = false;
    let hasDay = false;
    let hasNight = false;

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

  const getCellLabel = (value: number) => {
    if (value === 3) return "◎";
    if (value === 1) return "〇";
    if (value === 2) return "△";
    return "×";
  };

  const getCellColor = (value: number) => {
    if (value === 3) return "bg-green-500";
    if (value === 1) return "bg-yellow-500";
    if (value === 2) return "bg-blue-500";
    return "bg-red-500";
  };

  /* ===============================
     日付クリック
  =============================== */
  const handleDateSelect = (day: number) => {
    const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    setEventDate(date);
  };

  /* ===============================
     作成処理（DBのみ）
  =============================== */
  const createEvent = async () => {
    if (!title || !eventDate || !session) {
      alert("入力不足です");
      return;
    }

    setCreating(true);

    try {
      await supabase.from("events").insert({
        title,
        status,
        event_date: eventDate,
        event_time: `${hour}:${minute}`,
        month: selectedMonth,
        creator_id: (session.user as any)?.id,
        creator_name: session.user?.name,
        creator_image: session.user?.image,
      });

      alert("作成成功 🎉");
      setTitle("");
      setEventDate(null);
    } catch (err) {
      console.error(err);
      alert("エラー発生");
    }

    setCreating(false);
  };

  const daysInMonth = new Date(
    Number(selectedMonth.slice(0, 4)),
    Number(selectedMonth.slice(5, 7)),
    0
  ).getDate();

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0b1a14", color: "#d4e8e0" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1a3a2e" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            Create Event
          </h1>
          <p style={{ color: "#7aad99" }} className="text-sm tracking-wide">
            参加者のスケジュールを確認しながらイベントを作成できます。日程表のセルをクリックして開催日を選択してください。
          </p>
        </div>

        {/* タイトル */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          className="w-full p-3 rounded"
          style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e", color: "#d4e8e0" }}
        />

        {/* 日付 */}
        <input
          type="date"
          value={eventDate ?? ""}
          onChange={(e) => setEventDate(e.target.value)}
          className="p-3 rounded"
          style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e", color: "#d4e8e0" }}
        />

        {/* 時間 */}
        <div className="flex gap-2">
          <select
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            className="p-3 rounded"
            style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e", color: "#d4e8e0" }}
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h.toString().padStart(2, "0")}>
                {h.toString().padStart(2, "0")}時
              </option>
            ))}
          </select>
          <select
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            className="p-3 rounded"
            style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e", color: "#d4e8e0" }}
          >
            <option value="00">00分</option>
            <option value="30">30分</option>
          </select>
        </div>

        {/* ステータス */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="p-3 rounded"
          style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e", color: "#d4e8e0" }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* 表示月 */}
        <div>
          <label className="block mb-2 text-sm" style={{ color: "#7aad99" }}>スケジュール表示月</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-3 rounded"
            style={{ backgroundColor: "#112018", border: "1px solid #1a3a2e", color: "#d4e8e0" }}
          />
        </div>

        {/* 参加者 */}
        <div>
          <h2
            className="font-bold mb-3 tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            参加者
          </h2>
          <div className="flex flex-wrap gap-3">
            {users.map((u) => {
              const isSelected = !!selectedUsers.find(x => x.discord_id === u.discord_id);
              return (
                <label
                  key={u.discord_id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition"
                  style={{
                    backgroundColor: isSelected ? "#4ecdc4" : "#112018",
                    border: "1px solid #1a3a2e",
                    color: isSelected ? "#0b1a14" : "#d4e8e0",
                  }}
                >
                  <input type="checkbox" onChange={() => toggleUser(u)} className="hidden" />
                  {u.user_name}
                </label>
              );
            })}
          </div>
        </div>

        {/* 作成ボタン */}
        <button
          onClick={createEvent}
          disabled={creating}
          className="px-8 py-3 rounded-xl font-bold tracking-widest transition"
          style={{
            backgroundColor: "#4ecdc4",
            color: "#0b1a14",
            fontFamily: "'Cinzel', serif",
          }}
        >
          Create Event
        </button>

        {/* スケジュール表 */}
        {selectedUsers.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1e1f22]">
                  <th className="border p-2 w-16">日付</th>
                  <th className="border p-2 w-20">開催</th>
                  {selectedUsers.map((u) => (
                    <th key={u.discord_id} className="border p-2">
                      {u.user_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const overall = getDayStatus(day);
                  const selected =
                    eventDate ===
                    `${selectedMonth}-${String(day).padStart(2, "0")}`;

                  return (
                    <tr key={day}>
                      <td className="border p-2 text-center">
                        {day}
                      </td>

                      <td
                        onClick={() =>
                          overall &&
                          overall !== "×" &&
                          handleDateSelect(day)
                        }
                        className={`border p-2 text-center font-bold cursor-pointer ${
                          selected ? "ring-2 ring-white" : ""
                        }`}
                      >
                        {overall}
                      </td>

                      {selectedUsers.map((u) => {
                        const value =
                          u.data?.[String(day)] ?? 0;
                        return (
                          <td
                            key={u.discord_id}
                            className={`border p-2 text-center ${getCellColor(
                              value
                            )}`}
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
        )}
      </div>
    </main>
  );
}