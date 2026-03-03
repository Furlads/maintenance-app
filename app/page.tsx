"use client";

import { useEffect, useMemo, useState } from "react";

type Worker = {
  id: number;
  company: string;
  key: string;
  name: string;
  role: string;
  jobTitle: string;
  photoUrl: string;
  active: boolean;
};

const BUSINESS_OPTIONS = [
  {
    key: "threecounties",
    label: "Three Counties Property Care",
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
] as const;

type CompanyKey = (typeof BUSINESS_OPTIONS)[number]["key"];

function norm(v: string) {
  return (v || "").trim().toLowerCase();
}

function isOfficeRole(role: string) {
  const r = norm(role);
  return r.includes("manager") || r.includes("admin") || r.includes("office") || r.includes("owner");
}

async function fetchWorkers(company: CompanyKey) {
  const res = await fetch(`/api/workers?company=${company}&includeArchived=1`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Workers fetch failed (${res.status})`);
  return Array.isArray(data?.workers) ? (data.workers as Worker[]) : [];
}

export default function ChooseWorkerHomePage() {
  const [company, setCompany] = useState<CompanyKey>("threecounties");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const brand = BUSINESS_OPTIONS.find((b) => b.key === company)!;

  useEffect(() => {
    load(company);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  async function load(companyKey: CompanyKey) {
    setLoading(true);
    try {
      const list = await fetchWorkers(companyKey);
      setWorkers(list.filter((w) => w.active));
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = norm(search);
    const list = [...workers].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;

    return list.filter((w) =>
      `${w.name} ${w.jobTitle || ""} ${w.role || ""} ${w.key || ""}`.toLowerCase().includes(q)
    );
  }, [workers, search]);

  function chooseWorker(w: Worker) {
    const key = norm(w.key);
    localStorage.setItem("workerName", key);
    localStorage.setItem("workerCompany", company);

    if (isOfficeRole(w.role)) {
      window.location.href = `/kelly/combined?as=${encodeURIComponent(key)}`;
      return;
    }
    window.location.href = "/today";
  }

  function clearLogin() {
    localStorage.removeItem("workerName");
    localStorage.removeItem("workerCompany");
    window.location.href = "/";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: brand.softBg,
      }}
    >
      {/* Sticky top bar for phones */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: 14,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt={brand.label} style={{ height: 38, objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{brand.label}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Tap your name to start</div>
              </div>
            </div>

            <button
              type="button"
              onClick={clearLogin}
              style={{
                minHeight: 44,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid #d1d5db",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value as CompanyKey)}
              style={{
                minHeight: 48,
                padding: "12px 14px",
                borderRadius: 16,
                border: `2px solid ${brand.primary}`,
                fontWeight: 800,
                background: "#fff",
                fontSize: 15,
              }}
            >
              {BUSINESS_OPTIONS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>

            <input
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                minHeight: 48,
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid #d1d5db",
                fontSize: 15,
                background: "#fff",
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => load(company)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: `1px solid ${brand.primary}`,
                  background: brand.primary,
                  color: "white",
                  fontWeight: 900,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => setSearch("")}
                style={{
                  minHeight: 48,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  fontWeight: 900,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Office users (Admin/Manager) go to Kelly admin view.
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 14 }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  background: "#fff",
                  borderRadius: 18,
                  padding: 18,
                  border: "1px dashed #cbd5e1",
                }}
              >
                {loading ? "Loading staff…" : "No staff found."}
              </div>
            ) : (
              filtered.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => chooseWorker(w)}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    textAlign: "left",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    cursor: "pointer",
                    minHeight: 80, // chunky tap target
                  }}
                >
                  {w.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.photoUrl}
                      alt={w.name}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        objectFit: "cover",
                        border: "1px solid #eee",
                        flex: "0 0 auto",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        background: brand.primary,
                        color: "white",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 950,
                        fontSize: 18,
                        flex: "0 0 auto",
                      }}
                    >
                      {(w.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {w.name}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 800 }}>
                      {w.jobTitle?.trim() ? w.jobTitle : "Team Member"}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: brand.primary }}>
                      {w.role}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile: force single column */}
      <style jsx global>{`
        @media (max-width: 720px) {
          main div[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}