// lib/auth/session.ts
import { NextRequest } from "next/server";
import { verifySessionToken, SessionPayload } from "@/lib/auth/token";

export type SessionData = SessionPayload;

export function readSession(req: NextRequest): SessionData | null {
  const token = req.cookies.get("ma_session")?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionData | null> {
  return readSession(req);
}