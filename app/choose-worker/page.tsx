"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CompanyKey = "furlads" | "threecounties";

// Role names may change — treat as string (don’t union-lock it)
type WorkerRole = string;

type Worker = {
  id: number;
  company: CompanyKey;
  key: string;
  name: string;
  role: WorkerRole;
  photoUrl: string;
  schedulable: boolean;
  active: boolean;
};

function getLS(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function setLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function removeLS(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function cleanLower(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function initialsFromName(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/**
 * ✅ Flexible admin detection (since role names changed)
 * Add/remove keywords anytime without touching routing logic elsewhere.
 */
function isAdminRole(role: WorkerRole) {
  const r = cleanLower(role);

  // common “admin/office” style roles
  const adminKeywords = [
    "admin",
    "administrator",
    "office",
    "manager",
    "supervisor",
    "owner",
    "director",
    "kelly",
  ];

  return adminKeywords.some((k) => r.includes(k));
}

export default function ChooseWorkerPage() {
  const router = useRouter();

  const [company, setCompany] = useState<CompanyKey | "">("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // ✅ Always compute palette (no conditional hooks)
  const isThreeCounties = company === "threecounties";
  const palette = isThreeCounties
    ? {
        bgTop: "#052e16",
        bgMid: "#16a34a",
        bgBottom: "#f3fdf6",
        card: "#ffffff",
        ink: "#052014",
        sub: "rgba(5,32,20,0.70)",
        line: "rgba(5,32,20,0.12)",
        brand: "#16a34a",
        soft: "#ecfdf3",
        chipBg: "rgba(22,163,74,0.12)",
        chipBorder: "rgba(22,163,74,0.25)",
      }
    : {
        bgTop: "#0b0b0b",
        bgMid: "#facc15",
        bgBottom: "#fff9db",
        card: "#ffffff",
        ink: "#0b0b0b",
        sub: "rgba(11,11,11,0.70)",
        line: "rgba(11,11,11,0.14)",
        brand: "#facc15",
        soft: "#fff7cc",
        chipBg: "rgba(250,204,21,0.20)",
        chipBorder: "rgba(250,204,21,0.35)",
      };

  async function load(c: CompanyKey) {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/workers?company=${c}`, { cache: "no-store" });
      const data = await res.json();
      const list: Worker[] = Array.isArray(data?.workers) ? data.workers : [];
      setWorkers(list.filter((w) => w.active));
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load workers");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const c = (getLS("company") as CompanyKey) || "";
    if (c !== "furlads" && c !== "threecounties") {
      router.replace("/choose-company");
      return;
    }

    // legacy migration workerName -> worker
    const legacy = getLS("workerName");
    const w = getLS("worker");
    if (!w && legacy) {
      setLS("worker", cleanLower(legacy));
      removeLS("workerName");
    }

    const existingWorker = cleanLower(getLS("worker"));
    if (existingWorker) {
      router.replace("/today");
      return;
    }

    setCompany(c);
    load(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedWorkers = useMemo(() => {
    const arr = [...workers];

    // Put admins-ish first, then alphabetical
    arr.sort((a, b) => {
      const aa = isAdminRole(a.role) ? 0 : 1;
      const bb = isAdminRole(b.role) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [workers]);

  function landingPathForRole(role: WorkerRole) {
    // ✅ Only admins go to admin
    if (isAdminRole(role)) return "/kelly";

    // ✅ Everyone else goes to Today (never /my-visits)
    return "/today";
  }

  function pickWorker(w: { key: string; role: WorkerRole }) {
    const k = cleanLower(w.key);
    if (!k) return;
    setLS("worker", k);
    removeLS("workerName");
    router.replace(landingPathForRole(w.role));
  }

  function bootstrapAs(workerKey: "kelly" | "trev") {
    setLS("worker", workerKey);
    removeLS("workerName");
    // Bootstrap users should still land in admin tools
    router.replace("/kelly/workers");
  }

  function goBackToCompany() {
    removeLS("worker");
    removeLS("workerName");
    router.replace("/choose-company");
  }

  if (!company) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: `linear-gradient(180deg, ${palette.bgTop} 0%, ${palette.bgMid} 18%, ${palette.bgBottom} 58%, ${palette.bgBottom} 100%)`,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            borderRadius: 18,
            padding: 14,
            marginBottom: 12,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.22)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={isThreeCounties ? "/branding/threecounties-logo.png" : "/branding/furlads-logo.png"}
              alt="Company Logo"
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                objectFit: "cover",
                border: "1px solid rgba(255,255,255,0.35)",
                background: "#fff",
              }}
            />

            <div style={{ color: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.92 }}>Step 2 of 2</div>
              <div style={{ fontSize: 22, fontWeight: 950, marginTop: 2 }}>Who are you?</div>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.92, marginTop: 4 }}>
                {isThreeCounties ? "Three Counties Property Care" : "Furlads"} • {company}
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${palette.line}`,
            background: palette.card,
            padding: 16,
            boxShadow: "0 14px 40px rgba(0,0,0,0.18)",
            color: palette.ink,
          }}
        >
          <div style={{ fontSize: 13, color: palette.sub }}>Tap your name to continue 📱</div>

          {msg && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: `1px solid ${palette.line}` }}>
              {msg}
            </div>
          )}

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {loading ? (
              <div style={{ opacity: 0.8 }}>Loading workers…</div>
            ) : sortedWorkers.length === 0 ? (
              <div style={{ opacity: 0.9 }}>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>No workers found for this company yet.</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
                  Bootstrap in as Kelly to add the first workers.
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    onClick={() => bootstrapAs("kelly")}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 16,
                      border: `2px solid ${palette.brand}`,
                      background: palette.soft,
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Continue as Kelly (bootstrap admin) →
                  </button>

                  <button
                    onClick={() => bootstrapAs("trev")}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 16,
                      border: `1px solid ${palette.line}`,
                      background: "#fff",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Continue as Trev (bootstrap admin) →
                  </button>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    This only works when a company has <b>zero</b> workers. Once you add workers, normal role rules apply.
                  </div>
                </div>
              </div>
            ) : (
              sortedWorkers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickWorker(p)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderRadius: 16,
                    border: `1px solid ${palette.line}`,
                    background: "#fff",
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      border: `1px solid ${palette.line}`,
                      overflowX: "hidden",
                      overflowY: "visible",
                      background: palette.soft,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 950,
                      flexShrink: 0,
                    }}
                  >
                    {p.photoUrl ? (
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{initialsFromName(p.name)}</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.1 }}>{p.name}</div>

                    <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 950,
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: palette.chipBg,
                          border: `1px solid ${palette.chipBorder}`,
                        }}
                      >
                        {String(p.role || "Worker")}
                      </span>

                      <span style={{ fontSize: 12, color: palette.sub }}>
                        {isAdminRole(p.role) ? "Admin access" : "Field actions + notes"}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 950, color: palette.sub }}>→</div>
                </button>
              ))
            )}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button
              onClick={goBackToCompany}
              style={{
                flex: 1,
                padding: "12px 12px",
                borderRadius: 14,
                border: `1px solid ${palette.line}`,
                background: "#fff",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              ← Change company
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                flex: 1,
                padding: "12px 12px",
                borderRadius: 14,
                border: `1px solid ${palette.line}`,
                background: "#fff",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}