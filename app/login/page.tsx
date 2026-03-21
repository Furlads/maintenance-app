"use client";

import { useEffect, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

type LoginResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
  worker?: {
    id: number;
    name: string;
    accessLevel: string;
  };
};

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [postLoginWorkerPhone, setPostLoginWorkerPhone] = useState("");
  const [postLoginRedirectTo, setPostLoginRedirectTo] = useState("/today");

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

  function cleanupSelectedWorkerStorage() {
    localStorage.removeItem("selectedLoginWorkerId");
    localStorage.removeItem("selectedLoginWorkerName");
    localStorage.removeItem("selectedLoginWorkerPhone");
  }

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

      const data: LoginResponse | null = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Invalid login details");
      }

      const redirectTo = data?.redirectTo || "/today";

      setPostLoginWorkerPhone(phone.trim());
      setPostLoginRedirectTo(redirectTo);
      setShowPasskeyPrompt(true);
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
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const startData = await startRes.json().catch(() => null);

      if (!startRes.ok || !startData?.ok || !startData?.options) {
        throw new Error(startData?.error || "Quick login not available");
      }

      const authenticationResponse = await startAuthentication({
        optionsJSON: startData.options,
      });

      const finishRes = await fetch("/api/auth/webauthn/login/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authenticationResponse),
      });

      const finishData = await finishRes.json().catch(() => null);

      if (!finishRes.ok || !finishData?.ok) {
        throw new Error(finishData?.error || "Face ID failed");
      }

      cleanupSelectedWorkerStorage();

      if (finishData?.redirectTo) {
        window.location.href = finishData.redirectTo;
        return;
      }

      window.location.href = "/today";
    } catch (err: any) {
      setError(err.message || "Quick login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableQuickLogin() {
    setLoading(true);
    setError("");

    try {
      const startRes = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: postLoginWorkerPhone }),
      });

      const startData = await startRes.json().catch(() => null);

      if (!startRes.ok || !startData?.ok || !startData?.options) {
        throw new Error(startData?.error || "Could not start Face ID setup");
      }

      const registrationResponse = await startRegistration({
        optionsJSON: startData.options,
      });

      const finishRes = await fetch("/api/auth/webauthn/register", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: postLoginWorkerPhone,
          credential: registrationResponse,
        }),
      });

      const finishData = await finishRes.json().catch(() => null);

      if (!finishRes.ok || !finishData?.ok) {
        throw new Error(finishData?.error || "Could not save Face ID");
      }

      cleanupSelectedWorkerStorage();
      window.location.href = postLoginRedirectTo;
    } catch (err: any) {
      setError(err.message || "Failed to enable quick login");
      setShowPasskeyPrompt(false);
    } finally {
      setLoading(false);
    }
  }

  function handleSkipQuickLogin() {
    cleanupSelectedWorkerStorage();
    window.location.href = postLoginRedirectTo;
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
          <small>or use phone &amp; password</small>
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

        {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      </div>

      {showPasskeyPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h2
              style={{
                margin: "0 0 10px 0",
                fontSize: 22,
                lineHeight: 1.2,
              }}
            >
              Use Face ID / fingerprint on this phone next time?
            </h2>

            <p
              style={{
                margin: "0 0 18px 0",
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              This makes login much faster when you&apos;re out in the field.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={handleEnableQuickLogin}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "black",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                {loading ? "Setting up..." : "Yes, enable quick login"}
              </button>

              <button
                onClick={handleSkipQuickLogin}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#f3f3f3",
                  color: "#111",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}