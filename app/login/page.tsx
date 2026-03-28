"use client";

import { useEffect, useRef, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

type WorkerSummary = {
  id: number;
  name: string;
  accessLevel: string;
  photoUrl?: string | null;
};

type LoginResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
  mustChangePassword?: boolean;
  worker?: WorkerSummary;
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

function saveWorkerSession(worker: WorkerSummary) {
  const id = String(worker.id);
  const name = String(worker.name || "").trim();
  const accessLevel = String(worker.accessLevel || "worker").trim();
  const photoUrl = String(worker.photoUrl || "").trim();

  localStorage.setItem("workerId", id);
  localStorage.setItem("workerName", name);
  localStorage.setItem("lastWorkerId", id);
  localStorage.setItem("lastWorkerName", name);
  localStorage.setItem("lastWorkerAccessLevel", accessLevel);

  if (photoUrl) {
    localStorage.setItem("workerPhotoUrl", photoUrl);
    localStorage.setItem("photoUrl", photoUrl);
  } else {
    localStorage.removeItem("workerPhotoUrl");
    localStorage.removeItem("photoUrl");
  }
}

function saveWorkerSessionFromSelectedWorkerFallback() {
  const selectedWorkerId = localStorage.getItem("selectedLoginWorkerId");
  const selectedWorkerName = localStorage.getItem("selectedLoginWorkerName");
  const selectedWorkerPhotoUrl =
    localStorage.getItem("selectedLoginWorkerPhotoUrl") || "";

  if (selectedWorkerId && selectedWorkerName) {
    localStorage.setItem("workerId", selectedWorkerId);
    localStorage.setItem("workerName", selectedWorkerName);
    localStorage.setItem("lastWorkerId", selectedWorkerId);
    localStorage.setItem("lastWorkerName", selectedWorkerName);

    if (selectedWorkerPhotoUrl) {
      localStorage.setItem("workerPhotoUrl", selectedWorkerPhotoUrl);
      localStorage.setItem("photoUrl", selectedWorkerPhotoUrl);
    }
  }
}

function persistBestKnownWorker(worker: WorkerSummary | null) {
  if (worker) {
    saveWorkerSession(worker);
    return;
  }

  saveWorkerSessionFromSelectedWorkerFallback();
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
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [postLoginWorkerPhone, setPostLoginWorkerPhone] = useState("");
  const [postLoginRedirectTo, setPostLoginRedirectTo] = useState("/today");
  const [postLoginWorker, setPostLoginWorker] = useState<WorkerSummary | null>(
    null
  );
  const [isOffline, setIsOffline] = useState(false);

  const autoStartedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    function syncOnlineState() {
      setIsOffline(!navigator.onLine);
    }

    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

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
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const shouldAutostart = params.get("autostart") === "1";

      if (!shouldAutostart) return;
      if (!phone.trim()) return;
      if (autoStartedRef.current) return;
      if (isOffline) return;

      autoStartedRef.current = true;
      void handleQuickLogin();
    } catch (err) {
      console.error(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, phone, isOffline]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data: LoginResponse | null = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Invalid login details");
      }

      const redirectTo = data?.redirectTo || "/today";

      persistBestKnownWorker(data?.worker || null);

      if (data?.mustChangePassword) {
        cleanupSelectedWorkerStorage();
        window.location.href = "/change-password";
        return;
      }

      setPostLoginWorkerPhone(phone.trim());
      setPostLoginRedirectTo(redirectTo);
      setPostLoginWorker(data?.worker || null);
      setShowPasskeyPrompt(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin() {
    setLoading(true);
    setError("");

    try {
      const trimmedPhone = phone.trim();

      if (!trimmedPhone) {
        throw new Error("Enter your phone number first");
      }

      const startRes = await fetch("/api/auth/webauthn/login/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: trimmedPhone }),
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

      const finishData: LoginResponse | null = await finishRes
        .json()
        .catch(() => null);

      if (!finishRes.ok || !finishData?.ok) {
        throw new Error(finishData?.error || "Face ID failed");
      }

      persistBestKnownWorker(finishData?.worker || null);

      saveQuickLoginSettings(trimmedPhone);
      cleanupSelectedWorkerStorage();

      if (finishData?.mustChangePassword) {
        window.location.href = "/change-password";
        return;
      }

      if (finishData?.redirectTo) {
        window.location.href = finishData.redirectTo;
        return;
      }

      window.location.href = "/today";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Quick login failed");
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

      persistBestKnownWorker(postLoginWorker);
      saveQuickLoginSettings(postLoginWorkerPhone);
      cleanupSelectedWorkerStorage();
      window.location.href = postLoginRedirectTo;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to enable quick login"
      );
      setShowPasskeyPrompt(false);
    } finally {
      setLoading(false);
    }
  }

  function handleSkipQuickLogin() {
    persistBestKnownWorker(postLoginWorker);
    clearQuickLoginSettings();
    cleanupSelectedWorkerStorage();
    window.location.href = postLoginRedirectTo;
  }

  if (!mounted) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background:
            "linear-gradient(180deg, #f7f7f2 0%, #eef2e7 50%, #f7f7f2 100%)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 16px 50px rgba(0,0,0,0.12)",
              border: "1px solid #e8e8e8",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 220,
                background: "#f3f3f3",
              }}
            />
            <div style={{ padding: 24 }}>
              <h1
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111",
                }}
              >
                Furlads Login
              </h1>
              <p style={{ color: "#555", margin: 0 }}>Loading login...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background:
          "linear-gradient(180deg, #f7f7f2 0%, #eef2e7 50%, #f7f7f2 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 16px 50px rgba(0,0,0,0.12)",
            border: "1px solid #e8e8e8",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 220,
              overflow: "hidden",
              background: "#f3f3f3",
            }}
          >
            <img
              src="/login-hero.png"
              alt="Furlads and Three Counties landscaping and garden maintenance"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.35) 100%)",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 16,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.92)",
                  padding: "10px 14px",
                  borderRadius: 14,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
                  maxWidth: "100%",
                }}
              >
                <img
                  src="/login-logo.png"
                  alt="Furlads and Three Counties"
                  style={{
                    height: 44,
                    width: "auto",
                    display: "block",
                    objectFit: "contain",
                    maxWidth: "100%",
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: 28,
                fontWeight: 800,
                color: "#111",
              }}
            >
              Welcome back
            </h1>

            <p
              style={{
                margin: "0 0 20px 0",
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              Log in to view jobs, schedules, and field updates.
            </p>

            {isOffline && (
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
              type="button"
              onClick={handleQuickLogin}
              disabled={loading || isOffline}
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
                opacity: isOffline ? 0.6 : 1,
                cursor: loading || isOffline ? "not-allowed" : "pointer",
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
                autoComplete="username"
                data-lpignore="true"
                data-1p-ignore="true"
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
                  autoComplete="current-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
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
                    cursor: "pointer",
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
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
          </div>
        </div>
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
                type="button"
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
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Setting up..." : "Yes, enable quick login"}
              </button>

              <button
                type="button"
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
                  cursor: loading ? "not-allowed" : "pointer",
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