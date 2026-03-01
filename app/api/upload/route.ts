import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })

    const ext = path.extname(file.name) || '.jpg'
    const filename = `${crypto.randomUUID()}${ext}`
    const filepath = path.join(uploadDir, filename)

    await fs.writeFile(filepath, buffer)

    // IMPORTANT: this is a web URL
    const url = `/uploads/${filename}`

    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 })
  }
}