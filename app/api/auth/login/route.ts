// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/auth/token";

const COOKIE_NAME = "ma_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function usernameToFirstPart(username: string) {
  const u = String(username || "").trim().toLowerCase();
  const first = u.split("@")[0]?.trim() || "";
  // "jacob.walters" -> "jacob"
  return first.split(".")[0];
}

function titleCaseFirst(s: string) {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

function makeSetCookieHeader(value: string) {
  // IMPORTANT:
  // - No Domain attribute (host-only cookie)
  // - Path=/ (sent to ALL routes)
  // - No Secure in local http
  return [
    `${COOKIE_NAME}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${MAX_AGE}`,
  ].join("; ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "");
    const password = String(body?.password || "");

    const userKey = usernameToFirstPart(username);
    if (!userKey || !password) {
      return NextResponse.json({ ok: false, error: "Missing username/password" }, { status: 400 });
    }

    // ✅ Prefer stable Worker.key (trev/kelly/jacob/stephen)
    // Fallback to name-startsWith for older DB rows / transitional data.
    const worker = await prisma.worker.findFirst({
      where: {
        archivedAt: null,
        OR: [
          { key: userKey }, // preferred
          { name: { startsWith: titleCaseFirst(userKey) } }, // fallback
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,     // display label only
        key: true,      // stable key
        access: true,   // ADMIN | STAFF
        passwordHash: true,
        mustChangePassword: true,
      },
    });

    if (!worker) {
      return NextResponse.json({ ok: false, error: "Invalid login" }, { status: 401 });
    }

    // Test fallback password: key123 (e.g. trev123, jacob123)
    const fallback = `${userKey}123`;

    let ok = false;
    if (worker.passwordHash) {
      ok = await verifyPassword(password, worker.passwordHash);
    } else {
      ok = password === fallback;
    }

    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid login" }, { status: 401 });
    }

    // ✅ Put stable identity + access in the session token
    const token = createSessionToken({
      workerId: worker.id,
      workerName: worker.name,
      workerKey: worker.key,
      access: worker.access, // "ADMIN" | "STAFF"
      role: worker.role || undefined, // optional display string
    });

    const res = NextResponse.json(
      {
        ok: true,
        worker: {
          id: worker.id,
          name: worker.name,
          role: worker.role,
          key: worker.key,
          access: worker.access,
          mustChangePassword: worker.mustChangePassword,
        },
      },
      { status: 200 }
    );

    res.headers.set("Set-Cookie", makeSetCookieHeader(token));
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    console.error("Login error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || "Login failed (server)") },
      { status: 500 }
    );
  }
}