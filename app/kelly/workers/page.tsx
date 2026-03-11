"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Worker = {
  id: number;
  company: string;
  key: string;
  name: string;
  role: string;
  jobTitle?: string | null;
  photoUrl: string;
  phone?: string; // ✅ NEW
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// ✅ ONLY roles linked to current routing logic
const ROLE_OPTIONS = ["Worker", "Office", "Admin", "Manager", "Owner"] as const;
type RoleOption = (typeof ROLE_OPTIONS)[number];

type Brand = {
  key: "threecounties" | "furlads";
  label: string;
  logo: string;
  primary: string;
  softBg: string;
};

const BRANDS: Brand[] = [
  {
    key: "threecounties",
    label: "Three Counties",
    logo: "/logos/threecounties.png",
    primary: "#1e7f4f",
    softBg: "#eef8f2",
  },
  {
    key: "furlads",
    label: "Furlads",
    logo: "/logos/furlads.png",
    primary: "#111111",
    softBg: "#fffbe6",
  },
];

function clean(s: unknown) {
  return typeof s === "string" ? s.trim() : "";
}
function norm(v: string) {
  return (v || "").trim().toLowerCase();
}

function slugKeyFromName(name: string) {
  return clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function getCompanyFromUrlOrStorage() {
  if (typeof window === "undefined") return "furlads";
  const url = new URL(window.location.href);
  const q = url.searchParams.get("company");
  if (q) return norm(q);

  const saved = localStorage.getItem("workerCompany") || localStorage.getItem("company") || "";
  if (saved) return norm(saved);

  return "furlads";
}

function safeWorkers(data: any): Worker[] {
  if (Array.isArray(data?.workers)) return data.workers as Worker[];
  if (Array.isArray(data)) return data as Worker[];
  return [];
}

function safeRole(role: string): RoleOption {
  const r = clean(role);
  const hit = ROLE_OPTIONS.find((x) => x.toLowerCase() === r.toLowerCase());
  return hit ?? "Worker";
}

function whatsappUrlFromPhone(phoneRaw: string, displayName?: string) {
  const p = clean(phoneRaw);
  if (!p) return "";
  // Keep digits only (wa.me needs digits, no +, spaces etc)
  const digits = p.replace(/[^\d]/g, "");
  if (!digits) return "";
  const msg = encodeURIComponent(`Hi ${clean(displayName) || ""}`.trim());
  return `https://wa.me/${digits}?text=${msg}`;
}

async function uploadPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}). ${txt}`);
  }

  const data: any = await res.json().catch(() => ({}));
  const url =
    clean(data?.url) ||
    clean(data?.photoUrl) ||
    clean(data?.fileUrl) ||
    clean(data?.data?.url) ||
    "";

  if (!url) throw new Error("Upload succeeded but no URL returned.");
  return url;
}

export default function KellyWorkersPage() {
  const [company, setCompany] = useState<string>("furlads");

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Add form
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState<RoleOption>("Worker");
  const [addJobTitle, setAddJobTitle] = useState("");
  const [addPhotoUrl, setAddPhotoUrl] = useState("");
  const [addPhone, setAddPhone] = useState(""); // ✅ NEW
  const [addActive, setAddActive] = useState(true);
  const [addUploading, setAddUploading] = useState(false);
  const addFileRef = useRef<HTMLInputElement | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<Worker | null>(null);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<RoleOption>("Worker");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editPhone, setEditPhone] = useState(""); // ✅ NEW
  const [editActive, setEditActive] = useState(true);
  const [editUploading, setEditUploading] = useState(false);
  const editFileRef = useRef<HTMLInputElement | null>(null);

  const brand = useMemo(() => {
    const key = company === "threecounties" ? "threecounties" : "furlads";
    return BRANDS.find((b) => b.key === key)!;
  }, [company]);

  // ---------- styles ----------
  const shell: React.CSSProperties = {
    minHeight: "100vh",
    background: brand.softBg,
  };

  const container: React.CSSProperties = {
    padding: 16,
    maxWidth: 980,
    margin: "0 auto",
  };

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    background: "#fff",
    padding: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
  };

  const label: React.CSSProperties = { fontSize: 12, opacity: 0.75, marginBottom: 6, fontWeight: 900 };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 16,
    border: "1px solid #d1d5db",
    fontSize: 16,
    minHeight: 48,
    background: "#fff",
  };

  const btn: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 16,
    padding: "12px 14px",
    fontWeight: 950,
    fontSize: 15,
    cursor: "pointer",
    minHeight: 48,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    whiteSpace: "nowrap",
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    border: `1px solid ${brand.primary}`,
    background: brand.primary,
    color: "#fff",
  };

  const btnDanger: React.CSSProperties = { ...btn, border: "1px solid #ffb3b3", background: "#ffecec" };

  const pill: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    fontSize: 12,
    fontWeight: 900,
  };

  const pillAccent: React.CSSProperties = {
    ...pill,
    border: `1px solid ${brand.primary}`,
    background: "rgba(0,0,0,0)",
    color: brand.primary,
  };

  // ---------- helpers ----------
  function go(path: string) {
    window.location.href = path;
  }

  function backToDashboard() {
    const as = norm(localStorage.getItem("workerName") || "");
    if (as) go(`/kelly/combined?as=${encodeURIComponent(as)}`);
    else go("/");
  }

  async function loadWorkers(c = company) {
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`/api/workers?company=${encodeURIComponent(c)}&includeArchived=1`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Load failed (${res.status})`);
      setWorkers(safeWorkers(data));
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load workers.");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const c = getCompanyFromUrlOrStorage();
    setCompany(c);
    localStorage.setItem("company", c);
    loadWorkers(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = clean(q).toLowerCase();
    const list = [...workers]
      .filter((w) => (showArchived ? true : !!w.active))
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (a.name || "").localeCompare(b.name || "");
      });

    if (!term) return list;

    return list.filter((w) => {
      const hay = `${w.name} ${w.role} ${w.jobTitle || ""} ${w.key} ${w.phone || ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [workers, q, showArchived]);

  const activeCount = workers.filter((w) => w.active).length;
  const archivedCount = workers.filter((w) => !w.active).length;

  // ---------- actions ----------
  async function onAddFilePicked(file: File | null) {
    if (!file) return;
    setErrorMsg("");
    setAddUploading(true);
    try {
      const url = await uploadPhoto(file);
      setAddPhotoUrl(url);
    } catch (e: any) {
      setErrorMsg(e?.message || "Upload failed.");
    } finally {
      setAddUploading(false);
    }
  }

  async function onEditFilePicked(file: File | null) {
    if (!file) return;
    setErrorMsg("");
    setEditUploading(true);
    try {
      const url = await uploadPhoto(file);
      setEditPhotoUrl(url);
    } catch (e: any) {
      setErrorMsg(e?.message || "Upload failed.");
    } finally {
      setEditUploading(false);
    }
  }

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const name = clean(addName);
    if (!name) return setErrorMsg("Please enter a name.");

    const key = slugKeyFromName(name);
    if (!key) return setErrorMsg("Couldn’t generate a key from that name.");

    setBusyId(-1);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          key,
          name,
          role: addRole,
          jobTitle: clean(addJobTitle) || "",
          photoUrl: clean(addPhotoUrl) || "",
          phone: clean(addPhone) || "", // ✅ NEW
          active: !!addActive,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Add failed (${res.status}). ${txt}`);
      }

      setAddName("");
      setAddRole("Worker");
      setAddJobTitle("");
      setAddPhotoUrl("");
      setAddPhone(""); // ✅ NEW
      setAddActive(true);
      if (addFileRef.current) addFileRef.current.value = "";

      await loadWorkers(company);
    } catch (e: any) {
      setErrorMsg(e?.message || "Add failed.");
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(w: Worker) {
    setErrorMsg("");
    setEdit(w);
    setEditName(w.name);
    setEditRole(safeRole(w.role));
    setEditJobTitle(w.jobTitle || "");
    setEditPhotoUrl(w.photoUrl || "");
    setEditPhone(w.phone || ""); // ✅ NEW
    setEditActive(!!w.active);
    if (editFileRef.current) editFileRef.current.value = "";
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEdit(null);
    setEditUploading(false);
  }

  async function saveEdit() {
    if (!edit) return;
    setErrorMsg("");

    const name = clean(editName);
    if (!name) return setErrorMsg("Name can’t be blank.");

    setBusyId(edit.id);
    try {
      const res = await fetch(`/api/workers/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role: editRole,
          jobTitle: clean(editJobTitle) || "",
          photoUrl: clean(editPhotoUrl) || "",
          phone: clean(editPhone) || "", // ✅ NEW
          active: !!editActive,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Save failed (${res.status}). ${txt}`);
      }

      await loadWorkers(company);
      closeEdit();
    } catch (e: any) {
      setErrorMsg(e?.message || "Save failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleArchive(w: Worker) {
    setErrorMsg("");
    setBusyId(w.id);
    try {
      const res = await fetch(`/api/workers/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !w.active }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Update failed (${res.status}). ${txt}`);
      }

      await loadWorkers(company);
    } catch (e: any) {
      setErrorMsg(e?.message || "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={shell}>
      {/* Sticky top controls (mobile-friendly) */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: `3px solid ${brand.primary}`,
        }}
      >
        <div style={container}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <button style={btn} onClick={backToDashboard}>
              ← Back to dashboard
            </button>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt={brand.label} style={{ height: 34, objectFit: "contain" }} />

              <select
                value={company}
                onChange={(e) => {
                  const next = norm(e.target.value);
                  setCompany(next);
                  localStorage.setItem("company", next);
                  loadWorkers(next);
                }}
                style={{ ...input, width: 200 }}
              >
                <option value="threecounties">Three Counties</option>
                <option value="furlads">Furlads</option>
              </select>

              <button style={btn} onClick={() => loadWorkers(company)} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Workers</div>
            <span style={pillAccent}>Active: {activeCount}</span>
            <span style={pill}>Archived: {archivedCount}</span>

            <label style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              <span style={{ fontWeight: 900 }}>Show archived</span>
            </label>
          </div>

          {errorMsg ? (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 16, border: "1px solid #ffb3b3", background: "#ffecec" }}>
              <b>Oops:</b> {errorMsg}
            </div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff…" style={input} />
          </div>
        </div>
      </div>

      <div style={container}>
        {/* Add worker */}
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Add worker</div>

          <form onSubmit={addWorker} style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={label}>Name *</div>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} style={input} />
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div style={label}>Role</div>
                <select value={addRole} onChange={(e) => setAddRole(e.target.value as RoleOption)} style={input}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  Office/Admin/Manager/Owner go to Kelly dashboard. Worker goes to Today.
                </div>
              </div>

              <div>
                <div style={label}>Job title (shown to them)</div>
                <input value={addJobTitle} onChange={(e) => setAddJobTitle(e.target.value)} style={input} placeholder="e.g. Office Manager" />
              </div>
            </div>

            {/* ✅ NEW: phone */}
            <div>
              <div style={label}>Phone (WhatsApp)</div>
              <input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                style={input}
                placeholder="e.g. 07903 192711 or +44 7903 192711"
              />
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                Tip: any format is fine — WhatsApp button uses digits only.
              </div>
            </div>

            <div>
              <div style={label}>Photo</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  ref={addFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => onAddFilePicked(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 14 }}
                />
                <button type="button" style={btn} onClick={() => addFileRef.current?.click()} disabled={addUploading}>
                  {addUploading ? "Uploading…" : "Choose photo"}
                </button>

                {addPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={addPhotoUrl}
                    alt="Preview"
                    style={{ width: 54, height: 54, borderRadius: 14, objectFit: "cover", border: "1px solid #e5e7eb" }}
                  />
                ) : null}
              </div>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={addActive} onChange={(e) => setAddActive(e.target.checked)} />
              <span style={{ fontWeight: 900 }}>Active</span>
            </label>

            <button type="submit" style={btnPrimary} disabled={busyId === -1}>
              {busyId === -1 ? "Adding…" : "Add worker"}
            </button>
          </form>
        </div>

        {/* List */}
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Staff ({filtered.length})</div>

          {loading ? (
            <div style={{ padding: 12, borderRadius: 16, border: "1px solid #eee", background: "#fafafa", opacity: 0.9 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 12, borderRadius: 16, border: "1px dashed #ddd", background: "#fafafa", opacity: 0.9 }}>No staff found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((w) => (
                <div key={w.id} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.photoUrl || "/favicon.ico"}
                      alt={w.name}
                      style={{ width: 56, height: 56, borderRadius: 16, objectFit: "cover", border: "1px solid #e5e7eb", background: "#fafafa" }}
                    />

                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 18 }}>{w.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Key: <b>{w.key}</b>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={pillAccent}>Role: {w.role || "Worker"}</span>
                        <span style={pill}>Title: {w.jobTitle || "—"}</span>
                        <span style={{ ...pill, background: w.active ? "#eaffea" : "#fff1f1" }}>{w.active ? "Active" : "Archived"}</span>
                        {w.phone ? <span style={pill}>📞 {w.phone}</span> : null}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button style={btn} onClick={() => openEdit(w)} disabled={busyId === w.id}>
                        Edit
                      </button>
                      <button style={btnDanger} onClick={() => toggleArchive(w)} disabled={busyId === w.id}>
                        {w.active ? "Archive" : "Unarchive"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && edit ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div style={{ width: "100%", maxWidth: 720, ...card }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Edit worker</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  Key: <b>{edit.key}</b>
                </div>
              </div>

              <button style={btn} onClick={closeEdit}>
                Close ✕
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <div style={label}>Name *</div>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} style={input} />
                </div>

                <div>
                  <div style={label}>Role</div>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as RoleOption)} style={input}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={label}>Job title (shown to them)</div>
                <input value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)} style={input} />
              </div>

              {/* ✅ NEW: phone + WhatsApp */}
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div style={label}>Phone (WhatsApp)</div>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={input}
                    placeholder="e.g. 07903 192711 or +44 7903 192711"
                  />
                </div>

                <div style={{ display: "grid", alignContent: "end" }}>
                  <button
                    type="button"
                    style={btn}
                    disabled={!clean(editPhone)}
                    onClick={() => {
                      const url = whatsappUrlFromPhone(editPhone, editName);
                      if (!url) return;
                      window.open(url, "_blank");
                    }}
                    title={!clean(editPhone) ? "Add a phone number first" : "Open WhatsApp"}
                  >
                    WhatsApp ↗
                  </button>
                </div>
              </div>

              <div>
                <div style={label}>Photo</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editPhotoUrl || "/favicon.ico"}
                    alt={editName}
                    style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", border: "1px solid #e5e7eb" }}
                  />

                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      ref={editFileRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => onEditFilePicked(e.target.files?.[0] ?? null)}
                      style={{ fontSize: 14 }}
                    />
                    <button type="button" style={btn} onClick={() => editFileRef.current?.click()} disabled={editUploading}>
                      {editUploading ? "Uploading…" : "Choose new photo"}
                    </button>
                  </div>
                </div>
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                <span style={{ fontWeight: 900 }}>Active</span>
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button style={btn} onClick={closeEdit}>
                  Cancel
                </button>
                <button style={btnPrimary} onClick={saveEdit} disabled={busyId === edit.id || editUploading}>
                  {busyId === edit.id ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile: force 1 column for 2-col grids */}
      <style jsx global>{`
        @media (max-width: 860px) {
          main div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}