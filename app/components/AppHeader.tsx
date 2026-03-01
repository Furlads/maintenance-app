// /app/components/AppHeader.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Me = {
  authenticated: boolean;
  name?: string;
  role?: string;
  isAdmin?: boolean;
};

function avatarSrcFromName(name?: string) {
  const n = (name || "").trim().toLowerCase();

  // Map session name -> uploaded image path
  if (n === "trevor fudger" || n.includes("trevor") || n.includes("trev")) return "/uploads/1772185991845-trevor.jpg";
  if (n === "kelly darby" || n.includes("kelly")) return "/uploads/1772186026876-kelly.jpg";
  if (n.includes("stephen") || n.includes("steve")) return "/uploads/1772185852194-steve.jpg";
  if (n.includes("jacob")) return "/uploads/1772185925962-jacob.jpg";

  return "";
}

export default function AppHeader() {
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [imgOk, setImgOk] = useState(true);

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as Me;
      setMe(data);
      setImgOk(true);
    } catch {
      setMe({ authenticated: false });
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    window.location.href = "/login";
  }

  const src = me.authenticated ? avatarSrcFromName(me.name) : "";

  return (
    <div style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {me.authenticated && src && imgOk ? (
            <img
              src={src}
              alt={me.name || "User"}
              width={34}
              height={34}
              onError={() => setImgOk(false)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                objectFit: "cover",
                border: "1px solid #ddd",
              }}
            />
          ) : me.authenticated ? (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "1px solid #ddd",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 12,
              }}
              title={me.name || ""}
            >
              {(me.name || "?").trim().slice(0, 1).toUpperCase()}
            </div>
          ) : null}

          <div style={{ fontSize: 14 }}>
            {me.authenticated ? (
              <>
                Logged in as: <b>{me.name}</b> • Role: <b>{me.role}</b>
              </>
            ) : (
              <>Not logged in</>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {me.authenticated && me.isAdmin ? <Link href="/settings">Settings</Link> : null}
          {me.authenticated ? (
            <button onClick={logout} style={{ padding: "6px 10px" }}>
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}