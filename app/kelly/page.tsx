"use client";

import { useEffect } from "react";

function norm(value: string) {
  return (value || "").trim().toLowerCase();
}

export default function KellyEntryPage() {
  useEffect(() => {
    const workerName = norm(localStorage.getItem("workerName") || "");

    if (!workerName) {
      window.location.href = "/";
      return;
    }

    window.location.href = `/kelly/combined?as=${encodeURIComponent(workerName)}`;
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "#f5f5f5",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          border: "1px solid #e7e7e7",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#71717a",
            marginBottom: 10,
          }}
        >
          Kelly
        </div>

        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: 24,
            lineHeight: 1.1,
            color: "#18181b",
          }}
        >
          Redirecting...
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#52525b",
          }}
        >
          Taking you to the Kelly dashboard.
        </p>
      </div>
    </main>
  );
}