"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center">
      <div className="text-center space-y-8">

        <h1 className="text-5xl font-bold">
          Never Land Schedule Manager
        </h1>

        <div className="flex gap-6 justify-center">

          {/* 🔥 修正：/event に変更 */}
          <Link
            href="/event"
            className="px-8 py-4 rounded-2xl bg-black text-white hover:opacity-80 transition"
          >
            イベント一覧
          </Link>

          <Link
            href="/event/create"
            className="px-8 py-4 rounded-2xl border border-black hover:bg-gray-100 transition"
          >
            イベント作成
          </Link>

          <Link
            href="/schedule"
            className="px-8 py-4 rounded-2xl border border-black hover:bg-gray-100 transition"
          >
            スケジュール入力
          </Link>

        </div>
      </div>
    </main>
  );
}
