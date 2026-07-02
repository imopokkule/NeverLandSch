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
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "no_schedule">("all");

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
  const noScheduleUsers = users.filter((u) => !u.hasSchedule);

  const baseList = filter === "no_schedule" ? noScheduleUsers : scheduleUsers;

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
            スケジュール登録済み {scheduleUsers.length} 人 / ログイン済み未登録 {noScheduleUsers.length} 人
          </p>
        </div>

        {/* フィルター */}
        <div className="flex gap-2">
          {(["all", "no_schedule"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-sm font-bold tracking-widest transition"
              style={{
                backgroundColor: filter === f ? "#4ecdc4" : "#112428",
                border: `1px solid ${filter === f ? "#4ecdc4" : "#1e3d45"}`,
                color: filter === f ? "#0b1a14" : "#9ec9b4",
              }}
            >
              {f === "all" ? `スケジュール登録済み (${scheduleUsers.length})` : `未登録 (${noScheduleUsers.length})`}
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
              style={{ backgroundColor: "#112428", border: `1px solid ${u.isNew ? "#4ecdc4" : "#1e3d45"}` }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = u.isNew ? "#4ecdc4" : "#1e3d45"}
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
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: "#4ecdc4", color: "#0a1a1e" }}
                    >
                      NEW
                    </span>
                  )}
                  {!u.hasSchedule && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ border: "1px solid #e8d040", color: "#e8d040" }}
                    >
                      未登録
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {u.discord_name && (
                    <p className="text-xs" style={{ color: "#9ec9b4" }}>
                      @{u.discord_name}
                    </p>
                  )}
                  {u.display_name && u.display_name !== u.site_name && u.display_name !== u.discord_name && (
                    <p className="text-xs" style={{ color: "#6bb8a0" }}>
                      {u.display_name}
                    </p>
                  )}
                  {u.created_at && (
                    <p className="text-xs" style={{ color: "#4a7a6a" }}>
                      登録: {new Date(u.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
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
