"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export default function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={{ backgroundColor: "#071510", borderBottom: "1px solid #1a3a2e" }}>
      <div className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">

        {/* ロゴ */}
        <Link
          href="/"
          className="text-xl font-bold tracking-widest hover:opacity-80 transition"
          style={{ fontFamily: "'Cinzel', serif", color: "#4ecdc4" }}
        >
          Never Land Scheduler
        </Link>

        {/* PCナビ */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {["HOME", "EVENTS", "CREATE", "SCHEDULE"].map((label, i) => {
            const hrefs = ["/", "/event", "/event/create", "/schedule"];
            return (
              <Link
                key={label}
                href={hrefs[i]}
                className="tracking-widest hover:opacity-70 transition"
                style={{ fontFamily: "'Cinzel', serif", color: "#7aad99" }}
              >
                {label}
              </Link>
            );
          })}

          {session && (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                  style={{ border: "1px solid #4ecdc4" }}
                />
              )}
              <button
                onClick={() => signOut()}
                className="px-4 py-2 rounded-full text-sm tracking-widest transition"
                style={{
                  backgroundColor: "#4ecdc4",
                  color: "#0b1a14",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: "700",
                }}
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
          <span className="block w-6 h-0.5" style={{ backgroundColor: "#4ecdc4" }} />
          <span className="block w-6 h-0.5" style={{ backgroundColor: "#4ecdc4" }} />
          <span className="block w-6 h-0.5" style={{ backgroundColor: "#4ecdc4" }} />
        </button>
      </div>

      {/* スマホメニュー */}
      {menuOpen && (
        <div
          className="md:hidden flex flex-col gap-4 px-8 pb-6 text-sm"
          style={{ borderTop: "1px solid #1a3a2e" }}
        >
          {["HOME", "EVENTS", "CREATE", "SCHEDULE"].map((label, i) => {
            const hrefs = ["/", "/event", "/event/create", "/schedule"];
            return (
              <Link
                key={label}
                href={hrefs[i]}
                onClick={() => setMenuOpen(false)}
                className="tracking-widest hover:opacity-70 transition"
                style={{ fontFamily: "'Cinzel', serif", color: "#7aad99" }}
              >
                {label}
              </Link>
            );
          })}

          {session && (
            <div className="flex items-center gap-3 mt-2">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                  style={{ border: "1px solid #4ecdc4" }}
                />
              )}
              <span style={{ color: "#d4e8e0", fontFamily: "'Cinzel', serif", fontSize: "0.8rem" }}>
                {session.user?.name}
              </span>
              <button
                onClick={() => { signOut(); setMenuOpen(false); }}
                className="px-4 py-2 rounded-full text-sm tracking-widest transition"
                style={{
                  backgroundColor: "#4ecdc4",
                  color: "#0b1a14",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: "700",
                }}
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
