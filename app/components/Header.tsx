"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export default function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-[#5865F2] text-white shadow-lg">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">

        {/* ロゴ */}
        <Link href="/" className="text-2xl font-bold tracking-wide hover:opacity-80 transition">
          マダミス管理
        </Link>

        {/* PCナビ */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:underline">HOME</Link>
          <Link href="/event" className="hover:underline">EVENTS</Link>
          <Link href="/event/create" className="hover:underline">CREATE</Link>
          <Link href="/schedule" className="hover:underline">SCHEDULE</Link>
          {session && (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                />
              )}
              <button
                onClick={() => signOut()}
                className="bg-white text-[#5865F2] px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition"
              >
                Logout
              </button>
            </div>
          )}
        </nav>

        {/* ハンバーガーボタン（スマホ） */}
        <button
          className="md:hidden flex flex-col gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="block w-6 h-0.5 bg-white" />
          <span className="block w-6 h-0.5 bg-white" />
          <span className="block w-6 h-0.5 bg-white" />
        </button>
      </div>

      {/* スマホメニュー */}
      {menuOpen && (
        <div className="md:hidden flex flex-col gap-4 px-8 pb-6 text-sm font-medium">
          <Link href="/" onClick={() => setMenuOpen(false)} className="hover:underline">HOME</Link>
          <Link href="/event" onClick={() => setMenuOpen(false)} className="hover:underline">EVENTS</Link>
          <Link href="/event/create" onClick={() => setMenuOpen(false)} className="hover:underline">CREATE</Link>
          <Link href="/schedule" onClick={() => setMenuOpen(false)} className="hover:underline">SCHEDULE</Link>
          {session && (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm">{session.user?.name}</span>
              <button
                onClick={() => { signOut(); setMenuOpen(false); }}
                className="bg-white text-[#5865F2] px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition w-fit"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
