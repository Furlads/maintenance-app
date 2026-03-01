// app/api/workers/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { hashPassword } from "../../../lib/password";

function firstNameFromFullName(full: string) {
  return String(full || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        photoUrl: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ workers });
  } catch (err: any) {
    console.error("GET /api/workers failed:", err);
    return NextResponse.json(
      { error: "Failed to load workers", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const role = body.role ? String(body.role).trim() : null;
    const photoUrl = body.photoUrl ? String(body.photoUrl).trim() : null;

    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
    }

    const first = firstNameFromFullName(name);
    if (!first) {
      return NextResponse.json({ error: "Invalid worker name" }, { status: 400 });
    }

    const defaultPassword = `${first}123`;
    const passwordHash = await hashPassword(defaultPassword);

    const worker = await prisma.worker.create({
      data: {
        name,
        phone,
        role,
        photoUrl,
        archivedAt: null,
        passwordHash,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        photoUrl: true,
        archivedAt: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ worker });
  } catch (err: any) {
    console.error("POST /api/workers failed:", err);
    return NextResponse.json(
      { error: "Failed to create worker", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}