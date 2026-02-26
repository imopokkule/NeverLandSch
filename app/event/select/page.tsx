"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type User = {
  discord_id: string;
  user_name: string | null;
};

export default function EventSelectPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("schedules")
        .select("discord_id, user_name")
        .not("user_name", "is", null);

      if (data) {
        const unique = Array.from(
          new Map(data.map(u => [u.discord_id, u])).values()
        );
        setUsers(unique);
      }
    };

    fetchUsers();
  }, []);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id)
        ? prev.filter(u => u !== id)
        : [...prev, id]
    );
  };

  const goNext = () => {
    if (selectedUsers.length === 0) return;
    router.push(`/event/create?users=${selectedUsers.join(",")}`);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          参加者を選択
        </h1>

        <div className="space-y-3">
          {users.map(user => (
            <label
              key={user.discord_id}
              className="flex items-center gap-3 bg-white p-4 rounded-xl border cursor-pointer"
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

        <button
          onClick={goNext}
          className="mt-8 w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          次へ
        </button>
      </div>
    </main>
  );
}
