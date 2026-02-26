"use client"

import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <button
        onClick={() =>
          signIn("discord", {
            callbackUrl: "/event", // 🔥 戻り先指定
          })
        }
        className="px-6 py-3 bg-indigo-600 rounded-xl"
      >
        Discordでログイン
      </button>
    </div>
  )
}