// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Me = {
  authenticated: boolean;
  name?: string;
  role?: string;
  isAdmin?: boolean;
};

export default function HomePage() {
  const [username, setUsername] = useState("trevor@furlads.com");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [me, setMe] = useState<Me>({ authenticated: false });

  const nextParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
      credentials: "include", // <-- IMPORTANT: send cookies
      headers: { "Cache-Control": "no-store" },
    });

    const data = (await res.json().catch(() => ({ authenticated: false }))) as Me;
    setMe(data);
    return data;
  }

  useEffect(() => {
    loadMe();
  }, []);

  // If already logged in, leave login screen
  useEffect(() => {
    if (me.authenticated) {
      window.location.href = nextParam || "/today";
    }
  }, [me.authenticated, nextParam]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // <-- IMPORTANT: accept Set-Cookie + include cookies
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      setMsg(data?.error || "Login failed");
      return;
    }

    // Now confirm cookie is present by calling /me
    const after = await loadMe();
    if (after.authenticated) {
      window.location.href = nextParam || "/today";
      return;
    }

    setMsg("Login succeeded but session cookie was not detected. (Check ma_session cookie)");
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ marginBottom: 12, fontSize: 14 }}>
        {me.authenticated ? (
          <>
            Logged in as: <b>{me.name}</b> • Role: <b>{me.role}</b>
          </>
        ) : (
          <>Not logged in</>
        )}
      </div>

      <h1 style={{ marginBottom: 6 }}>Furlads Maintenance Admin</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Sign in to continue.</p>

      <form onSubmit={submit} style={{ marginTop: 14 }}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <div style={{ height: 14 }} />

        <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <button type="submit" style={{ marginTop: 16, width: "100%", padding: "12px 14px", borderRadius: 10 }}>
          Sign in
        </button>

        {msg ? (
          <div style={{ marginTop: 12, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>
            {msg}
          </div>
        ) : null}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
          First login password is <b>firstname123</b> (e.g. <b>jacob123</b>) then you’ll be asked to change it.
        </div>
      </form>
    </main>
  );
}