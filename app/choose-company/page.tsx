"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type CompanyKey = "furlads" | "threecounties";

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
    // Legacy migration
    const legacyWorkerName = localStorage.getItem("workerName") || "";
    const w = localStorage.getItem("worker") || "";
    if (!w && legacyWorkerName) {
      localStorage.setItem("worker", legacyWorkerName.trim().toLowerCase());
      localStorage.removeItem("workerName");
    }

    const company = localStorage.getItem("company") || "";
    const worker = (localStorage.getItem("worker") || "").trim().toLowerCase();

    if (company && worker) {
      // Kelly should land on /kelly, everyone else on /today
      router.replace(worker === "kelly" ? "/kelly" : "/today");
    }
  }, [router]);

  function chooseCompany(key: CompanyKey) {
    localStorage.setItem("company", key);

    // Force re-pick worker whenever company changes
    localStorage.removeItem("worker");
    localStorage.removeItem("workerName");

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