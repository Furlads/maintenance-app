"use client";

import { useEffect } from "react";

function norm(v: string) {
  return (v || "").trim().toLowerCase();
}

export default function KellyEntryPage() {
  useEffect(() => {
    const who = norm(localStorage.getItem("workerName") || "");
    if (!who) {
      window.location.href = "/";
      return;
    }

    window.location.href = `/kelly/combined?as=${encodeURIComponent(who)}`;
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      Redirecting…
    </div>
  );
}