import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET all todos
export async function GET() {
  const todos = await prisma.todo.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(todos)
}

// CREATE new todo
export async function POST(req: Request) {
  const body = await req.json()

  const todo = await prisma.todo.create({
    data: {
      description: body.description,
      assignedTo: body.assignedTo,
    },
  })

  return NextResponse.json(todo)
}