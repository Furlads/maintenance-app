"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type CompanyKey = "furlads" | "threecounties";

const COMPANY_NAMES: Record<string, string> = {
  furlads: "Furlads",
  threecounties: "Three Counties Property Care",
};

const COMPANY_THEME: Record<CompanyKey, { accent: string; accentSoft: string; text: string }> = {
  furlads: {
    accent: "#FFD400",
    accentSoft: "rgba(255, 212, 0, 0.18)",
    text: "#111",
  },
  threecounties: {
    accent: "#2E5EA8",
    accentSoft: "rgba(46, 94, 168, 0.14)",
    text: "#111",
  },
};

function titleCase(s: string) {
  return (s || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function AppHeader(props: { title: string; onRefresh?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const [company, setCompany] = useState<string>("");
  const [worker, setWorker] = useState<string>("");

  const isChooserPage = pathname === "/choose-company" || pathname === "/choose-worker";

  // We don't want the global banner/header on /today (it has its own in-page header/buttons)
  const hideOnToday = pathname === "/today";

  useEffect(() => {
    // Legacy migration (old key)
    const legacyWorkerName = localStorage.getItem("workerName") || "";
    const w = localStorage.getItem("worker") || "";
    if (!w && legacyWorkerName) {
      localStorage.setItem("worker", legacyWorkerName.trim().toLowerCase());
      localStorage.removeItem("workerName");
    }

    setCompany(localStorage.getItem("company") || "");
    setWorker(localStorage.getItem("worker") || "");
  }, []);

  const theme = useMemo(() => {
    const key = (company || "") as CompanyKey;
    return (
      COMPANY_THEME[key] || {
        accent: "#ddd",
        accentSoft: "rgba(0,0,0,0.06)",
        text: "#111",
      }
    );
  }, [company]);

  function switchUser() {
    localStorage.removeItem("company");
    localStorage.removeItem("worker");
    localStorage.removeItem("workerName");
    router.replace("/choose-company");
  }

  // Hide header on chooser pages + today (today renders its own header/buttons)
  if (isChooserPage || hideOnToday) return null;

  const companyLabel = COMPANY_NAMES[company as CompanyKey] || (company ? titleCase(company) : "—");
  const workerLabel = worker ? titleCase(worker) : "—";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1 style={{ marginBottom: 6, color: theme.text }}>
          <span
            style={{
              boxShadow: `inset 0 -0.55em 0 ${theme.accentSoft}`,
              padding: "0 4px",
              borderRadius: 6,
            }}
          >
            {props.title}
          </span>
        </h1>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          <span style={{ color: theme.accent, fontWeight: 800 }}>●</span> Company: <b>{companyLabel}</b> • Worker:{" "}
          <b>{workerLabel}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
        {props.onRefresh ? (
          <button
            onClick={props.onRefresh}
            style={{
              padding: "8px 10px",
              border: `1px solid ${theme.accent}`,
              borderRadius: 10,
              background: "#fff",
            }}
          >
            Refresh
          </button>
        ) : null}

        <button
          onClick={switchUser}
          style={{
            padding: "8px 10px",
            border: `1px solid ${theme.accent}`,
            borderRadius: 10,
            background: "#fff",
          }}
        >
          Switch user
        </button>
      </div>
    </div>
  );
}