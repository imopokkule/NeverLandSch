"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type Event = {
  id: string;
  title: string;
  status: string;
  discord_channel_id: string;
  creator_name: string | null;
  creator_image: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  recruiting: "募集中",
  confirmed: "立卓済み",
  closed_trpg: "〆済みTRPG",
  closed_murder: "〆済みマダミス",
};

export default function EventPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      setEvents(data || []);
    };

    fetchEvents();
  }, []);

  const filtered =
    filter === "all"
      ? events
      : events.filter((ev) => ev.status === filter);

  return (
    <main className="min-h-screen bg-[#2b2d31] text-white p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold">
          イベント一覧
        </h1>

        {/* フィルター */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-[#1e1f22] px-4 py-2 rounded"
        >
          <option value="all">すべて</option>
          <option value="recruiting">募集中</option>
          <option value="confirmed">立卓済み</option>
          <option value="closed_trpg">〆済みTRPG</option>
          <option value="closed_murder">〆済みマダミス</option>
        </select>

        {/* 一覧 */}
        <div className="space-y-4">
          {filtered.map((ev) => (
            <Link
              key={ev.id}
              href={`/event/${ev.discord_channel_id}`}
              className="block bg-[#1e1f22] p-6 rounded-xl hover:bg-[#313338] transition"
            >
              <div className="flex justify-between items-center">

                <div>
                  <h2 className="text-xl font-semibold">
                    {ev.title}
                  </h2>

                  <p className="text-sm text-gray-400">
                    {STATUS_LABELS[ev.status]}
                  </p>
                </div>

                {/* 作成者表示 */}
                <div className="flex items-center gap-3">
                  {ev.creator_image && (
                    <img
                      src={ev.creator_image}
                      alt="creator"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-300">
                    {ev.creator_name}
                  </span>
                </div>

              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}