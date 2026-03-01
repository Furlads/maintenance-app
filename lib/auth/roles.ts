// /lib/auth/roles.ts
import type { MASession } from "./session";

function normName(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const ADMIN_NAMES = new Set([
  normName("Trevor Fudger"),
  normName("Kelly Darby"),
]);

export function isAdminSession(session: MASession): boolean {
  // If role is explicitly set, respect it
  if (session.role === "admin") return true;

  // Otherwise infer by name (your requirement)
  const n = normName(session.name);
  return ADMIN_NAMES.has(n);
}

export function roleLabel(session: MASession): "Admin" | "Worker" {
  return isAdminSession(session) ? "Admin" : "Worker";
}