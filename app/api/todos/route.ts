import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const todos = await prisma.todo.findMany({
    orderBy: [
      { completed: 'asc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json(todos)
}

export async function POST(req: Request) {
  const body = await req.json()

  const todo = await prisma.todo.create({
    data: {
      description: body.description,
      assignedTo: body.assignedTo,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
  })

  return NextResponse.json(todo)
}