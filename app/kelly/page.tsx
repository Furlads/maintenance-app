"use client";

import { useEffect } from "react";

type AuthMeResponse = {
  authenticated?: boolean;
  name?: string | null;
  role?: string | null;
};

function norm(value: string) {
  return (value || "").trim().toLowerCase();
}

function isAdminLikeRole(role: string | null | undefined) {
  const value = norm(role || "");

  return (
    value === "admin" ||
    value === "office" ||
    value === "manager" ||
    value === "owner"
  );
}

export default function KellyEntryPage() {
  useEffect(() => {
    async function boot() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });

        const data: AuthMeResponse | null = await res.json().catch(() => null);

        if (!res.ok || !data?.authenticated || !data?.name) {
          window.location.href = "/login";
          return;
        }

        if (!isAdminLikeRole(data.role)) {
          window.location.href = "/";
          return;
        }

        window.location.href = `/kelly/combined?as=${encodeURIComponent(
          norm(data.name)
        )}`;
      } catch (error) {
        console.error("Failed to load Kelly session:", error);
        window.location.href = "/login";
      }
    }

    void boot();
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