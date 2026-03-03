"use client";

import { useEffect, useMemo, useState } from "react";

type CompanyKey = "furlads" | "threecounties";

function getLS(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function removeLS(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function cleanLower(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export default function AdminPage() {
  const [company, setCompany] = useState<CompanyKey | "">("");
  const [worker, setWorker] = useState<string>("");

  useEffect(() => {
    const c = (getLS("company") as CompanyKey) || "";
    const w = getLS("worker") || "";

    // Locked flow rules: must go through chooser if missing identity
    if (!c) {
      window.location.href = "/choose-company";
      return;
    }
    if (!w) {
      window.location.href = "/choose-worker";
      return;
    }

    // Only admins can use /admin (for now: trev + kelly)
    const admins = ["trev", "kelly"];
    const isAdmin = admins.includes(cleanLower(w));

    if (!isAdmin) {
      window.location.href = "/today";
      return;
    }

    setCompany(c);
    setWorker(w);
  }, []);

  const isThreeCounties = company === "threecounties";

  const palette = useMemo(() => {
    return isThreeCounties
      ? {
          // Three Counties = green
          bg: "#f3fdf6",
          card: "#ffffff",
          ink: "#071a2a",
          sub: "rgba(7,26,42,0.70)",
          line: "rgba(7,26,42,0.12)",
          brand: "#16a34a",
          brandDark: "#15803d",
          soft: "#ecfdf3",
          logo: "/branding/threecounties-logo.png",
          brandName: "Three Counties Property Care",
        }
      : {
          // Furlads = yellow/black
          bg: "#fff9db",
          card: "#ffffff",
          ink: "#0b0b0b",
          sub: "rgba(11,11,11,0.70)",
          line: "rgba(11,11,11,0.14)",
          brand: "#facc15",
          brandDark: "#eab308",
          soft: "#fff7cc",
          logo: "/branding/furlads-logo.png",
          brandName: "Furlads",
        };
  }, [isThreeCounties]);

  const styles = useMemo(() => {
    const btnBase: React.CSSProperties = {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${palette.line}`,
      background: "#fff",
      fontWeight: 950,
      cursor: "pointer",
    };

    const card: React.CSSProperties = {
      borderRadius: 18,
      border: `1px solid ${palette.line}`,
      background: palette.card,
      boxShadow: "0 12px 34px rgba(0,0,0,0.06)",
    };

    return {
      container: { maxWidth: 560, margin: "0 auto" } as React.CSSProperties,
      card,
      headerCard: {
        ...card,
        padding: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      } as React.CSSProperties,
      btnBase,
      btnPrimary: {
        width: "100%",
        padding: 14,
        borderRadius: 16,
        border: "none",
        background: `linear-gradient(180deg, ${palette.brand} 0%, ${palette.brandDark} 100%)`,
        color: "#fff",
        fontWeight: 950,
        fontSize: 16,
        cursor: "pointer",
      } as React.CSSProperties,
      grid: { display: "grid", gap: 10 } as React.CSSProperties,
      grid2: { display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" } as React.CSSProperties,
      hint: {
        marginTop: 6,
        fontSize: 12,
        color: palette.sub,
        background: palette.soft,
        border: `1px solid ${palette.line}`,
        borderRadius: 16,
        padding: 12,
      } as React.CSSProperties,
    };
  }, [palette]);

  function switchUser() {
    // Keep identity flow rules intact
    removeLS("company");
    removeLS("worker");
    window.location.href = "/choose-company";
  }

  function goToday() {
    window.location.href = "/today";
  }

  function comingSoon(label: string) {
    alert(`${label}\n\nComing soon 👷‍♂️`);
  }

  if (!company || !worker) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: palette.bg,
        padding: 16,
        color: palette.ink,
      }}
    >
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.headerCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={palette.logo}
              alt="Company Logo"
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                objectFit: "cover",
                border: `1px solid ${palette.line}`,
                background: "#fff",
              }}
            />

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: palette.sub }}>Admin Dashboard</div>
              <div style={{ fontSize: 20, fontWeight: 950, marginTop: 2 }}>{palette.brandName}</div>
              <div style={{ fontSize: 12, color: palette.sub, marginTop: 4 }}>
                Logged in as <b style={{ color: palette.ink }}>{worker}</b>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={goToday} style={styles.btnBase}>
              Today
            </button>
            <button onClick={switchUser} style={styles.btnBase}>
              Switch user
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 950, color: palette.sub, marginBottom: 10 }}>Quick actions</div>

          <div style={styles.grid}>
            <button onClick={goToday} style={styles.btnPrimary}>
              Go to Today’s Jobs →
            </button>

            <div style={styles.grid2}>
              <button onClick={() => comingSoon("Create Job")} style={cardBtn(palette)}>
                Create Job
              </button>

              <button onClick={() => comingSoon("All Jobs")} style={cardBtn(palette)}>
                All Jobs
              </button>

              <button onClick={() => comingSoon("Customers")} style={cardBtn(palette)}>
                Customers
              </button>

              <button onClick={() => comingSoon("Workers")} style={cardBtn(palette)}>
                Workers
              </button>
            </div>

            <div style={styles.hint}>
              Next build: wire up <b>Create Job</b>, <b>All Jobs</b>, then <b>Workers</b> (database-driven).
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function cardBtn(palette: { line: string; card: string; ink: string }) {
  return {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: `1px solid ${palette.line}`,
    background: palette.card,
    fontWeight: 950 as const,
    color: palette.ink,
    cursor: "pointer",
  };
}