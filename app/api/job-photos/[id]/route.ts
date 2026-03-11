export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import prisma from "@/lib/prisma";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const photoId = parseId(params.id);

    if (!photoId) {
      return NextResponse.json(
        { error: "Invalid photo id" },
        { status: 400 }
      );
    }

    // Find photo record
    const photo = await prisma.jobPhoto.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Delete from Vercel Blob
    if (photo.imageUrl) {
      await del(photo.imageUrl);
    }

    // Delete from database
    await prisma.jobPhoto.delete({
      where: { id: photoId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Delete photo failed:", error);

    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}