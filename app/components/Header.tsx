"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_DISCORD_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const NAV_ITEMS = [
  { label: "HOME",        href: "/" },
  { label: "SESSIONS",    href: "/event" },
  { label: "MY SESSIONS", href: "/event/my" },
  { label: "CREATE",      href: "/event/create" },
  { label: "SCHEDULE",    href: "/schedule" },
  { label: "SCENARIOS",   href: "/scenarios" },
];

export default function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = ADMIN_IDS.length > 0 && !!session?.user?.id && ADMIN_IDS.includes(session.user.id);
  const navItems = isAdmin
    ? [...NAV_ITEMS, { label: "USERS", href: "/admin/users" }]
    : NAV_ITEMS;

  const linkStyle = { fontFamily: "'Cinzel', serif", color: "#4ecdc4" };

  return (
    <header style={{ backgroundColor: "#081519", borderBottom: "1px solid #1e3d45" }}>
      <div className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">

        {/* ロゴ */}
        <Link href="/" className="text-xl font-bold tracking-widest hover:opacity-80 transition" style={linkStyle}>
          Never Land Scheduler
        </Link>

        {/* PCナビ */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map(({ label, href }) => (
            <Link key={label} href={href} className="tracking-widest hover:opacity-70 transition" style={linkStyle}>
              {label}
            </Link>
          ))}

          {session && (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <img src={session.user.image} alt="avatar" className="w-8 h-8 rounded-full" style={{ border: "1px solid #4ecdc4" }} />
              )}
              <button
                onClick={() => signOut()}
                className="px-4 py-2 rounded-full text-sm tracking-widest transition"
                style={{ backgroundColor: "#4ecdc4", color: "#0b1a14", fontFamily: "'Cinzel', serif", fontWeight: "700" }}
              >
                Logout
              </button>
            </div>
          )}
        </nav>

        {/* ハンバーガーボタン（スマホ） */}
        <button className="md:hidden flex flex-col gap-1.5" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="block w-6 h-0.5" style={{ backgroundColor: "#4ecdc4" }} />
          <span className="block w-6 h-0.5" style={{ backgroundColor: "#4ecdc4" }} />
          <span className="block w-6 h-0.5" style={{ backgroundColor: "#4ecdc4" }} />
        </button>
      </div>

      {/* スマホメニュー */}
      {menuOpen && (
        <div className="md:hidden flex flex-col gap-4 px-8 pb-6 text-sm" style={{ borderTop: "1px solid #1e3d45" }}>
          {navItems.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="tracking-widest hover:opacity-70 transition"
              style={linkStyle}
            >
              {label}
            </Link>
          ))}

          {session && (
            <div className="flex items-center gap-3 mt-2">
              {session.user?.image && (
                <img src={session.user.image} alt="avatar" className="w-8 h-8 rounded-full" style={{ border: "1px solid #4ecdc4" }} />
              )}
              <span style={{ color: "#e8f5f0", fontFamily: "'Cinzel', serif", fontSize: "0.8rem" }}>
                {session.user?.name}
              </span>
              <button
                onClick={() => { signOut(); setMenuOpen(false); }}
                className="px-4 py-2 rounded-full text-sm tracking-widest transition"
                style={{ backgroundColor: "#4ecdc4", color: "#0b1a14", fontFamily: "'Cinzel', serif", fontWeight: "700" }}
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
