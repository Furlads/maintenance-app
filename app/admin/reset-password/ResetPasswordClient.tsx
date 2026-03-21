"use client";

import { useEffect, useMemo, useState } from "react";

type Worker = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  active: boolean;
};

type Props = {
  initialWorkerId: number | null;
};

export default function ResetPasswordClient({ initialWorkerId }: Props) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadWorkers() {
    try {
      const res = await fetch("/api/admin/workers", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load workers");
      }

      setWorkers(Array.isArray(data?.workers) ? data.workers : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load workers");
    }
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  useEffect(() => {
    if (Number.isInteger(initialWorkerId) && (initialWorkerId ?? 0) > 0) {
      setSelectedWorkerId(initialWorkerId as number);
    }
  }, [initialWorkerId]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [workers, selectedWorkerId]
  );

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!selectedWorkerId) {
      setMessage("Please choose a worker");
      return;
    }

    if (!password || password.length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workerId: selectedWorkerId,
          newPassword: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to reset password");
      }

      setPassword("");
      setMessage(`✅ Password reset for ${selectedWorker?.fullName || "worker"}`);
    } catch (error: any) {
      setMessage(error?.message || "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
        FURLADS ADMIN
      </div>

      <h1 style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 950 }}>
        Reset worker password
      </h1>

      <p style={{ opacity: 0.75, marginTop: 8 }}>
        Set a temporary password, then ask the worker to log in and change it.
      </p>

      {message ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          {message}
        </div>
      ) : null}

      <form
        onSubmit={handleReset}
        style={{
          marginTop: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <select
          value={selectedWorkerId}
          onChange={(e) =>
            setSelectedWorkerId(e.target.value ? Number(e.target.value) : "")
          }
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d4d4d8",
          }}
        >
          <option value="">Select worker</option>
          {workers
            .filter((worker) => worker.active)
            .map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.fullName}
                {worker.email ? ` (${worker.email})` : ""}
              </option>
            ))}
        </select>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New temporary password"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d4d4d8",
          }}
        />

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "fit-content",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {busy ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </main>
  );
}