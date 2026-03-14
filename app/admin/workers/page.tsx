"use client";

import React, { useEffect, useMemo, useState } from "react";

type Worker = {
  id: string;
  name: string;
  phone: string;
  role?: string | null;
  photoUrl?: string | null;
  archivedAt?: string | null;
  createdAt?: string;
};

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "W";
}

export default function WorkersAdminPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadWorkers() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/workers", { cache: "no-store" });
      if (!res.ok) throw new Error(`GET /api/workers failed: ${res.status}`);
      const json = await res.json();
      setWorkers(Array.isArray(json?.workers) ? json.workers : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  const activeWorkers = useMemo(() => workers.filter((w) => !w.archivedAt), [workers]);

  const archivedWorkers = useMemo(() => workers.filter((w) => !!w.archivedAt), [workers]);

  const visibleWorkers = useMemo(() => {
    if (filter === "active") return activeWorkers;
    if (filter === "archived") return archivedWorkers;
    return workers;
  }, [workers, activeWorkers, archivedWorkers, filter]);

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          role: role.trim() || null,
          photoUrl: photoUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`POST /api/workers failed: ${res.status} ${txt}`);
      }

      setName("");
      setPhone("");
      setRole("");
      setPhotoUrl("");

      await loadWorkers();
    } catch (e: any) {
      setErr(e?.message || "Failed to add worker");
    } finally {
      setSaving(false);
    }
  }

  function StatCard({
    label,
    value,
    active,
    onClick,
  }: {
    label: string;
    value: number;
    active?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        style={{
          border: active ? "2px solid #111" : "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 14,
          background: active ? "#111" : "#fff",
          color: active ? "#fff" : "#111",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      </button>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Workers</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Manage active workers (archived workers are hidden).
          </div>
        </div>

        <button
          onClick={() => loadWorkers()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ color: "crimson", marginTop: 12, marginBottom: 12 }}>
          Error: {err}
        </div>
      )}

      {/* STATS */}
      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 10,
        }}
      >
        <StatCard
          label="Active workers"
          value={activeWorkers.length}
          active={filter === "active"}
          onClick={() => setFilter("active")}
        />

        <StatCard
          label="Archived workers"
          value={archivedWorkers.length}
          active={filter === "archived"}
          onClick={() => setFilter("archived")}
        />

        <StatCard
          label="Total workers"
          value={workers.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
      </section>

      {/* ADD WORKER */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Add worker</div>

        <form onSubmit={addWorker} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Name"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="Phone"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
            />
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
            />

            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Photo URL"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: saving ? "#f3f4f6" : "#111827",
              color: saving ? "#111827" : "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {saving ? "Saving…" : "Add worker"}
          </button>
        </form>
      </section>

      {/* WORKER LIST */}
      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Workers</div>

        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : visibleWorkers.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No workers found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleWorkers.map((w) => {
              const hasPhoto = !!w.photoUrl;

              return (
                <div
                  key={w.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {hasPhoto ? (
                      <img
                        src={w.photoUrl!}
                        alt={w.name}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "999px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "999px",
                          background: "#111",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 800,
                        }}
                      >
                        {initials(w.name)}
                      </div>
                    )}

                    <div>
                      <div style={{ fontWeight: 800 }}>{w.name}</div>
                      <div style={{ opacity: 0.75 }}>
                        {w.role ? `${w.role} • ` : ""}
                        {w.phone}
                      </div>
                    </div>
                  </div>

                  {w.phone && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <a href={`tel:${w.phone}`}>Call</a>
                      <a
                        href={`https://wa.me/${w.phone.replace(/\s+/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
