// /proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isAdminOnlyPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/settings");
}

function isAlwaysPublic(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

function isAdminName(name: string) {
  const n = (name || "").trim();
  return n === "Trevor Fudger" || n === "Kelly Darby";
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isAlwaysPublic(pathname)) return NextResponse.next();

  const session = readSession(req);

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  const name = session.workerName || "";
  const role = String(session.role || "").toLowerCase();
  const isAdmin = isAdminName(name) || role === "admin";

  if (isAdminOnlyPath(pathname) && !isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}