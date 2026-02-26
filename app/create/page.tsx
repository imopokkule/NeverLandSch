"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

type User = {
  discord_id: string;
  user_name: string | null;
};

export default function CreatePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [results, setResults] = useState<{ [day: number]: number }>({});
  const [loading, setLoading] = useState(false);

  const monthKey = new Date().toISOString().slice(0, 7);

  // ✅ ユーザー一覧取得（重複除外）
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("discord_id, user_name")
        .eq("month", monthKey)
        .not("user_name", "is", null);

      if (error) {
        console.error("ユーザー取得エラー:", error);
        return;
      }

      // 重複排除
      const unique = Array.from(
        new Map(data.map((u) => [u.discord_id, u])).values()
      );

      setUsers(unique);
    };

    fetchUsers();
  }, [monthKey]);

  // ✅ ユーザー選択
  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id)
        ? prev.filter((u) => u !== id)
        : [...prev, id]
    );
  };

  // ✅ 日ごとの状態計算
  const calculateDayStatus = (values: number[]) => {
    if (values.length === 0) return 0;
    if (values.includes(0)) return 0;

    const canDay = values.every((v) => v === 1 || v === 3);
    const canNight = values.every((v) => v === 2 || v === 3);
    const allDay = values.every((v) => v === 3);

    if (allDay) return 3;
    if (canDay && canNight) return 3;
    if (canDay) return 1;
    if (canNight) return 2;

    return 0;
  };

  // ✅ 集計処理
  const fetchSchedules = async () => {
    if (selectedUsers.length === 0) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("schedules")
      .select("discord_id, data")
      .eq("month", monthKey)
      .in("discord_id", selectedUsers);

    setLoading(false);

    if (error) {
      console.error("取得エラー:", error);
      return;
    }

    const result: { [day: number]: number } = {};
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const values = data.map((u) => u.data?.[day] ?? 0);
      result[day] = calculateDayStatus(values);
    }

    setResults(result);
  };

  const getColor = (value: number) => {
    if (value === 0) return "bg-red-300";
    if (value === 1) return "bg-yellow-300";
    if (value === 2) return "bg-blue-300";
    return "bg-green-400";
  };

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          📅 イベント作成
        </h1>

        {/* 参加者選択 */}
        <div className="mb-8">
          <p className="font-semibold mb-4">参加者を選択</p>

          <div className="grid grid-cols-2 gap-3">
            {users.map((user) => (
              <label
                key={user.discord_id}
                className="flex items-center gap-2 bg-white p-3 rounded-lg border cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.discord_id)}
                  onChange={() => toggleUser(user.discord_id)}
                />
                <span>
                  {user.user_name ?? user.discord_id}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={fetchSchedules}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          {loading ? "集計中..." : "集計する"}
        </button>

        {/* 結果表示 */}
        {Object.keys(results).length > 0 && (
          <div className="mt-10 grid grid-cols-7 gap-3">
            {Object.entries(results).map(([day, value]) => (
              <div
                key={day}
                className={`p-4 text-center rounded-xl font-semibold ${getColor(
                  value
                )}`}
              >
                {day}日
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
