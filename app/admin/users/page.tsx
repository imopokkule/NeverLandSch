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
  user_name: string;
  avatar_url: string | null;
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

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
      .catch(() => {
        setUsers([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [status, isAdmin, router]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a1a1e" }}>
        <p style={{ color: "#9ec9b4" }}>読み込み中...</p>
      </main>
    );
  }

  if (!isAdmin) return null;

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
            スケジュール登録済みユーザーの一覧です。（{users.length} 人）
          </p>
        </div>

        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.discord_id}
              onClick={() => router.push(`/schedule/${u.discord_id}`)}
              className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition"
              style={{ backgroundColor: "#112428", border: "1px solid #1e3d45" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#4ecdc4"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "#1e3d45"}
            >
              <img
                src={u.avatar_url ?? defaultAvatarUrl(u.discord_id)}
                alt="avatar"
                className="w-10 h-10 rounded-full flex-shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = defaultAvatarUrl(u.discord_id); }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: "#e8f5f0" }}>
                  {u.user_name ?? "不明"}
                </p>
                <p className="text-xs" style={{ color: "#4ecdc4" }}>
                  スケジュールを見る →
                </p>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <p className="text-center py-12" style={{ color: "#9ec9b4" }}>
              ユーザーがいません
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
