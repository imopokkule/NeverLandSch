"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-[#5865F2] text-white shadow-lg">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">

        {/* ロゴ */}
        <Link href="/" className="text-2xl font-bold tracking-wide hover:opacity-80 transition">
          マダミス管理
        </Link>

        {/* ナビ */}
        <nav className="flex items-center gap-6 text-sm font-medium">

          <Link href="/" className="hover:underline">
            HOME
          </Link>

          <Link href="/event" className="hover:underline">
            EVENTS
          </Link>

          <Link href="/event/create" className="hover:underline">
            CREATE
          </Link>

          {session && (
            <button
              onClick={() => signOut()}
              className="bg-white text-[#5865F2] px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition"
            >
              Logout
            </button>
          )}

        </nav>
      </div>
    </header>
  );
}
