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

  async function handleQuickLogin() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/webauthn/login/start", {
        method: "POST",
      });

      const options = await res.json();

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
        throw new Error("Quick login failed");
      }

      window.location.href = "/today";
    } catch (err: any) {
      setError("Quick login not available on this device");
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

        {error && (
          <p style={{ color: "red", marginTop: 10 }}>{error}</p>
        )}
      </div>
    </main>
  );
}