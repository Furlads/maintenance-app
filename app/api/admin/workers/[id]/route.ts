import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const workerId = Number(id);

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        jobTitle: true,
        accessLevel: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    return NextResponse.json({
      worker: {
        ...worker,
        phone: worker.phone ?? "",
        email: worker.email ?? "",
        jobTitle: worker.jobTitle ?? "",
        accessLevel: worker.accessLevel ?? "worker",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/workers/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to load worker" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const workerId = Number(id);

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const updates: Record<string, unknown> = {};

    if ("firstName" in body) {
      const value = clean(body.firstName);
      if (!value) {
        return NextResponse.json(
          { error: "First name cannot be blank" },
          { status: 400 }
        );
      }
      updates.firstName = value;
    }

    if ("lastName" in body) {
      const value = clean(body.lastName);
      if (!value) {
        return NextResponse.json(
          { error: "Last name cannot be blank" },
          { status: 400 }
        );
      }
      updates.lastName = value;
    }

    if ("phone" in body) {
      const value = clean(body.phone);
      updates.phone = value || null;
    }

    if ("email" in body) {
      const value = clean(body.email);
      updates.email = value || null;
    }

    if ("jobTitle" in body) {
      const value = clean(body.jobTitle);
      updates.jobTitle = value || "Worker";
    }

    if ("accessLevel" in body) {
      const value = clean(body.accessLevel).toLowerCase();
      updates.accessLevel = value || "worker";
    }

    if ("active" in body) {
      updates.active = !!body.active;
    }

    const worker = await prisma.worker.update({
      where: { id: workerId },
      data: updates,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        jobTitle: true,
        accessLevel: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      worker: {
        ...worker,
        phone: worker.phone ?? "",
        email: worker.email ?? "",
        jobTitle: worker.jobTitle ?? "",
        accessLevel: worker.accessLevel ?? "worker",
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/workers/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to update worker" },
      { status: 500 }
    );
  }
}