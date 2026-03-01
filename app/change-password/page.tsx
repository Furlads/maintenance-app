"use client";

import { useState } from "react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update password");

      setMsg("✅ Password updated. Redirecting…");
      setTimeout(() => {
        window.location.href = "/admin";
      }, 500);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ marginBottom: 6 }}>Change password</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        First login requires you to change your password.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Current password</span>
          <input
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            type="password"
            required
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>New password</span>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            required
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <span style={{ fontSize: 12, opacity: 0.65 }}>Minimum 6 characters.</span>
        </label>

        <button
          disabled={saving}
          type="submit"
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            fontWeight: 800,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Update password"}
        </button>

        {msg ? (
          <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
            {msg}
          </div>
        ) : null}
      </form>
    </main>
  );
}