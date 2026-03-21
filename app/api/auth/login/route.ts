import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ error: "Missing details" }, { status: 400 });
    }

    const worker = await prisma.worker.findFirst({
      where: { phone: phone.trim() },
    });

    if (!worker || !worker.passwordHash) {
      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }

    // 🔒 lockout check
    if (worker.lockedUntil && worker.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Account locked. Try again later." },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, worker.passwordHash);

    if (!valid) {
      await prisma.worker.update({
        where: { id: worker.id },
        data: {
          failedLoginAttempts: { increment: 1 },
        },
      });

      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }

    // ✅ reset failed attempts
    await prisma.worker.update({
      where: { id: worker.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    // 🔐 secure session cookie
    const res = NextResponse.json({
      success: true,
      role: worker.accessLevel || "worker",
    });

    res.cookies.set("furlads_session", JSON.stringify({
      userId: worker.id,
      role: worker.accessLevel || "worker",
    }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}