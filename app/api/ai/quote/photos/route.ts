export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

const MAX_FILE_SIZE = 10 * 1024 * 1024

function cleanFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const fileEntry = formData.get('file')

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'Photo file is required.' },
        { status: 400 }
      )
    }

    if (!fileEntry.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files can be uploaded.' },
        { status: 400 }
      )
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Each photograph must be smaller than 10MB.' },
        { status: 400 }
      )
    }

    const cleanedName = cleanFileName(fileEntry.name || 'site-photo.jpg')
    const pathname = [
      'quote-surveys',
      new Date().toISOString().slice(0, 10),
      `${Date.now()}-${cleanedName}`,
    ].join('/')

    const blob = await put(pathname, fileEntry, {
      access: 'public',
      addRandomSuffix: true,
    })

    const response = NextResponse.json(
      {
        url: blob.url,
        pathname: blob.pathname,
        fileName: cleanedName,
      },
      { status: 201 }
    )

    // Each upload gets its own short-lived cookie so parallel uploads cannot
    // overwrite one another. Quote autosave consumes these and stores the
    // permanent Blob URLs in the draft record for later job creation.
    const photoToken = Buffer.from(
      JSON.stringify({ url: blob.url, fileName: cleanedName })
    ).toString('base64url')

    response.cookies.set({
      name: `chas_quote_photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      value: photoToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2,
    })

    return response
  } catch (error) {
    console.error('Quote photo upload failed:', error)

    return NextResponse.json(
      { error: 'The photograph could not be uploaded.' },
      { status: 500 }
    )
  }
}
