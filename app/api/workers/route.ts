import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function norm(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function splitName(name: string) {
  const parts = clean(name).split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated." },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const company = norm(url.searchParams.get("company"));
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const isAdmin = isAdminLikeRole(session.role);

    if (!isAdmin && (company || includeArchived)) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      );
    }

    const where: any = {};

    if (!includeArchived) {
      where.active = true;
    }

    const workers = await prisma.worker.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        active: true,
        accessLevel: true,
        jobTitle: true,
        createdAt: true,
      },
      orderBy: {
        firstName: "asc",
      },
    });

    if (isAdmin) {
      const mapped = workers
        .filter((worker) => {
          if (!company) return true;

          if (company === "furlads" || company === "threecounties") {
            return true;
          }

          return true;
        })
        .map((worker) => ({
          id: worker.id,
          company: company || "furlads",
          key: `${norm(worker.firstName)}${norm(worker.lastName)}`.replace(
            /[^a-z0-9]+/g,
            ""
          ),
          name: `${worker.firstName || ""} ${worker.lastName || ""}`.trim(),
          role: worker.accessLevel || "Worker",
          jobTitle: worker.jobTitle || "",
          photoUrl: "",
          phone: worker.phone || "",
          active: !!worker.active,
          createdAt: worker.createdAt,
        }));

      return NextResponse.json({ workers: mapped });
    }

    const minimal = workers
      .filter((worker) => !!worker.active)
      .map((worker) => ({
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        phone: worker.phone,
      }));

    return NextResponse.json(minimal);
  } catch (error) {
    console.error("WORKERS API ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to load workers",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const name = clean((body as any).name);
    const role = clean((body as any).role) || "Worker";
    const jobTitle = clean((body as any).jobTitle);
    const phone = clean((body as any).phone);
    const active =
      typeof (body as any).active === "boolean" ? (body as any).active : true;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Name is required." },
        { status: 400 }
      );
    }

    const { firstName, lastName } = splitName(name);

    const created = await prisma.worker.create({
      data: {
        firstName,
        lastName,
        accessLevel: role,
        jobTitle: jobTitle || "",
        phone: phone || null,
        active,
        email: null,
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
        id: created.id,
        name: `${created.firstName || ""} ${created.lastName || ""}`.trim(),
        role: created.accessLevel || "Worker",
        jobTitle: created.jobTitle || "",
        phone: created.phone || "",
        active: !!created.active,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    console.error("CREATE WORKER ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create worker.",
      },
      { status: 500 }
    );
  }
}