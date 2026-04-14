import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// UPDATE (tick complete / untick)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()

  const todo = await prisma.todo.update({
    where: { id: Number(params.id) },
    data: {
      completed: body.completed,
      completedAt: body.completed ? new Date() : null,
    },
  })

  return NextResponse.json(todo)
}

// DELETE (optional)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.todo.delete({
    where: { id: Number(params.id) },
  })

  return NextResponse.json({ success: true })
}