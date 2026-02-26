"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0b1a14" }}
    >
      <div className="text-center space-y-10">

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
            style={{ fontFamily: "'Cinzel', serif", color: "#d4e8e0" }}
          >
            Scheduler
          </h2>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/event"
            className="px-8 py-4 rounded-xl transition text-sm tracking-widest"
            style={{
              backgroundColor: "#4ecdc4",
              color: "#0b1a14",
              fontFamily: "'Cinzel', serif",
              fontWeight: "700",
            }}
          >
            EVENTS
          </Link>

          <Link
            href="/event/create"
            className="px-8 py-4 rounded-xl transition text-sm tracking-widest"
            style={{
              border: "1px solid #4ecdc4",
              color: "#4ecdc4",
              fontFamily: "'Cinzel', serif",
            }}
          >
            CREATE
          </Link>

          <Link
            href="/schedule"
            className="px-8 py-4 rounded-xl transition text-sm tracking-widest"
            style={{
              border: "1px solid #4ecdc4",
              color: "#4ecdc4",
              fontFamily: "'Cinzel', serif",
            }}
          >
            SCHEDULE
          </Link>
        </div>
      </div>
    </main>
  );
}
