// /proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isTrevSession(session: {
  workerName?: string | null;
  role?: string | null;
}) {
  const workerName = normalise(session.workerName);
  const role = normalise(session.role);

  if (workerName === "trevor fudger") return true;
  if (workerName === "trev fudger") return true;
  if (role === "trev") return true;

  return false;
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

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

function forbidden(req: NextRequest) {
  const url = new URL("/", req.url);
  return NextResponse.redirect(url);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname === "/choose-company" ||
    pathname === "/choose-worker" ||
    pathname === "/trev-offline" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico");

  const isPublicApiPath =
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/me") ||
    pathname.startsWith("/api/auth/change-password") ||
    pathname.startsWith("/api/auth/change-pin") ||
    pathname.startsWith("/api/auth/pin-login") ||
    pathname.startsWith("/api/auth/webauthn/login/start") ||
    pathname.startsWith("/api/auth/webauthn/login/finish") ||
    pathname.startsWith("/api/auth/webauthn/register") ||
    pathname.startsWith("/api/auth/cookies") ||
    pathname.startsWith("/api/inbox/facebook/webhook") ||
    pathname.startsWith("/api/inbox/whatsapp/webhook") ||
    pathname.startsWith("/api/inbox/wix/forms") ||
    pathname.startsWith("/api/blob") ||
    pathname.startsWith("/api/business") ||
    pathname.startsWith("/api/companies") ||
    pathname.startsWith("/api/menu");

  if (isPublicPath || isPublicApiPath) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  const needsSession =
    pathname.startsWith("/today") ||
    pathname.startsWith("/my-visits") ||
    pathname.startsWith("/jobs") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/worker/") ||
    pathname.startsWith("/chas") ||
    pathname.startsWith("/book-follow-up") ||
    pathname.startsWith("/unscheduled") ||
    pathname.startsWith("/workers") ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/api/job-photos") ||
    pathname.startsWith("/api/customers") ||
    pathname.startsWith("/api/workers") ||
    pathname.startsWith("/api/time-off") ||
    pathname.startsWith("/api/staff/time-off") ||
    pathname.startsWith("/api/chas") ||
    pathname.startsWith("/api/schedule") ||
    pathname.startsWith("/api/scheduler") ||
    pathname.startsWith("/api/reports") ||
    pathname.startsWith("/api/reminders") ||
    pathname.startsWith("/api/uploads") ||
    pathname.startsWith("/api/send-job-sms") ||
    pathname.startsWith("/api/push/subscribe") ||
    pathname.startsWith("/api/what3words");

  if (needsSession && !session) {
    return redirectToLogin(req);
  }

  const isAdminArea =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/kelly") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/kelly") ||
    pathname.startsWith("/api/inbox") ||
    pathname.startsWith("/api/reports");

  if (isAdminArea) {
    if (!session) {
      return redirectToLogin(req);
    }

    if (!isAdminLikeRole(session.role)) {
      return forbidden(req);
    }
  }

  const isTrevArea =
    pathname.startsWith("/trev") || pathname.startsWith("/api/trev-dashboard");

  if (isTrevArea) {
    if (!session) {
      return redirectToLogin(req);
    }

    if (!isTrevSession(session)) {
      return forbidden(req);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};