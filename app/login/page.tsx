"use client";

import { useEffect, useRef, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

type LoginResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
  mustChangePassword?: boolean;
  worker?: {
    id: number;
    name: string;
    accessLevel: string;
  };
};

function saveQuickLoginSettings(phone: string) {
  localStorage.setItem("quickLoginEnabled", "true");
  localStorage.setItem("quickLoginPhone", phone.trim());
}

function clearQuickLoginSettings() {
  localStorage.removeItem("quickLoginEnabled");
  localStorage.removeItem("quickLoginPhone");
}

function cleanupSelectedWorkerStorage() {
  localStorage.removeItem("selectedLoginWorkerId");
  localStorage.removeItem("selectedLoginWorkerName");
  localStorage.removeItem("selectedLoginWorkerPhone");
  localStorage.removeItem("selectedLoginWorkerPhotoUrl");
}

function saveLastLoggedInWorker(worker: {
  id: number;
  name: string;
  accessLevel: string;
}) {
  localStorage.setItem("lastWorkerId", String(worker.id));
  localStorage.setItem("lastWorkerName", worker.name);
  localStorage.setItem("lastWorkerAccessLevel", worker.accessLevel);
}

function isAlreadyRegisteredPasskeyError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
      ? error.message
      : "";

  const text = message.toLowerCase();

  return (
    text.includes("previously registered") ||
    text.includes("already registered") ||
    text.includes("already been registered")
  );
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [postLoginWorkerPhone, setPostLoginWorkerPhone] = useState("");
  const [postLoginRedirectTo, setPostLoginRedirectTo] = useState("/today");
  const [postLoginWorker, setPostLoginWorker] = useState<{
    id: number;
    name: string;
    accessLevel: string;
  } | null>(null);

  const autoStartedRef = useRef(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const phoneFromQuery = params.get("phone");
      const phoneFromStorage = localStorage.getItem("selectedLoginWorkerPhone");
      const quickLoginPhone = localStorage.getItem("quickLoginPhone");

      if (phoneFromQuery && phoneFromQuery.trim()) {
        setPhone(phoneFromQuery.trim());
        return;
      }

      if (phoneFromStorage && phoneFromStorage.trim()) {
        setPhone(phoneFromStorage.trim());
        return;
      }

      if (quickLoginPhone && quickLoginPhone.trim()) {
        setPhone(quickLoginPhone.trim());
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shouldAutostart = params.get("autostart") === "1";

      if (!shouldAutostart) return;
      if (!phone.trim()) return;
      if (autoStartedRef.current) return;

      autoStartedRef.current = true;

      void handleQuickLogin();
    } catch (err) {
      console.error(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

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

      if (data?.worker) {
        saveLastLoggedInWorker(data.worker);
      }

      if (data?.mustChangePassword) {
        cleanupSelectedWorkerStorage();
        window.location.href = "/change-password";
        return;
      }

      setPostLoginWorkerPhone(phone.trim());
      setPostLoginRedirectTo(redirectTo);
      setPostLoginWorker(data?.worker || null);
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

      if (postLoginWorker) {
        saveLastLoggedInWorker(postLoginWorker);
      } else {
        const selectedWorkerId = localStorage.getItem("selectedLoginWorkerId");
        const selectedWorkerName = localStorage.getItem("selectedLoginWorkerName");

        if (selectedWorkerId && selectedWorkerName) {
          localStorage.setItem("lastWorkerId", selectedWorkerId);
          localStorage.setItem("lastWorkerName", selectedWorkerName);
        }
      }

      saveQuickLoginSettings(phone.trim());
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

      try {
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
      } catch (registrationError) {
        if (!isAlreadyRegisteredPasskeyError(registrationError)) {
          throw registrationError;
        }
      }

      if (postLoginWorker) {
        saveLastLoggedInWorker(postLoginWorker);
      }

      saveQuickLoginSettings(postLoginWorkerPhone);
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
    if (postLoginWorker) {
      saveLastLoggedInWorker(postLoginWorker);
    }

    clearQuickLoginSettings();
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

        {typeof navigator !== "undefined" && !navigator.onLine && (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #efcf72",
              background: "#fff7d6",
              color: "#5f4a00",
              lineHeight: 1.45,
            }}
          >
            No signal. Quick login needs a live connection for now.
          </div>
        )}

        <button
          onClick={handleQuickLogin}
          disabled={loading || (typeof navigator !== "undefined" && !navigator.onLine)}
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
            opacity:
              typeof navigator !== "undefined" && !navigator.onLine ? 0.6 : 1,
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
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              onClick={() => setShowPassword((prev) => !prev)}
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
              {showPassword ? "Hide" : "Show"}
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