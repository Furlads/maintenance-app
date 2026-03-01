"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  workerName: string;
  role?: string;
};

export default function UserMenu() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (data?.workerName) {
          setSession(data);
        }
      });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (!session) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 600 }}>{session.workerName}</div>
        {session.role && (
          <div style={{ fontSize: 12, opacity: 0.6 }}>{session.role}</div>
        )}
      </div>

      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#111",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
        }}
      >
        {session.workerName.charAt(0)}
      </div>

      <button
        onClick={() => router.push("/settings")}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "white",
        }}
      >
        Settings
      </button>

      <button
        onClick={logout}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "white",
        }}
      >
        Logout
      </button>
    </div>
  );
}