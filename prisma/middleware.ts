import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isPublicPath(pathname: string) {
  if (
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/public/")
  ) {
    return true;
  }

  if (
    pathname === "/login-hero.png" ||
    pathname === "/login-logo.png" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return true;
  }

  return false;
}

function isAdminLikeRole(role: string) {
  return (
    role === "admin" ||
    role === "office" ||
    role === "manager" ||
    role === "owner"
  );
}

function isTrevRole(role: string, workerName: string) {
  const name = normalise(workerName);

  if (role === "trev") return true;
  if (role === "owner") return true;
  if (name === "trevor fudger") return true;
  if (name === "trev fudger") return true;

  return false;
}

function getDefaultAppPath(role: string, workerName: string) {
  if (isTrevRole(role, workerName)) {
    return "/trev";
  }

  if (isAdminLikeRole(role)) {
    return "/admin";
  }

  return "/today";
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (pathname === "/login" && token) {
      const session = verifySessionToken(token);

      if (session) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = getDefaultAppPath(
          normalise(session.role),
          session.workerName
        );
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }

    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  const session = verifySessionToken(token);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;

    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  }

  const role = normalise(session.role);
  const workerName = session.workerName || "";

  if (pathname.startsWith("/admin")) {
    if (!isAdminLikeRole(role) && !isTrevRole(role, workerName)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = getDefaultAppPath(role, workerName);
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (pathname.startsWith("/trev")) {
    if (!isTrevRole(role, workerName)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = getDefaultAppPath(role, workerName);
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (pathname.startsWith("/today")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/my-visits")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/kelly")) {
    if (!isAdminLikeRole(role) && !isTrevRole(role, workerName)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = getDefaultAppPath(role, workerName);
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};