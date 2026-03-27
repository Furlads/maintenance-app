"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type CompanyKey = "furlads" | "threecounties";

type AuthMeResponse = {
  authenticated?: boolean;
  name?: string | null;
  role?: string | null;
};

const COMPANIES: {
  key: CompanyKey;
  name: string;
  logo: string;
}[] = [
  { key: "furlads", name: "Furlads", logo: "/branding/furlads-logo.png" },
  {
    key: "threecounties",
    name: "Three Counties Property Care",
    logo: "/branding/threecounties-logo.png",
  },
];

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isTrevName(name: string | null | undefined) {
  const value = normalise(name);
  return value === "trevor fudger" || value === "trev fudger";
}

function isAdminLikeRole(role: string | null | undefined) {
  const value = normalise(role);

  return (
    value === "admin" ||
    value === "office" ||
    value === "manager" ||
    value === "owner"
  );
}

export default function ChooseCompanyPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const company = localStorage.getItem("company") || "";

        if (!company) return;

        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });

        const data: AuthMeResponse | null = await res.json().catch(() => null);

        if (!res.ok || !data?.authenticated) {
          return;
        }

        if (isTrevName(data.name)) {
          router.replace("/trev");
          return;
        }

        if (isAdminLikeRole(data.role)) {
          router.replace("/admin");
          return;
        }

        router.replace("/today");
      } catch (error) {
        console.error("Failed to check existing session:", error);
      }
    }

    void checkExistingSession();
  }, [router]);

  function chooseCompany(key: CompanyKey) {
    localStorage.setItem("company", key);
    router.replace("/choose-worker");
  }

  const cardPadding = isMobile ? "18px 14px" : "26px 18px";
  const cardRadius = isMobile ? 18 : 20;
  const cardMinHeight = isMobile ? 150 : 190;
  const logoMaxWidth = isMobile ? 220 : 260;
  const logoHeight = isMobile ? 72 : 90;
  const titleSize = isMobile ? 24 : 28;
  const subtitleSize = isMobile ? 13 : 14;
  const nameSize = isMobile ? 16 : 18;
  const gap = isMobile ? 14 : 18;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: isMobile ? 16 : 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1
          style={{
            marginBottom: 6,
            fontSize: titleSize,
            fontWeight: 800,
            letterSpacing: -0.5,
            textAlign: "center",
          }}
        >
          Choose your company
        </h1>

        <p
          style={{
            marginTop: 0,
            marginBottom: isMobile ? 14 : 20,
            opacity: 0.6,
            fontSize: subtitleSize,
            textAlign: "center",
          }}
        >
          Select the business you’re working in today
        </p>

        <div style={{ display: "grid", gap: isMobile ? 12 : 16 }}>
          {COMPANIES.map((c) => (
            <button
              key={c.key}
              onClick={() => chooseCompany(c.key)}
              style={{
                width: "100%",
                padding: cardPadding,
                borderRadius: cardRadius,
                border: "1px solid #e5e5e5",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap,
                minHeight: cardMinHeight,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: logoMaxWidth,
                  height: logoHeight,
                }}
              >
                <Image
                  src={c.logo}
                  alt={c.name}
                  fill
                  sizes={`${logoMaxWidth}px`}
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>

              <span
                style={{
                  fontSize: nameSize,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}