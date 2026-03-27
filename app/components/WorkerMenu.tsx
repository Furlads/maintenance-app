"use client";

import { useEffect, useRef, useState } from "react";

export default function WorkerMenu() {
  const [open, setOpen] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [updatingApp, setUpdatingApp] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedWorkerName = localStorage.getItem("workerName") || "";
    setWorkerName(savedWorkerName);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function clearWorkerSession() {
    localStorage.removeItem("workerId");
    localStorage.removeItem("workerName");
    localStorage.removeItem("workerAccessLevel");
  }

  function handleLogout() {
    clearWorkerSession();
    window.location.href = "/";
  }

  function handleSwitchWorker() {
    clearWorkerSession();
    window.location.href = "/";
  }

  async function handleUpdateApp() {
    if (updatingApp) return;

    try {
      setUpdatingApp(true);
      setOpen(false);

      window.alert("Updating app now. The app will restart if possible.");

      if (typeof window !== "undefined" && "caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister())
        );
      }

      const url = new URL(window.location.href);
      url.searchParams.set("updatedAt", String(Date.now()));
      window.location.href = url.toString();
    } catch (error) {
      console.error("Failed to update app:", error);
      window.alert("Changes will apply next time you open the app.");
      setUpdatingApp(false);
    }
  }

  const linkStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "12px 0",
    textDecoration: "none",
    color: "#111",
    fontSize: 17,
    borderBottom: "1px solid #eee",
  };

  const actionButtonStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "12px 0",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #eee",
    textAlign: "left",
    color: "#111",
    fontSize: 17,
    cursor: "pointer",
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#777",
    marginTop: 14,
    marginBottom: 4,
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open menu"
        aria-expanded={open}
        style={{
          width: 54,
          height: 54,
          borderRadius: 12,
          border: "1px solid #d8d8d8",
          background: "#fff",
          fontSize: 28,
          lineHeight: 1,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        ☰
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 0,
            width: 280,
            maxWidth: "calc(100vw - 24px)",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 16,
            boxShadow: "0 14px 34px rgba(0,0,0,0.12)",
            padding: 16,
            zIndex: 200,
          }}
        >
          <div
            style={{
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: "1px solid #eee",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: "#666",
                marginBottom: 4,
              }}
            >
              Logged in as
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#111",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {workerName || "Worker"}
            </div>
          </div>

          <div style={sectionLabelStyle}>Work</div>

          <a href="/today" style={linkStyle} onClick={() => setOpen(false)}>
            Today
          </a>

          <a href="/customers" style={linkStyle} onClick={() => setOpen(false)}>
            Customers
          </a>

          <a href="/jobs" style={linkStyle} onClick={() => setOpen(false)}>
            Jobs
          </a>

          <div style={sectionLabelStyle}>Personal</div>

          <a
            href="/worker/time-off"
            style={linkStyle}
            onClick={() => setOpen(false)}
          >
            My Time Off
          </a>

          <a
            href="/menu/change-pin"
            style={linkStyle}
            onClick={() => setOpen(false)}
          >
            Change PIN
          </a>

          <button
            type="button"
            onClick={handleUpdateApp}
            disabled={updatingApp}
            style={{
              ...actionButtonStyle,
              cursor: updatingApp ? "not-allowed" : "pointer",
              opacity: updatingApp ? 0.6 : 1,
              fontWeight: 700,
            }}
          >
            {updatingApp ? "Updating app..." : "Update App"}
          </button>

          <button
            type="button"
            onClick={handleSwitchWorker}
            style={actionButtonStyle}
          >
            Switch worker
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 0 0 0",
              background: "transparent",
              border: "none",
              textAlign: "left",
              color: "#111",
              fontSize: 17,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}