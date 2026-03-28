// lib/auth.ts
import { cookies, headers } from "next/headers";
import crypto from "crypto";

export const COOKIE_NAME = "ma_session";
const DEFAULT_SECRET = "dev-secret-change-me";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is missing in production.");
  }

  return DEFAULT_SECRET;
}

export async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlJson(obj: unknown) {
  return base64url(JSON.stringify(obj));
}

function base64urlToBuffer(value: string) {
  const normalised = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const paddingLength = (4 - (normalised.length % 4)) % 4;
  const padded = normalised + "=".repeat(paddingLength);

  return Buffer.from(padded, "base64");
}

function sign(data: string, secret: string) {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

export type SessionPayload = {
  workerName: string;
  workerId?: string;
  role?: string;
  iat: number;
  exp: number;
};

export function signSession(
  payload: Omit<SessionPayload, "iat" | "exp">,
  ttlSeconds = 60 * 60 * 24 * 30
) {
  const secret = getSessionSecret();
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
    const secret = getSessionSecret();
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    if (!h || !p || !sig) return null;

    const expected = sign(`${h}.${p}`, secret);
    if (!safeEqual(sig, expected)) return null;

    const json = base64urlToBuffer(p).toString("utf8");
    const payload = JSON.parse(json) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload || typeof payload !== "object") return null;
    if (!payload.exp || typeof payload.exp !== "number") return null;
    if (payload.exp < now) return null;
    if (!payload.iat || typeof payload.iat !== "number") return null;
    if (typeof payload.workerName !== "string") return null;
    if (payload.workerId !== undefined && typeof payload.workerId !== "string") {
      return null;
    }
    if (payload.role !== undefined && typeof payload.role !== "string") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
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

export async function createSessionForWorker(worker: {
  id: number | string;
  firstName?: string | null;
  lastName?: string | null;
  accessLevel?: string | null;
}) {
  const workerName = `${worker.firstName || ""} ${worker.lastName || ""}`.trim();
  const role = String(worker.accessLevel || "worker").trim().toLowerCase();

  const token = signSession({
    workerId: String(worker.id),
    workerName,
    role,
  });

  await setSessionCookie(token);

  return {
    workerId: String(worker.id),
    workerName,
    role,
  };
}

export function workerKeyFromName(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ /g, "-");
}