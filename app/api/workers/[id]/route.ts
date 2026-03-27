import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type RouteContext = {
  params: {
    id: string;
  };
};

function norm(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isAdminLikeRole(role: string | null | undefined) {
  const value = norm(role);

  return (
    value === "admin" ||
    value === "office" ||
    value === "manager" ||
    value === "owner"
  );
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthenticated." },
        { status: 401 }
      );
    }

    if (!isAdminLikeRole(session.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 }
      );
    }

    const workerId = Number(params.id);

    if (!Number.isFinite(workerId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid worker id." },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        accessLevel: true,
        jobTitle: true,
        phone: true,
        active: true,
        createdAt: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { ok: false, error: "Worker not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      worker: {
        id: worker.id,
        name: `${worker.firstName || ""} ${worker.lastName || ""}`.trim(),
        role: worker.accessLevel || "Worker",
        jobTitle: worker.jobTitle || "",
        phone: worker.phone || "",
        active: !!worker.active,
        createdAt: worker.createdAt,
      },
    });
  } catch (error) {
    console.error("GET WORKER ERROR:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load worker." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthenticated." },
        { status: 401 }
      );
    }

    if (!isAdminLikeRole(session.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 }
      );
    }

    const workerId = Number(params.id);

    if (!Number.isFinite(workerId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid worker id." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const name = clean((body as any).name);
    const role = clean((body as any).role);
    const jobTitle = clean((body as any).jobTitle);
    const phone = clean((body as any).phone);
    const active =
      typeof (body as any).active === "boolean" ? (body as any).active : undefined;

    const existing = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Worker not found." },
        { status: 404 }
      );
    }

    let firstName = existing.firstName || "";
    let lastName = existing.lastName || "";

    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);

      if (parts.length === 1) {
        firstName = parts[0];
        lastName = "";
      } else if (parts.length > 1) {
        firstName = parts.shift() || "";
        lastName = parts.join(" ");
      }
    }

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data: {
        firstName,
        lastName,
        accessLevel: role || undefined,
        jobTitle: jobTitle || "",
        phone: phone || null,
        ...(typeof active === "boolean" ? { active } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        accessLevel: true,
        jobTitle: true,
        phone: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      worker: {
        id: updated.id,
        name: `${updated.firstName || ""} ${updated.lastName || ""}`.trim(),
        role: updated.accessLevel || "Worker",
        jobTitle: updated.jobTitle || "",
        phone: updated.phone || "",
        active: !!updated.active,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("PATCH WORKER ERROR:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to update worker." },
      { status: 500 }
    );
  }
}