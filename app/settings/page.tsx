"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  async function changePassword() {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();

    if (data.error) {
      setMessage(data.error);
    } else {
      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    }
  }

  return (
    <div style={{ maxWidth: 400 }}>
      <h1>Settings</h1>

      <h3>Change Password</h3>

      <input
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={e => setCurrentPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <input
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <button onClick={changePassword}>Update Password</button>

      {message && (
        <p style={{ marginTop: 10, color: "green" }}>{message}</p>
      )}
    </div>
  );
}