"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_DISCORD_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function defaultAvatarUrl(userId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> BigInt(22)) % 6}.png`;
}

type AppUser = {
  discord_id: string;
  site_name: string | null;
  discord_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  isNew: boolean;
  hasSchedule: boolean;
  inGuild: boolean;
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "no_global_name" | "left_guild">("all");

  const isAdmin =
    ADMIN_IDS.length > 0 && !!session?.user?.id && ADMIN_IDS.includes(session.user.id);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !isAdmin) {
      router.replace("/");
      return;
    }
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [status, isAdmin, router]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e" }}>
        <p style={{ color: "#9ec9b4" }}>読み込み中...</p>
      </main>
    );
  }

  if (!isAdmin) return null;

  const scheduleUsers = users.filter((u) => u.hasSchedule);
  const noGlobalNameUsers = scheduleUsers.filter((u) => !u.display_name);
  const leftGuildUsers = scheduleUsers.filter((u) => !u.inGuild);

  const baseList =
    filter === "no_global_name" ? noGlobalNameUsers :
    filter === "left_guild"     ? leftGuildUsers :
    scheduleUsers;

  const filtered = search.trim()
    ? baseList.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.site_name?.toLowerCase().includes(q) ||
          u.discord_name?.toLowerCase().includes(q) ||
          u.display_name?.toLowerCase().includes(q)
        );
      })
    : baseList;

  return (
    <main className="min-h-screen p-8 md:p-12" style={{ backgroundColor: "#0a1a1e" }}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2 border-b pb-6" style={{ borderColor: "#1e3d45" }}>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
          >
            Users
          </h1>
          <p style={{ color: "#9ec9b4" }} className="text-sm tracking-wide">
            全 {scheduleUsers.length} 人 / 表示名未設定 {noGlobalNameUsers.length} 人 / 退出済み {leftGuildUsers.length} 人
          </p>
        </div>

        {/* フィルター */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: "all",            label: `全員 (${scheduleUsers.length})` },
            { key: "no_global_name", label: `表示名未設定 (${noGlobalNameUsers.length})` },
            { key: "left_guild",     label: `退出済み (${leftGuildUsers.length})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-4 py-2 rounded-lg text-sm font-bold tracking-widest transition"
              style={{
                backgroundColor: filter === key ? "#4ecdc4" : "#112428",
                border: `1px solid ${filter === key ? "#4ecdc4" : "#1e3d45"}`,
                color: filter === key ? "#0b1a14" : "#9ec9b4",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 検索 */}
        <div className="relative">
          <input
            type="text"
            placeholder="名前で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: "#112428",
              border: "1px solid #1e3d45",
              color: "#e8f5f0",
            }}
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

        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.discord_id}
              onClick={() => router.push(`/schedule/${u.discord_id}`)}
              className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition"
              style={{ backgroundColor: "#112428", border: `1px solid ${!u.inGuild ? "#f04848" : u.isNew ? "#4ecdc4" : "#1e3d45"}` }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = !u.inGuild ? "#f04848" : "#4ecdc4"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = !u.inGuild ? "#f04848" : u.isNew ? "#4ecdc4" : "#1e3d45"}
            >
              <img
                src={u.avatar_url ?? defaultAvatarUrl(u.discord_id)}
                alt="avatar"
                className="w-10 h-10 rounded-full flex-shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = defaultAvatarUrl(u.discord_id); }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold" style={{ color: "#e8f5f0" }}>
                    {u.site_name ?? u.discord_name ?? u.discord_id}
                  </p>
                  {u.isNew && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#4ecdc4", color: "#0a1a1e" }}>
                      NEW
                    </span>
                  )}
                  {!u.inGuild && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ border: "1px solid #f04848", color: "#f04848" }}>
                      退出済み
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {u.discord_name && (
                    <p className="text-xs" style={{ color: "#9ec9b4" }}>@{u.discord_name}</p>
                  )}
                  {u.display_name && u.display_name !== u.site_name && u.display_name !== u.discord_name && (
                    <p className="text-xs" style={{ color: "#6bb8a0" }}>{u.display_name}</p>
                  )}
                  {u.created_at && (
                    <p className="text-xs" style={{ color: "#4a7a6a" }}>
                      登録: {new Date(u.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>

              {/* 退出済みユーザーのみ削除ボタン */}
              {!u.inGuild && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`「${u.site_name ?? u.discord_name ?? u.discord_id}」のデータを削除しますか？\nこの操作は取り消せません。`)) return;
                    const res = await fetch(`/api/admin/delete-user?discord_id=${u.discord_id}`, { method: "DELETE" });
                    if (res.ok) {
                      setUsers((prev) => prev.filter((x) => x.discord_id !== u.discord_id));
                    } else {
                      alert("削除に失敗しました");
                    }
                  }}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition hover:opacity-80"
                  style={{ backgroundColor: "#3a0a0a", border: "1px solid #f04848", color: "#f04848" }}
                >
                  登録削除
                </button>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-center py-12" style={{ color: "#9ec9b4" }}>
              {search ? "該当するユーザーが見つかりません" : "ユーザーがいません"}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
