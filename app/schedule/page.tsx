"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSession } from "next-auth/react";

export default function SchedulePage() {
  const { data: session } = useSession();

  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [availability, setAvailability] = useState<
    { [day: number]: number | null }
  >({});
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

  const handleSelect = async (
    day: number,
    value: number
  ) => {
    const newAvailability = {
      ...availability,
      [day]: value,
    };

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

  return (
    <main className="min-h-screen bg-white p-10 text-black">
      <div className="max-w-3xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold">
          スケジュール入力
        </h1>

        {/* 月選択 */}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border p-2 rounded"
        />

        {saved && (
          <p className="text-green-600 font-semibold">保存しました！</p>
        )}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const status = availability[day] ?? null;

          return (
            <div
              key={day}
              className="flex items-center gap-4 border p-3 rounded"
            >
              <div className="w-16">{day}日</div>

              {[
                { label: "未入力", value: null },
                { label: "不可", value: 0 },
                { label: "昼", value: 1 },
                { label: "夜", value: 2 },
                { label: "全日", value: 3 },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() =>
                    handleSelect(day, opt.value as any)
                  }
                  className={`px-3 py-1 rounded ${
                    status === opt.value
                      ? "bg-black text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}
