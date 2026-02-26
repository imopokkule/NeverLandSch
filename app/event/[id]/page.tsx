"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Event = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  event_time: string | null;
  discord_channel_id: string | null;
  participants: { discord_id: string; user_name: string }[] | null;
  month: string | null;
};

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
  if (value === 3) return "#2a6b3a";
  if (value === 1) return "#6b6b1a";
  if (value === 2) return "#1a3a6b";
  return "#6b1a1a";
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const inputStyle = { backgroundColor: "#112428", border: "1px solid #1e3d45", color: "#e8f5f0" };

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("discord_channel_id", channelId)
        .single();

      if (!error && data) {
        setEvent(data);
        if (data.month) setSelectedMonth(data.month);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [channelId]);

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
      setSelectedUsers(prev =>
        prev.map(su => ({ ...su, data: scheduleMap.get(su.discord_id) || {} }))
      );
    };
    fetchUsers();
  }, [selectedMonth]);

  // イベントロード後に既存参加者をセット
  useEffect(() => {
    if (!event?.participants || allUsers.length === 0) return;
    const existing = event.participants
      .map(p => allUsers.find(u => u.discord_id === p.discord_id))
      .filter(Boolean) as User[];
    if (existing.length > 0) setSelectedUsers(existing);
  }, [event, allUsers]);

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
    if (!event) return;
    const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    setEvent({ ...event, event_date: date });
  };

  const updateEvent = async () => {
    if (!event) return;
    const { error } = await supabase
      .from("events")
      .update({
        title: event.title,
        status: event.status,
        event_date: event.event_date,
        event_time: event.event_time,
        participants: selectedUsers.map(u => ({ discord_id: u.discord_id, user_name: u.user_name })),
      })
      .eq("id", event.id);

    if (error) { alert("更新失敗"); return; }

    // Discord チャンネル更新（名前・カテゴリ移動）
    if (event.discord_channel_id) {
      await fetch("/api/discord/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: event.title,
          status: event.status,
          channelId: event.discord_channel_id,
        }),
      });
    } else {
      // チャンネルがまだ存在しない場合は新規作成
      const res = await fetch("/api/discord/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: event.title, status: event.status }),
      });
      if (res.ok) {
        const { channelId } = await res.json();
        await supabase.from("events").update({ discord_channel_id: channelId }).eq("id", event.id);
        setEvent({ ...event, discord_channel_id: channelId });
      }
    }

    alert("更新しました！");
  };

  const deleteEvent = async () => {
    if (!event || !confirm("本当に削除しますか？")) return;

    // Discord チャンネル削除
    if (event.discord_channel_id) {
      await fetch("/api/discord/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", channelId: event.discord_channel_id }),
      });
    }

    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) alert("削除失敗");
    else { alert("削除しました"); router.push("/event"); }
  };

  const filteredUsers = allUsers.filter(u =>
    u.user_name.toLowerCase().includes(search.toLowerCase())
  );

  const daysInMonth = new Date(
    Number(selectedMonth.slice(0, 4)),
    Number(selectedMonth.slice(5, 7)),
    0
  ).getDate();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e", color: "#4ecdc4" }}>
      Loading...
    </div>
  );

  if (!event) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e", color: "#c0392b" }}>
      Not Found
    </div>
  );

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e", color: "#e8f5f0" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ページヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1 className="text-4xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}>
            Event Detail
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            イベントの詳細編集・参加者の変更・日程の変更ができます。
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左カラム */}
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm" style={{ color: "#9ec9b4" }}>タイトル</label>
              <input
                value={event.title ?? ""}
                onChange={(e) => setEvent({ ...event, title: e.target.value })}
                className="w-full p-3 rounded"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm" style={{ color: "#9ec9b4" }}>日付</label>
              <input
                type="date"
                value={event.event_date ?? ""}
                onChange={(e) => setEvent({ ...event, event_date: e.target.value })}
                className="w-full p-3 rounded"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm" style={{ color: "#9ec9b4" }}>時間</label>
              <div className="flex gap-2">
                <select
                  value={event.event_time?.split(":")[0] ?? "18"}
                  onChange={(e) => setEvent({ ...event, event_time: `${e.target.value}:${event.event_time?.split(":")[1] ?? "00"}` })}
                  className="p-3 rounded"
                  style={inputStyle}
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h.toString().padStart(2, "0")}>{h.toString().padStart(2, "0")}時</option>
                  ))}
                </select>
                <select
                  value={event.event_time?.split(":")[1] ?? "00"}
                  onChange={(e) => setEvent({ ...event, event_time: `${event.event_time?.split(":")[0] ?? "18"}:${e.target.value}` })}
                  className="p-3 rounded"
                  style={inputStyle}
                >
                  <option value="00">00分</option>
                  <option value="30">30分</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm" style={{ color: "#9ec9b4" }}>ステータス</label>
              <select
                value={event.status}
                onChange={(e) => setEvent({ ...event, status: e.target.value })}
                className="w-full p-3 rounded"
                style={inputStyle}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm" style={{ color: "#9ec9b4" }}>スケジュール表示月</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-3 rounded"
                style={inputStyle}
              />
            </div>

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

            {/* ボタン */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={updateEvent}
                className="flex-1 px-6 py-3 rounded-xl font-bold tracking-widest"
                style={{ backgroundColor: "#4ecdc4", color: "#0b1a14", fontFamily: "'Cinzel', serif" }}
              >
                Save
              </button>
              <button
                onClick={deleteEvent}
                className="px-6 py-3 rounded-xl font-bold tracking-widest"
                style={{ backgroundColor: "#6b1a1a", color: "#e8f5f0", border: "1px solid #c0392b" }}
              >
                Delete
              </button>
            </div>
          </div>

          {/* 右カラム：スケジュール表 */}
          <div>
            {selectedUsers.length > 0 ? (
              <div className="overflow-auto rounded-xl" style={{ border: "1px solid #1e3d45" }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#081519" }}>
                      <th className="p-2 text-center" style={{ color: "#9ec9b4", borderBottom: "1px solid #1e3d45", width: "40px" }}>日</th>
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
                      const selected = event.event_date === `${selectedMonth}-${String(day).padStart(2, "0")}`;

                      return (
                        <tr key={day} style={{ backgroundColor: selected ? "#1e3d45" : "transparent" }}>
                          <td className="p-2 text-center text-xs" style={{ color: "#9ec9b4", borderBottom: "1px solid #163240" }}>{day}</td>
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
