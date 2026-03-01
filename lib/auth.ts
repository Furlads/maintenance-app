// lib/auth.ts
import { cookies, headers } from "next/headers";
import crypto from "crypto";

export const COOKIE_NAME = "ma_session";
const DEFAULT_SECRET = "dev-secret-change-me";

// Base URL helper (works in dev + prod)
export async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

// --- tiny JWT-ish token (HMAC SHA256) ---------------------------------

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlJson(obj: any) {
  return base64url(JSON.stringify(obj));
}

function sign(data: string, secret: string) {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export type SessionPayload = {
  workerName: string;
  workerId?: string;
  role?: string;
  iat: number;
  exp: number;
};

export function signSession(payload: Omit<SessionPayload, "iat" | "exp">, ttlSeconds = 60 * 60 * 24 * 30) {
  const secret = process.env.SESSION_SECRET || DEFAULT_SECRET;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const body: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const h = base64urlJson(header);
  const p = base64urlJson(body);
  const sig = sign(`${h}.${p}`, secret);

  return `${h}.${p}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const secret = process.env.SESSION_SECRET || DEFAULT_SECRET;
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const expected = sign(`${h}.${p}`, secret);
    if (sig !== expected) return null;

    const json = Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (!payload?.exp || payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// --- cookie helpers (Next 16 = async cookies()) ------------------------

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 30 days
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// small helper used elsewhere
export function workerKeyFromName(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ /g, "-");
}