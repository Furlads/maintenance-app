"use client";

import { useEffect, useMemo, useState } from "react";

type Worker = {
  id: number;
  name: string;
  role: string;
  jobTitle?: string | null;
  phone?: string | null;
  active: boolean;
  createdAt?: string;
};

const ROLE_OPTIONS = ["Worker", "Office", "Admin", "Manager", "Owner"] as const;

type RoleOption = (typeof ROLE_OPTIONS)[number];

function safeRole(role: string): RoleOption {
  const match = ROLE_OPTIONS.find(
    (option) => option.toLowerCase() === String(role || "").trim().toLowerCase()
  );
  return match ?? "Worker";
}

export default function WorkerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [workerId, setWorkerId] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [worker, setWorker] = useState<Worker | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleOption>("Worker");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  const whatsappLink = useMemo(() => {
    const digits = (phone || "").replace(/[^\d]/g, "");
    if (!digits) return "";

    const normalized = digits.startsWith("44")
      ? digits
      : digits.startsWith("0")
      ? `44${digits.slice(1)}`
      : digits;

    return `https://wa.me/${normalized}`;
  }, [phone]);

  useEffect(() => {
    (async () => {
      const p = await params;
      setWorkerId(p.id);
    })();
  }, [params]);

  async function load() {
    if (!workerId) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load worker");
      }

      const found = data?.worker ?? null;

      if (!found) {
        setWorker(null);
        setMsg("Worker not found.");
        return;
      }

      setWorker(found);
      setName(found.name ?? "");
      setRole(safeRole(found.role));
      setJobTitle(found.jobTitle ?? "");
      setPhone(found.phone ?? "");
      setActive(!!found.active);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load worker");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  async function save() {
    if (!workerId) return;

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          role,
          jobTitle: jobTitle.trim(),
          phone: phone.trim() || null,
          active,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to save");
      }

      setMsg("✅ Saved");
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!workerId || !worker) return;

    const ok = confirm(
      `${worker.active ? "Archive" : "Unarchive"} ${worker.name}?`
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !worker.active }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to update worker");
      }

      setMsg(
        worker.active
          ? `🗄️ Archived ${worker.name}`
          : `✅ Reactivated ${worker.name}`
      );

      setTimeout(() => {
        window.location.href = "/admin/workers";
      }, 400);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to update worker");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <a href="/admin/workers" style={{ fontSize: 14 }}>
        ← Back to workers
      </a>

      <h1 style={{ marginTop: 10, fontSize: 26, fontWeight: 950 }}>
        Edit worker
      </h1>

      {msg && <div style={noticeStyle}>{msg}</div>}

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading…</div>
      ) : !worker ? (
        <div style={emptyStyle}>Worker not found.</div>
      ) : (
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{worker.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                ID: <span style={{ fontFamily: "monospace" }}>{worker.id}</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...btnSmallStyle,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  💬 WhatsApp
                </a>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  Add phone for WhatsApp
                </span>
              )}

              {phone ? (
                <a
                  href={`tel:${phone}`}
                  style={{
                    ...btnSmallStyle,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  📞 Call
                </a>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid #eee" }} />

          <div style={gridStyle}>
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleOption)}
                style={inputStyle}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Job title">
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                style={inputStyle}
                placeholder="Office Manager"
              />
            </Field>

            <Field label="Phone (recommended: +4479...)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
                placeholder="+4479..."
              />
            </Field>

            <Field label="Active">
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 44,
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span>{active ? "Active" : "Archived"}</span>
              </label>
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={save} style={btnPrimaryStyle} disabled={saving}>
              {saving ? "Saving…" : "💾 Save"}
            </button>

            <button onClick={archive} style={btnDangerStyle} disabled={saving}>
              {worker.active ? "🗄️ Archive worker" : "✅ Unarchive worker"}
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Archiving removes them from the live system but keeps history safe.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          marginBottom: 6,
          opacity: 0.75,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
  width: "100%",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const cardStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  border: "1px solid #e6e6e6",
  borderRadius: 14,
  background: "white",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const btnSmallStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const btnDangerStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #b91c1c",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const noticeStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
};

const emptyStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  border: "1px dashed #ccc",
  borderRadius: 12,
};