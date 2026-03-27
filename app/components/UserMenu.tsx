"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  workerName: string;
  role?: string;
};

export default function UserMenu() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.workerName) {
          setSession(data);
        }
      })
      .catch((error) => {
        console.error("Failed to load session:", error);
      });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (!session) return null;

  return (
    <>
      <div
        className="user-menu-shell"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          className="user-menu-meta"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
          }}
        >
          <div style={{ textAlign: "right", minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                color: "#111",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {session.workerName}
            </div>

            {session.role && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.65,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {session.role}
              </div>
            )}
          </div>

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#111",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {session.workerName.charAt(0)}
          </div>
        </div>

        <div
          className="user-menu-actions"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "stretch",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/settings")}
            style={{
              minHeight: 44,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Settings
          </button>

          <button
            type="button"
            onClick={logout}
            style={{
              minHeight: 44,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .user-menu-shell {
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .user-menu-meta {
          width: 100%;
          justify-content: flex-end;
        }

        .user-menu-actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        @media (min-width: 768px) {
          .user-menu-shell {
            flex-wrap: nowrap;
          }

          .user-menu-meta {
            width: auto;
          }

          .user-menu-actions {
            width: auto;
            display: flex;
          }
        }
      `}</style>
    </>
  );
}