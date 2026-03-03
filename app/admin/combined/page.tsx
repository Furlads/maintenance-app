"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// ✅ Reuse existing pages without changing them (Today is locked)
const AdminPage = dynamic(() => import("../page"), { ssr: false });
const TodayPage = dynamic(() => import("../../today/page"), { ssr: false });

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

function guessCompanyFromAsKey(asKey: string): "threecounties" | "furlads" {
  // We can’t reliably infer from key alone; default to threecounties.
  // Admin dashboard pages typically don’t need company here, and Today uses localStorage workerName.
  return "threecounties";
}

export default function AdminCombinedPage() {
  const params = useSearchParams();
  const asKey = (params.get("as") || "").trim().toLowerCase();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(false);

  // Ensure localStorage workerName matches the "as" user we’re impersonating
  useEffect(() => {
    if (asKey) localStorage.setItem("workerName", asKey);
  }, [asKey]);

  // Optional: load worker details to show header (nice UX)
  useEffect(() => {
    let cancelled = false;

    async function loadWorker() {
      if (!asKey) return;

      setLoading(true);
      try {
        const company = guessCompanyFromAsKey(asKey);
        const res = await fetch(`/api/workers?company=${company}&includeArchived=1`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        const list: Worker[] = Array.isArray(data?.workers) ? data.workers : [];
        const found = list.find((w) => (w.key || "").toLowerCase() === asKey) || null;

        if (!cancelled) setWorker(found);
      } catch {
        if (!cancelled) setWorker(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorker();
    return () => {
      cancelled = true;
    };
  }, [asKey]);

  const title = useMemo(() => {
    if (!asKey) return "Admin view";
    if (worker?.name) return `Admin view — ${worker.name}`;
    return `Admin view — ${asKey}`;
  }, [asKey, worker]);

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {asKey ? (
              <>
                You’re viewing today + admin dashboard as <b>{asKey}</b>.
              </>
            ) : (
              <>Missing “as” parameter.</>
            )}
            {loading ? " (Loading…)" : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => (window.location.href = "/admin")}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            Admin only
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/today")}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            Today only
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Today</div>
          <TodayPage />
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Admin dashboard</div>
          <AdminPage />
        </div>
      </div>
    </div>
  );
}