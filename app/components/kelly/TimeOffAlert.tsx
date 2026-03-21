"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PendingTimeOffRequest = {
  id: number;
};

export default function TimeOffAlert() {
  const [count, setCount] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPendingRequests() {
      try {
        const res = await fetch("/api/kelly/time-off?status=pending", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load pending time-off requests");
        }

        const data: PendingTimeOffRequest[] = await res.json();

        if (!active) return;

        setCount(Array.isArray(data) ? data.length : 0);
        setLoaded(true);
      } catch (error) {
        console.error("Failed to load pending time-off requests", error);

        if (!active) return;

        setCount(0);
        setLoaded(true);
      }
    }

    loadPendingRequests();

    return () => {
      active = false;
    };
  }, []);

  if (!loaded || count <= 0) {
    return null;
  }

  return (
    <Link
      href="/kelly/time-off"
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        marginBottom: 20,
      }}
    >
      <section
        style={{
          border: "1px solid #fde68a",
          borderRadius: 18,
          background: "#fffbeb",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#a16207",
                marginBottom: 6,
              }}
            >
              Kelly action needed
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#18181b",
                marginBottom: 4,
              }}
            >
              ⚠️ {count} pending time-off request{count === 1 ? "" : "s"}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#713f12",
              }}
            >
              Review and approve holidays, time off, and availability changes.
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              border: "1px solid #facc15",
              background: "#facc15",
              color: "#18181b",
              fontSize: 14,
              fontWeight: 800,
              padding: "12px 14px",
              minWidth: 140,
            }}
          >
            Review now
          </div>
        </div>
      </section>
    </Link>
  );
}