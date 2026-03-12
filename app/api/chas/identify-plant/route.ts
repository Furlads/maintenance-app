export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  buildFriendlyPlantReply,
  identifyPlantWithPlantNet
} from '@/lib/plantnet'

type IdentifyPlantBody = {
  imageDataUrls?: string[]
  organs?: Array<'auto' | 'leaf' | 'flower' | 'fruit' | 'bark'>
}

function isValidOrgan(value: string): value is 'auto' | 'leaf' | 'flower' | 'fruit' | 'bark' {
  return ['auto', 'leaf', 'flower', 'fruit', 'bark'].includes(value)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IdentifyPlantBody

    const imageDataUrls = Array.isArray(body.imageDataUrls)
      ? body.imageDataUrls.filter((v): v is string => typeof v === 'string' && v.startsWith('data:image/'))
      : []

    const organs = Array.isArray(body.organs)
      ? body.organs.filter((v): v is 'auto' | 'leaf' | 'flower' | 'fruit' | 'bark' => typeof v === 'string' && isValidOrgan(v))
      : []

    if (!imageDataUrls.length) {
      return NextResponse.json(
        { error: 'At least one image is required.' },
        { status: 400 }
      )
    }

    const results = await identifyPlantWithPlantNet({
      imageDataUrls,
      organs,
      project: 'all'
    })

    const friendly = buildFriendlyPlantReply(results)

    return NextResponse.json({
      ok: true,
      intent: 'plant_id',
      confidence: friendly.confidence,
      answer: friendly.answer,
      topResults: friendly.topResults
    })
  } catch (error) {
    console.error('POST /api/chas/identify-plant failed:', error)

    return NextResponse.json(
      {
        error: 'Plant identification failed.'
      },
      { status: 500 }
    )
  }
}