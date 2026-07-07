"use client";

import { useEffect, useState } from "react";

type Scenario = { id: string; name: string };
type UserChannel = { id: string; name: string; scenarios: Scenario[] };
type ScenariosData = { trpg: UserChannel[]; madamis: UserChannel[] };

function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: "#4ecdc444", color: "#4ef0a0", borderRadius: "2px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ScenariosPage() {
  const [data, setData] = useState<ScenariosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trpg" | "madamis">("trpg");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then((d: ScenariosData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const currentList: UserChannel[] = data?.[tab] ?? [];

  const filtered = search.trim()
    ? currentList
        .map((u) => ({
          ...u,
          scenarios: u.scenarios.filter((s) =>
            s.name.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((u) => u.scenarios.length > 0)
    : currentList.filter((u) => u.scenarios.length > 0);

  const trpgTotal = data?.trpg.reduce((n, u) => n + u.scenarios.length, 0) ?? 0;
  const madamisTotal = data?.madamis.reduce((n, u) => n + u.scenarios.length, 0) ?? 0;
  const matchCount = filtered.reduce((n, u) => n + u.scenarios.length, 0);

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ヘッダー */}
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            Scenarios
          </h1>
          <p className="text-sm tracking-wide" style={{ color: "#9ec9b4" }}>
            メンバーの所持シナリオ一覧
          </p>
        </div>

        {/* タブ */}
        <div className="flex gap-2">
          {([
            { key: "trpg",    label: "TRPG",    count: trpgTotal },
            { key: "madamis", label: "マダミス", count: madamisTotal },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSearch(""); }}
              className="px-4 py-2 rounded-lg text-sm font-bold tracking-widest transition"
              style={{
                backgroundColor: tab === key ? "#4ecdc4" : "#112428",
                border: `1px solid ${tab === key ? "#4ecdc4" : "#1e3d45"}`,
                color: tab === key ? "#0b1a14" : "#9ec9b4",
              }}
            >
              {label}
              {!loading && (
                <span
                  className="ml-2 text-xs"
                  style={{ opacity: 0.7 }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 検索 */}
        <div className="relative">
          <input
            type="text"
            placeholder="シナリオ名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "#112428", border: "1px solid #1e3d45", color: "#e8f5f0" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#4ecdc4")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#1e3d45")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm hover:opacity-70"
              style={{ color: "#9ec9b4" }}
            >
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center py-12" style={{ color: "#9ec9b4" }}>読み込み中...</p>
        ) : (
          <>
            {/* 検索結果サマリ */}
            {search.trim() && (
              <p className="text-sm" style={{ color: "#9ec9b4" }}>
                「<span style={{ color: "#4ecdc4" }}>{search}</span>」に一致：
                <span style={{ color: "#e8f5f0" }}>{filtered.length}人</span> ／{" "}
                <span style={{ color: "#e8f5f0" }}>{matchCount}件</span>
              </p>
            )}

            {/* ユーザーカード一覧 */}
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl p-5 space-y-3"
                  style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className="font-bold truncate"
                      style={{ color: "#4ecdc4", fontFamily: "'Cinzel', serif" }}
                    >
                      {user.name}
                    </h2>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: "#9ec9b4", border: "1px solid #1e3d45" }}
                    >
                      {user.scenarios.length}件
                    </span>
                  </div>
                  <ul className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {user.scenarios.map((s) => (
                      <li
                        key={s.id}
                        className="text-sm px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: "#0d1f24", color: "#e8f5f0" }}
                      >
                        {highlightMatch(s.name, search)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-center py-12" style={{ color: "#9ec9b4" }}>
                {search.trim()
                  ? "該当するシナリオが見つかりません"
                  : "シナリオが登録されていません"}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
