import { NextResponse } from 'next/server'

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  return NextResponse.json({
    ok: true,
    worker: null,
    id: params.id,
    message: 'Worker details endpoint is not enabled yet.'
  })
}

export async function PATCH(_req: Request, { params }: RouteContext) {
  return NextResponse.json({
    ok: false,
    id: params.id,
    message: 'Worker update endpoint is not enabled yet.'
  })
}