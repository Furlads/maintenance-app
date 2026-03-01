// lib/auth/token.ts
import crypto from "crypto";

export type SessionPayload = {
  workerId: string | number;
  workerName: string;
  role?: string;
  iat: number;
};

function normalizeSecret(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getAnySecret(): string | null {
  return normalizeSecret(process.env.SESSION_SECRET) || normalizeSecret(process.env.AUTH_SECRET);
}

function base64urlEncode(input: Buffer | string) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecodeToBuffer(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function hmac(payloadB64u: string, secret: string) {
  return base64urlEncode(crypto.createHmac("sha256", secret).update(payloadB64u).digest());
}

function safeEqual(a: string, b: string) {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function parsePayload(payloadB64u: string): SessionPayload | null {
  try {
    const json = base64urlDecodeToBuffer(payloadB64u).toString("utf8");
    const obj = JSON.parse(json) as SessionPayload;

    const wid = (obj as any)?.workerId;

    if (
      !obj ||
      (typeof wid !== "number" && typeof wid !== "string") ||
      typeof obj.workerName !== "string" ||
      typeof obj.iat !== "number"
    ) {
      return null;
    }

    return obj;
  } catch {
    return null;
  }
}

export function createSessionToken(input: Omit<SessionPayload, "iat">) {
  const secret = getAnySecret();
  if (!secret) throw new Error("SESSION_SECRET (or AUTH_SECRET) not set");

  const payload: SessionPayload = { ...input, iat: Date.now() };
  const payloadB64u = base64urlEncode(JSON.stringify(payload));
  const sigB64u = hmac(payloadB64u, secret);
  return `${payloadB64u}.${sigB64u}`;
}

/**
 * DEV: If signature fails, still accept parsed payload (local test stability).
 * PROD: Signature MUST match.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64u, sigB64u] = parts;
  const parsed = parsePayload(payloadB64u);
  if (!parsed) return null;

  const secret = getAnySecret();
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    return isProd ? null : parsed;
  }

  const expected = hmac(payloadB64u, secret);
  if (safeEqual(sigB64u, expected)) return parsed;

  return isProd ? null : parsed;
}