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

  const activeWorkers = useMemo(() => {
    return workers.filter((w) => !w.archivedAt);
  }, [workers]);

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

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Workers</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Manage active workers (archived workers are hidden).</div>
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

      {err ? (
        <div style={{ color: "crimson", marginTop: 12, marginBottom: 12 }}>Error: {err}</div>
      ) : null}

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
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jacob Walters"
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="07400 000000"
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Role (optional)</span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Junior Landscaper"
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Photo URL (optional)</span>
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="/uploads/jacob.jpg"
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
          </div>
        </form>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Active workers</div>

        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : activeWorkers.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No active workers.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {activeWorkers.map((w) => {
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {hasPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.photoUrl!}
                        alt={w.name}
                        style={{ width: 42, height: 42, borderRadius: "999px", objectFit: "cover" }}
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

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {w.name}
                      </div>
                      <div style={{ opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {w.role ? `${w.role} • ` : ""}
                        {w.phone}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {w.phone ? (
                      <>
                        <a
                          href={`tel:${w.phone}`}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#111",
                            fontWeight: 700,
                          }}
                        >
                          Call
                        </a>
                        <a
                          href={`https://wa.me/${w.phone.replace(/\s+/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#111",
                            fontWeight: 700,
                          }}
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}