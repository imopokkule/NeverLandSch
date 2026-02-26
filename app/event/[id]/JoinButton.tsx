"use client"

import { useState } from "react"

export default function JoinButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false)

  async function join() {
    setLoading(true)

    await fetch("/api/join", {
      method: "POST",
      body: JSON.stringify({ eventId }),
    })

    location.reload()
  }

  return (
    <button
      onClick={join}
      disabled={loading}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      参加する
    </button>
  )
}