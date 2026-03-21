"use client";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      if (!res.ok) {
        throw new Error("Invalid login details");
      }

      window.location.href = "/today";
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // ✅ FIXED FACE ID LOGIN
  async function handleQuickLogin() {
    setLoading(true);
    setError("");

    try {
      if (!phone) {
        throw new Error("Enter your phone number first");
      }

      const startRes = await fetch("/api/auth/webauthn/login/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      if (!startRes.ok) {
        throw new Error("No Face ID set up for this user");
      }

      const { options } = await startRes.json();

      const credential = await navigator.credentials.get({
        publicKey: options,
      });

      const verifyRes = await fetch("/api/auth/webauthn/login/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) {
        throw new Error("Face ID failed");
      }

      window.location.href = "/today";
    } catch (err: any) {
      setError(err.message || "Quick login failed");
    } finally {
      setLoading(false);
    }
  }

  // ✅ TEMP: ENABLE FACE ID (setup only)
  async function handleEnableFaceId() {
    try {
      if (!phone) {
        alert("Enter phone number first");
        return;
      }

      // get worker by phone
      const resUser = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      if (!resUser.ok) {
        alert("Login first to enable Face ID");
        return;
      }

      const startRes = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });

      const options = await startRes.json();

      await navigator.credentials.create({
        publicKey: options,
      });

      alert("Face ID enabled on this device ✅");
    } catch (err) {
      console.error(err);
      alert("Failed to enable Face ID");
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
        <h1 style={{ marginBottom: 20 }}>Furlads Login</h1>

        {/* 🔥 Quick Login */}
        <button
          onClick={handleQuickLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            fontSize: 16,
            fontWeight: "bold",
            marginBottom: 16,
            background: "black",
            color: "yellow",
            border: "none",
            borderRadius: 8,
          }}
        >
          {loading ? "Please wait..." : "Quick Login (Face ID / Fingerprint)"}
        </button>

        <div style={{ textAlign: "center", margin: "10px 0" }}>
          <small>or use phone & password</small>
        </div>

        {/* 🔐 Password Login */}
        <form onSubmit={handlePasswordLogin}>
          <input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />

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
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* ✅ TEMP BUTTON (REMOVE LATER) */}
        <button
          onClick={handleEnableFaceId}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 10,
            background: "#eee",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          Enable Face ID (Setup)
        </button>

        {error && (
          <p style={{ color: "red", marginTop: 10 }}>{error}</p>
        )}
      </div>
    </main>
  );
}