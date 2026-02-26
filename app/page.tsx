"use client";

import Link from "next/link";

const PAGES = [
  {
    href: "/event",
    label: "Sessions",
    desc: "開催予定・募集中のセッション一覧",
    tooltip: "参加者募集中のセッションや立卓済みのセッションを確認できます",
  },
  {
    href: "/event/create",
    label: "Create",
    desc: "新しいセッションを作成",
    tooltip: "参加者のスケジュールを参照しながら新しいセッションを作成します",
  },
  {
    href: "/schedule",
    label: "Schedule",
    desc: "参加可否スケジュールを入力",
    tooltip: "各日程の参加可否（昼・夜・全日・不可）を登録できます",
  },
];

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: "#0a1a1e" }}
    >
      <div className="text-center space-y-12">

        {/* タイトル */}
        <div className="space-y-2">
          <h1
            className="text-5xl md:text-7xl font-bold tracking-widest"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              color: "#4ecdc4",
              textShadow: "0 0 30px rgba(78,205,196,0.4)",
            }}
          >
            Never Land
          </h1>
          <h2
            className="text-2xl md:text-3xl tracking-[0.3em]"
            style={{ fontFamily: "'Cinzel', serif", color: "#e8f5f0" }}
          >
            Scheduler
          </h2>
        </div>

        {/* ボタン */}
        <div className="flex flex-wrap gap-6 justify-center">
          {PAGES.map((page) => (
            <div key={page.href} className="relative group">
              <Link
                href={page.href}
                className="block px-10 py-5 rounded-xl transition text-center"
                style={{
                  backgroundColor: "#4ecdc4",
                  color: "#0b1a14",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: "700",
                  letterSpacing: "0.15em",
                  minWidth: "160px",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#38b2a8";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#4ecdc4";
                }}
              >
                <div className="text-lg">{page.label}</div>
                <div className="text-xs mt-1 opacity-70">{page.desc}</div>
              </Link>

              {/* PCホバーツールチップ */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block"
                style={{
                  backgroundColor: "#112428",
                  border: "1px solid #4ecdc4",
                  color: "#e8f5f0",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {page.tooltip}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
