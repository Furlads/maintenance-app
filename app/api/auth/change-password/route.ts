// app/api/auth/change-password/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { readSession, signSession, setSessionCookie, workerKeyFromName } from "../../../../lib/auth";
import { hashPassword, verifyPassword } from "../../../../lib/password";

export async function POST(req: Request) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: session.workerId },
      select: { id: true, name: true, passwordHash: true },
    });

    if (!worker?.passwordHash) return NextResponse.json({ error: "Password not set" }, { status: 400 });

    const ok = await verifyPassword(currentPassword, worker.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

    const hashed = await hashPassword(newPassword);

    await prisma.worker.update({
      where: { id: worker.id },
      data: { passwordHash: hashed, mustChangePassword: false },
    });

    const token = signSession({
      workerId: worker.id,
      workerName: worker.name,
      workerKey: workerKeyFromName(worker.name),
      mustChangePassword: false,
      iat: Date.now(),
    });

    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/auth/change-password failed:", err);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}