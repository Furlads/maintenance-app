"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type CompanyKey = "furlads" | "threecounties";

type AuthMeResponse = {
  authenticated?: boolean;
  name?: string | null;
  role?: string | null;
};

const COMPANY_NAMES: Record<string, string> = {
  furlads: "Furlads",
  threecounties: "Three Counties Property Care",
};

const COMPANY_THEME: Record<
  CompanyKey,
  { accent: string; accentSoft: string; text: string }
> = {
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

function titleCase(value: string) {
  return (value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workerToSlug(value: string) {
  return (value || "").trim().toLowerCase();
}

function clearClientAuthStorage() {
  localStorage.removeItem("worker");
  localStorage.removeItem("workerName");
  localStorage.removeItem("workerId");
  localStorage.removeItem("workerAccessLevel");
  localStorage.removeItem("lastWorkerId");
  localStorage.removeItem("lastWorkerName");
  localStorage.removeItem("lastWorkerAccessLevel");
  localStorage.removeItem("selectedLoginWorkerId");
  localStorage.removeItem("selectedLoginWorkerName");
  localStorage.removeItem("selectedLoginWorkerPhone");
  localStorage.removeItem("selectedLoginWorkerPhotoUrl");
}

export default function AppHeader(props: {
  title: string;
  onRefresh?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [company, setCompany] = useState<string>("");
  const [worker, setWorker] = useState<string>("");

  const isChooserPage =
    pathname === "/choose-company" || pathname === "/choose-worker";

  const hideOnToday = pathname === "/today";

  useEffect(() => {
    async function loadHeaderState() {
      try {
        const savedCompany = localStorage.getItem("company") || "";
        setCompany(savedCompany);

        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });

        const data: AuthMeResponse | null = await res.json().catch(() => null);

        if (res.ok && data?.authenticated && data?.name) {
          setWorker(workerToSlug(data.name));
          return;
        }

        setWorker("");
      } catch (error) {
        console.error("Failed to load header session:", error);
        setWorker("");
      }
    }

    void loadHeaderState();
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

  async function switchUser() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
    } catch (error) {
      console.error("Failed to log out while switching user:", error);
    } finally {
      clearClientAuthStorage();
      localStorage.removeItem("company");
      setWorker("");
      setCompany("");
      router.replace("/choose-company");
      router.refresh();
    }
  }

  if (isChooserPage || hideOnToday) return null;

  const companyLabel =
    COMPANY_NAMES[company as CompanyKey] || (company ? titleCase(company) : "—");

  const workerLabel = worker ? titleCase(worker) : "—";

  return (
    <>
      <div
        className="app-header-shell"
        style={{
          marginBottom: 16,
        }}
      >
        <div
          className="app-header-main"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                margin: "0 0 6px 0",
                color: theme.text,
                fontSize: 28,
                lineHeight: 1.1,
              }}
            >
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

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.45,
                color: "#444",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              <span style={{ color: theme.accent, fontWeight: 800 }}>●</span>{" "}
              Company: <b>{companyLabel}</b> • Worker: <b>{workerLabel}</b>
            </div>
          </div>

          <div
            className="app-header-actions"
            style={{
              display: "flex",
              gap: 8,
              alignItems: "stretch",
              flexWrap: "wrap",
            }}
          >
            {props.onRefresh ? (
              <button
                type="button"
                onClick={props.onRefresh}
                style={{
                  minHeight: 44,
                  padding: "10px 14px",
                  border: `1px solid ${theme.accent}`,
                  borderRadius: 10,
                  background: "#fff",
                  color: "#111",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            ) : null}

            <button
              type="button"
              onClick={switchUser}
              style={{
                minHeight: 44,
                padding: "10px 14px",
                border: `1px solid ${theme.accent}`,
                borderRadius: 10,
                background: "#fff",
                color: "#111",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Switch user
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .app-header-main {
          flex-direction: column;
        }

        .app-header-actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
        }

        @media (min-width: 768px) {
          .app-header-main {
            flex-direction: row;
          }

          .app-header-actions {
            width: auto;
            display: flex;
            justify-content: flex-end;
          }
        }
      `}</style>
    </>
  );
}