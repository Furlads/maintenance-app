"use client";

import { useEffect, useState } from "react";

const WORKERS = ["stephen", "jacob", "trev", "kelly"];

export default function HomePage() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("workerName") || "";
    if (saved) {
      window.location.href = "/today";
    }
  }, []);

  function setWorkerAndGo(worker: string) {
    const cleaned = worker.trim().toLowerCase();
    if (!cleaned) return;
    localStorage.setItem("workerName", cleaned);
    window.location.href = "/today";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleaned = name.trim().toLowerCase();
    if (!cleaned) {
      setError("Please enter your name.");
      return;
    }

    setWorkerAndGo(cleaned);
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ marginBottom: 6 }}>Maintenance App</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Who are you?
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        {WORKERS.map((w) => (
          <button
            key={w}
            onClick={() => setWorkerAndGo(w)}
            style={{
              padding: "16px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              fontSize: 16,
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            {w}
          </button>
        ))}
      </div>

      <hr style={{ margin: "18px 0" }} />

      <form onSubmit={submit}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
          Or type a name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. stephen"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: "#ffe6e6",
              border: "1px solid #ffb3b3",
              borderRadius: 10,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{ marginTop: 10, width: "100%", padding: "12px 14px", borderRadius: 10 }}
        >
          Continue →
        </button>
      </form>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Kelly shortcuts</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/my-visits">Add jobs</a>
          <a href="/unscheduled">Schedule unscheduled</a>
        </div>
      </div>
    </main>
  );
}