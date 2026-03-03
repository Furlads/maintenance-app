// lib/auth/session.ts
import { NextRequest } from "next/server";
import { verifySessionToken, SessionPayload } from "@/lib/auth/token";

export type SessionData = SessionPayload;

const COOKIE_NAME = "ma_session";

export function readSession(req: NextRequest): SessionData | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  // ✅ Safety: ensure required stable fields exist (prevents weird partial sessions)
  // If you still have old tokens floating around, this avoids “half-authenticated” states.
  if (!session.workerId || !session.workerName) return null;

  return session;
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionData | null> {
  return readSession(req);
}