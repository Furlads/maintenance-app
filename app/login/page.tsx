"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const phoneFromQuery = params.get("phone");
      const phoneFromStorage = localStorage.getItem("selectedLoginWorkerPhone");

      if (phoneFromQuery && phoneFromQuery.trim()) {
        setPhone(phoneFromQuery.trim());
        return;
      }

      if (phoneFromStorage && phoneFromStorage.trim()) {
        setPhone(phoneFromStorage.trim());
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

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

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Invalid login details");
      }

      if (data?.redirectTo) {
        window.location.href = data.redirectTo;
        return;
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
      if (!phone.trim()) {
        throw new Error("Enter your phone number first");
      }

      const startRes = await fetch("/api/auth/webauthn/login/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const startData = await startRes.json().catch(() => null);

      if (!startRes.ok) {
        throw new Error(startData?.error || "Quick login not available");
      }

      const credential = await navigator.credentials.get({
        publicKey: startData.options,
      });

      const verifyRes = await fetch("/api/auth/webauthn/login/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credential),
      });

      const verifyData = await verifyRes.json().catch(() => null);

      if (!verifyRes.ok || !verifyData?.ok) {
        throw new Error(verifyData?.error || "Face ID failed");
      }

      if (verifyData?.redirectTo) {
        window.location.href = verifyData.redirectTo;
        return;
      }

      window.location.href = "/today";
    } catch (err: any) {
      setError(err.message || "Quick login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableFaceId() {
    try {
      if (!phone.trim() || !password) {
        alert("Enter phone number and password first");
        return;
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const loginData = await loginRes.json().catch(() => null);

      if (!loginRes.ok || !loginData?.ok) {
        alert(loginData?.error || "Login first to enable Face ID");
        return;
      }

      const registerRes = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const registerData = await registerRes.json().catch(() => null);

      if (!registerRes.ok) {
        alert(registerData?.error || "Could not start Face ID setup");
        return;
      }

      await navigator.credentials.create({
        publicKey: registerData.options,
      });

      alert("Face ID enabled on this device");
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

        {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      </div>
    </main>
  );
}