export type PlantNetIdentifyResult = {
  score: number
  scientificName: string
  commonNames: string[]
  family?: string
  genus?: string
}

export type PlantNetResponse = {
  results?: Array<{
    score?: number
    species?: {
      scientificNameWithoutAuthor?: string
      commonNames?: string[]
      genus?: {
        scientificNameWithoutAuthor?: string
      }
      family?: {
        scientificNameWithoutAuthor?: string
      }
    }
  }>
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    throw new Error('Invalid image data URL.')
  }

  const mimeType = match[1]
  const base64 = match[2]
  const buffer = Buffer.from(base64, 'base64')

  return new Blob([buffer], { type: mimeType })
}

export async function identifyPlantWithPlantNet(args: {
  imageDataUrls: string[]
  organs?: Array<'auto' | 'leaf' | 'flower' | 'fruit' | 'bark'>
  project?: string
}) {
  const apiKey = process.env.PLANTNET_API_KEY

  if (!apiKey) {
    throw new Error('PLANTNET_API_KEY is not set.')
  }

  const { imageDataUrls, organs = [], project = 'all' } = args

  if (!imageDataUrls.length) {
    throw new Error('At least one image is required.')
  }

  if (imageDataUrls.length > 5) {
    throw new Error('A maximum of 5 images can be sent to Pl@ntNet.')
  }

  const formData = new FormData()

  imageDataUrls.forEach((dataUrl, index) => {
    const blob = dataUrlToBlob(dataUrl)
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    formData.append('images', blob, `plant-${index + 1}.${ext}`)
  })

  imageDataUrls.forEach((_, index) => {
    formData.append('organs', organs[index] || 'auto')
  })

  const url = `https://my-api.plantnet.org/v2/identify/${encodeURIComponent(project)}?api-key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Pl@ntNet request failed: ${response.status} ${text}`)
  }

  const data = (await response.json()) as PlantNetResponse

  const results: PlantNetIdentifyResult[] =
    data.results?.map((item) => ({
      score: typeof item.score === 'number' ? item.score : 0,
      scientificName: item.species?.scientificNameWithoutAuthor || 'Unknown',
      commonNames: item.species?.commonNames || [],
      genus: item.species?.genus?.scientificNameWithoutAuthor,
      family: item.species?.family?.scientificNameWithoutAuthor
    })) || []

  return results.sort((a, b) => b.score - a.score)
}

export function buildFriendlyPlantReply(results: PlantNetIdentifyResult[]) {
  const top = results[0]
  const second = results[1]
  const third = results[2]

  if (!top) {
    return {
      answer:
        'I could not get a solid plant match from that photo. Try one full-plant photo and one close leaf photo.',
      confidence: 'low' as const,
      topResults: []
    }
  }

  const confidence =
    top.score >= 0.75 ? 'high' : top.score >= 0.4 ? 'medium' : 'low'

  const commonName =
    top.commonNames.length > 0 ? top.commonNames[0] : null

  const topName = commonName
    ? `${commonName} (${top.scientificName})`
    : top.scientificName

  let answer = `That looks most like ${topName}.`

  if (confidence === 'high') {
    answer += ` I'm fairly confident from these photos.`
  } else if (confidence === 'medium') {
    answer += ` Fair chance that's right, but I'd still double-check before any heavy cutting or removal.`
  } else {
    answer += ` I'm not fully sure from this image, so don't make any major cutting decisions from this alone.`
  }

  answer += `\n\nWhat to do:\n`
  answer += `Get one full-plant photo and one clearer close-up of the leaf, flower, fruit, or bark if you can.`

  if (confidence !== 'high') {
    answer += `\n\nWatch out:\nTreat this as a rough identification only until you get better photos.`
  }

  if (second || third) {
    const otherOptions = [second, third]
      .filter(Boolean)
      .map((item) => {
        const cn = item!.commonNames[0]
        return cn ? `${cn} (${item!.scientificName})` : item!.scientificName
      })

    if (otherOptions.length) {
      answer += `\n\nOther possible matches:\n${otherOptions.join('\n')}`
    }
  }

  return {
    answer,
    confidence,
    topResults: results.slice(0, 3)
  }
}