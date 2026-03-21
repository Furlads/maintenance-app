"use client";

import { useState } from "react";

type ChangePasswordResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
};

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("red");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessageColor("red");
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setMessageColor("red");
      setMessage("New password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data: ChangePasswordResponse = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to change password");
      }

      setMessageColor("green");
      setMessage("Password updated successfully");

      setTimeout(() => {
        window.location.href = data.redirectTo || "/today";
      }, 900);
    } catch (err: any) {
      setMessageColor("red");
      setMessage(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1 style={{ marginBottom: 10 }}>Change Password</h1>

        <p style={{ marginTop: 0, marginBottom: 20, color: "#555", lineHeight: 1.5 }}>
          Before continuing, please change your temporary password.
        </p>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <input
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 6,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              style={{
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#f3f3f3",
                color: "#111",
                fontWeight: 700,
                minWidth: 72,
              }}
            >
              {showCurrentPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 6,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              style={{
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#f3f3f3",
                color: "#111",
                fontWeight: 700,
                minWidth: 72,
              }}
            >
              {showNewPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 6,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              style={{
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#f3f3f3",
                color: "#111",
                fontWeight: 700,
                minWidth: 72,
              }}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              background: "black",
              color: "white",
              border: "none",
              borderRadius: 6,
            }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 10, color: messageColor }}>{message}</p>
        )}
      </div>
    </main>
  );
}