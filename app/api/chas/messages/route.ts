import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const company = (url.searchParams.get("company") || "").trim();
  const worker = (url.searchParams.get("worker") || "").trim();
  const take = Math.min(Number(url.searchParams.get("take") || 50), 200);

  const where: any = {};
  if (company) where.company = company;
  if (worker) where.worker = worker;

  const items = await prisma.chasMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { job: true },
  });

  return NextResponse.json(items);
}