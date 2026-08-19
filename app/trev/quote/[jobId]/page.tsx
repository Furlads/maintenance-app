'use client'

import Link from 'next/link'
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
}

type Job = {
  id: number
  title: string
  jobType: string
  notes: string | null
  address: string
  customer: Customer
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  photoNames?: string[]
}

type UploadedPhoto = {
  id: string
  fileName: string
  previewUrl: string
  uploadedUrl: string
  status: 'uploading' | 'uploaded' | 'failed'
}

type QuoteOption = {
  label: string
  title: string
  summary: string
  keyDifferences: string[]
  whyChoose: string
  estimatedDuration: {
    workingDays: number
    teamSize: number
    description: string
  }
  priceExVat: number
  vatAmount: number
  totalIncVat: number
}

type CombinedOffer = {
  available: boolean
  label: string
  summary: string
  includedOptionLabels: string[]
  savingReason: string
  separateTotalExVat: number
  savingExVat: number
  estimatedDuration: {
    workingDays: number
    teamSize: number
    description: string
  }
  priceExVat: number
  vatAmount: number
  totalIncVat: number
}

type PricingResult = {
  quoteMode?: 'single' | 'alternatives' | 'packages'
  optionMode?: boolean
  recommendedOptionLabel?: string
  options?: QuoteOption[]
  combinedOffer?: CombinedOffer | null
  summary: string
  confirmedInformation: string[]
  assumptions: string[]
  missingInformation: string[]
  potentialIssues: Array<{
    title: string
    details: string
    pricingImpact: string
  }>
  estimatedDuration: {
    workingDays: number
    teamSize: number
    description: string
  }
  recommendedPriceExVat: number
  vatRate: number
  vatAmount: number
  recommendedTotalIncVat: number
  depositPercent: number
  depositAmount: number
}

type QuoteResult = {
  whatsappQuote: string
}

const QUOTE_INSTRUCTIONS = `
Treat this as an ongoing conversation with Trevor while he is completing an assigned Furlads quote visit.
The latest Trevor message overrides earlier details if anything has changed.
Previous CHAS replies and prices are provisional context only. Do not treat them as extra scope and do not double-count them.

If the customer wants choices, work out whether they mean:
- alternatives: different ways/materials/layouts where they would choose one route; or
- packages: separate jobs they could buy individually, with an optional 'if all completed together' price where genuine shared efficiencies exist.

Customers should be allowed to see several prices before deciding. Do not force Trevor to choose for them before the options go to Kelly.
Give every option/package its own clear description, price and realistic duration.
For packages, give an all-together price only where there is a genuine commercial saving from shared setup, deliveries, plant, waste handling or tidy-up.
Do not invent discounts.

Furlads OS pricing rules:
- Standard selling rates are all-in selling prices and already include normal labour, materials, standard machinery, standard waste, deliveries, consumables, overheads and profit.
- Do not add those normal components again on top of an applicable standard selling rate.
- Current standard examples: Indian sandstone £140/m², porcelain £170/m², artificial grass £110/m².
- Only genuine exceptional extras should increase a standard-rate quote, such as drainage, difficult access, concrete breakout, retaining walls, excess excavation, specialist machinery or unusual waste.
- Protect margin and flag anything Trevor should check rather than inventing hidden conditions.
- Price excluding VAT, with VAT shown separately.
- Keep assumptions sensible and practical.
- Install times must be realistic for a human crew. Do not compress large scopes into attractive but impossible durations.
`.trim()

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function money(value: number | undefined) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function normalisePhone(value: string) {
  return value.replace(/\D/g, '')
}

function buildTranscript(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.id !== 'welcome')
    .map((message) => {
      const speaker = message.role === 'user' ? 'TREVOR' : 'CHAS'
      const photos = message.photoNames?.length
        ? `\nSite photos attached in this quote: ${message.photoNames.join(', ')}`
        : ''

      return `${speaker}: ${message.text}${photos}`
    })
    .join('\n\n')
}

function pricingReply(result: PricingResult) {
  const lines: string[] = []
  const options = Array.isArray(result.options) ? result.options : []

  if (result.optionMode && options.length >= 2) {
    if (result.quoteMode === 'packages') {
      lines.push("Right — I’d break this into separate jobs so the customer can see exactly what each part costs.")
    } else {
      lines.push("Right — there are a few different ways we could do this, so I’d show the customer the choices rather than pick for them.")
    }
    lines.push('')

    for (const option of options) {
      lines.push(`${option.label} — ${option.title}`)
      lines.push(option.summary)

      for (const difference of option.keyDifferences || []) {
        lines.push(`• ${difference}`)
      }

      if (option.whyChoose) {
        lines.push(`Why choose it: ${option.whyChoose}`)
      }

      lines.push(`Price: ${money(option.priceExVat)} + VAT`)
      lines.push(`VAT: ${money(option.vatAmount)}`)
      lines.push(`Total: ${money(option.totalIncVat)}`)

      if (option.estimatedDuration?.workingDays) {
        const days = option.estimatedDuration.workingDays
        const team = option.estimatedDuration.teamSize || 1
        lines.push(
          `Likely install: ${days} ${days === 1 ? 'day' : 'days'} with ${team} ${team === 1 ? 'person' : 'people'}.`
        )
      }

      lines.push('')
    }

    if (result.quoteMode === 'packages' && result.combinedOffer?.available) {
      const combined = result.combinedOffer
      lines.push(`${combined.label}`)
      if (combined.summary) lines.push(combined.summary)
      lines.push(`Price: ${money(combined.priceExVat)} + VAT`)
      lines.push(`VAT: ${money(combined.vatAmount)}`)
      lines.push(`Total: ${money(combined.totalIncVat)}`)
      if (combined.savingExVat > 0) {
        lines.push(`Saving compared with doing the packages separately: ${money(combined.savingExVat)} + VAT`)
      }
      if (combined.savingReason) {
        lines.push(`Why it’s cheaper together: ${combined.savingReason}`)
      }
      if (combined.estimatedDuration?.workingDays) {
        const days = combined.estimatedDuration.workingDays
        const team = combined.estimatedDuration.teamSize || 1
        lines.push(
          `Likely combined install: ${days} ${days === 1 ? 'day' : 'days'} with ${team} ${team === 1 ? 'person' : 'people'}.`
        )
      }
      lines.push('')
    }

    if (result.quoteMode === 'alternatives' && result.recommendedOptionLabel) {
      lines.push(`If you want my view, I’d lean toward ${result.recommendedOptionLabel}, but the customer can see all of them first.`)
      lines.push('')
    }

    lines.push(
      "If those prices and descriptions look right, send the options to Kelly. The customer can choose after they’ve seen them."
    )

    return lines.join('\n')
  }

  lines.push("Here's where I've got the quote from what you've told me.")
  lines.push('')
  lines.push(result.summary || 'I have reviewed the current quote details.')
  lines.push('')
  lines.push(`Price: ${money(result.recommendedPriceExVat)} + VAT`)
  lines.push(`VAT: ${money(result.vatAmount)}`)
  lines.push(`Total: ${money(result.recommendedTotalIncVat)}`)

  if (result.estimatedDuration?.workingDays) {
    const days = result.estimatedDuration.workingDays
    const team = result.estimatedDuration.teamSize || 1
    lines.push(
      `Likely install: ${days} ${days === 1 ? 'day' : 'days'} with ${team} ${team === 1 ? 'person' : 'people'}.`
    )
  }

  const issues = Array.isArray(result.potentialIssues)
    ? result.potentialIssues.slice(0, 3)
    : []

  if (issues.length) {
    lines.push('')
    lines.push('A few things I would keep an eye on:')
    for (const issue of issues) {
      lines.push(`• ${issue.title}: ${issue.details}`)
    }
  }

  const missing = Array.isArray(result.missingInformation)
    ? result.missingInformation.slice(0, 3)
    : []

  if (missing.length) {
    lines.push('')
    lines.push('Still worth confirming:')
    for (const item of missing) {
      lines.push(`• ${item}`)
    }
  }

  lines.push('')
  lines.push("Just tell me normally if anything needs changing and I'll rework it.")

  return lines.join('\n')
}

export default function AssignedTrevQuotePage() {
  const params = useParams<{ jobId: string }>()
  const jobId = Number(params.jobId)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const sessionIdRef = useRef(createId('trev-assigned-quote'))

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [customerReady, setCustomerReady] = useState(false)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerPostcode, setCustomerPostcode] = useState('')
  const [customerError, setCustomerError] = useState('')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendingToKelly, setSendingToKelly] = useState(false)
  const [sentToKelly, setSentToKelly] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAssignedQuote() {
      try {
        setLoading(true)
        const response = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
        const data = await response.json().catch(() => null)

        if (!response.ok || !data) {
          throw new Error(data?.error || 'Could not load this quote visit.')
        }

        const loadedJob = data as Job
        const type = String(loadedJob.jobType || '').toLowerCase()
        const title = String(loadedJob.title || '').toLowerCase()

        if (type !== 'quote' && title !== 'quote') {
          throw new Error('This job is not a quote visit.')
        }

        if (!loadedJob.customer?.id) {
          throw new Error('This quote visit is not linked to a customer.')
        }

        if (cancelled) return

        setJob(loadedJob)
        setCustomerName(loadedJob.customer.name || '')
        setCustomerPhone(loadedJob.customer.phone || '')
        setCustomerEmail(loadedJob.customer.email || '')
        setCustomerAddress(loadedJob.customer.address || loadedJob.address || '')
        setCustomerPostcode(loadedJob.customer.postcode || '')
      } catch (loadError) {
        if (!cancelled) {
          setCustomerError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this quote visit.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (Number.isInteger(jobId) && jobId > 0) {
      void loadAssignedQuote()
    } else {
      setCustomerError('Invalid quote visit.')
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [jobId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, error])

  useEffect(() => {
    return () => {
      for (const photo of photos) {
        if (photo.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photo.previewUrl)
        }
      }
    }
  }, [photos])

  const uploadedPhotos = useMemo(
    () => photos.filter((photo) => photo.status === 'uploaded'),
    [photos]
  )

  const uploadsInProgress = photos.some((photo) => photo.status === 'uploading')

  async function handleStartQuote() {
    if (!job?.customer?.id) {
      setCustomerError('Customer record is missing.')
      return
    }

    const name = customerName.trim()
    const phone = customerPhone.trim()
    const postcode = customerPostcode.trim().toUpperCase()

    if (!name || !phone || !postcode) {
      setCustomerError('Name, phone number and postcode are required.')
      return
    }

    if (normalisePhone(phone).length < 7) {
      setCustomerError('Please enter a valid phone number.')
      return
    }

    setCustomerSaving(true)
    setCustomerError('')

    try {
      const response = await fetch(`/api/customers/${job.customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: customerEmail.trim(),
          address: customerAddress.trim(),
          postcode,
        }),
      })

      const saved = await response.json().catch(() => null)

      if (!response.ok || !saved) {
        throw new Error(saved?.error || 'Could not update customer details.')
      }

      setCustomerName(saved.name || name)
      setCustomerPhone(saved.phone || phone)
      setCustomerEmail(saved.email || '')
      setCustomerAddress(saved.address || '')
      setCustomerPostcode(saved.postcode || postcode)
      setCustomerReady(true)
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `Right — we're at the quote visit for ${saved.name}. Tell me what the customer wants, measurements, access, levels, drainage and anything unusual. If they want different ideas or separate prices for different parts of the job, just say so and I'll break them out properly. Add the site photos too and I'll build it with you.`,
        },
      ])
    } catch (saveError) {
      setCustomerError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not update customer details.'
      )
    } finally {
      setCustomerSaving(false)
    }
  }

  async function uploadPhoto(file: File, id: string) {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/ai/quote/photos', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Photo upload failed.')
      }

      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id
            ? { ...photo, uploadedUrl: data.url, status: 'uploaded' }
            : photo
        )
      )
    } catch {
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id ? { ...photo, status: 'failed' } : photo
        )
      )
    }
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    const remaining = Math.max(0, 12 - photos.length)
    const selected = files.slice(0, remaining)

    if (files.length > remaining) {
      setError('You can keep up to 12 site photos in one quote chat.')
    }

    for (const file of selected) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 10 * 1024 * 1024) continue

      const id = createId('photo')
      const previewUrl = URL.createObjectURL(file)

      setPhotos((current) => [
        ...current,
        {
          id,
          fileName: file.name,
          previewUrl,
          uploadedUrl: '',
          status: 'uploading',
        },
      ])

      void uploadPhoto(file, id)
    }
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === photoId)
      if (photo?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
      return current.filter((item) => item.id !== photoId)
    })
  }

  async function handleSend() {
    const trimmed = question.trim()

    if (!trimmed && uploadedPhotos.length === 0) {
      setError('Tell me something about the job or add a site photo first.')
      return
    }

    if (uploadsInProgress) {
      setError('One of the site photos is still uploading.')
      return
    }

    const userMessage: ChatMessage = {
      id: createId('trev'),
      role: 'user',
      text:
        trimmed ||
        `I've added ${uploadedPhotos.length} site ${uploadedPhotos.length === 1 ? 'photo' : 'photos'}. Review them as part of this quote.`,
      photoNames: uploadedPhotos.map((photo) => photo.fileName),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setQuestion('')
    setBusy(true)
    setError('')
    setSentToKelly(false)

    try {
      const response = await fetch('/api/ai/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'price',
          customerName,
          jobDetails: buildTranscript(nextMessages),
          additionalInstructions: QUOTE_INSTRUCTIONS,
          photos: uploadedPhotos.map((photo) => ({
            url: photo.uploadedUrl,
            label: 'Site photo',
          })),
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'I could not price that quote.')

      const result = data as PricingResult
      setPricingResult(result)
      setMessages([
        ...nextMessages,
        { id: createId('chas'), role: 'assistant', text: pricingReply(result) },
      ])
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Something went wrong while I was working the quote out.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleSendToKelly() {
    if (!job?.customer?.id || !pricingResult || pricingResult.recommendedPriceExVat <= 0) {
      setError('I need a complete customer and proper quote before sending to Kelly.')
      return
    }

    setSendingToKelly(true)
    setError('')

    try {
      const options = Array.isArray(pricingResult.options) ? pricingResult.options : []
      const quoteMode = pricingResult.quoteMode || (pricingResult.optionMode ? 'alternatives' : 'single')
      const confirmedScope = [
        pricingResult.summary,
        ...(Array.isArray(pricingResult.confirmedInformation)
          ? pricingResult.confirmedInformation
          : []),
      ]
        .filter(Boolean)
        .join('\n')

      const writeResponse = await fetch('/api/ai/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          customerName,
          quoteMode,
          options,
          combinedOffer: pricingResult.combinedOffer || null,
          jobDetails: confirmedScope || pricingResult.summary,
          additionalInstructions:
            pricingResult.optionMode
              ? 'Prepare a customer-ready options quotation for Kelly to review. Show every option/package separately. The customer has not chosen yet. If an all-together package price is supplied, show it clearly after the individual prices.'
              : 'Prepare the customer-ready draft for Kelly to review before she sends it. Do not invent any scope beyond the confirmed information.',
          priceExVat: pricingResult.recommendedPriceExVat,
          vatRate: pricingResult.vatRate || 20,
          depositPercent: pricingResult.depositPercent ?? 25,
        }),
      })

      const quoteData = await writeResponse.json().catch(() => null)
      if (!writeResponse.ok) {
        throw new Error(quoteData?.error || 'I could not write the customer quote.')
      }

      const quote = quoteData as QuoteResult
      const transcript = buildTranscript(messages)
      const duration = pricingResult.estimatedDuration
      const optionSummary = pricingResult.optionMode
        ? options
            .map((option) => {
              const days = option.estimatedDuration?.workingDays || 0
              const team = option.estimatedDuration?.teamSize || 1
              return `${option.label} — ${option.title}: ${money(option.priceExVat)} + VAT (${money(option.totalIncVat)} total)${days ? ` — ${days} ${days === 1 ? 'day' : 'days'} with ${team}` : ''}\n${option.summary}`
            })
            .join('\n\n')
        : ''

      const combinedSummary = pricingResult.combinedOffer?.available
        ? [
            `${pricingResult.combinedOffer.label}: ${money(pricingResult.combinedOffer.priceExVat)} + VAT (${money(pricingResult.combinedOffer.totalIncVat)} total)`,
            pricingResult.combinedOffer.estimatedDuration?.workingDays
              ? `Combined install: ${pricingResult.combinedOffer.estimatedDuration.workingDays} ${pricingResult.combinedOffer.estimatedDuration.workingDays === 1 ? 'day' : 'days'} with ${pricingResult.combinedOffer.estimatedDuration.teamSize || 1}`
              : '',
            pricingResult.combinedOffer.savingExVat > 0
              ? `Saving vs separate packages: ${money(pricingResult.combinedOffer.savingExVat)} + VAT`
              : '',
            pricingResult.combinedOffer.savingReason || '',
          ]
            .filter(Boolean)
            .join('\n')
        : ''

      const internalWorkSummary = [
        'CHAS QUOTE DRAFT FOR KELLY',
        '',
        `Customer: ${customerName}`,
        `Phone: ${customerPhone}`,
        `Postcode: ${customerPostcode}`,
        customerAddress ? `Address: ${customerAddress}` : '',
        customerEmail ? `Email: ${customerEmail}` : '',
        `Original quote visit job: #${job.id}`,
        `Quote mode: ${quoteMode}`,
        '',
        `Scope: ${pricingResult.summary}`,
        pricingResult.optionMode && optionSummary ? `Options / packages:\n${optionSummary}` : '',
        combinedSummary ? `\n${combinedSummary}` : '',
        `Price ex VAT: ${money(pricingResult.recommendedPriceExVat)}`,
        `VAT: ${money(pricingResult.vatAmount)}`,
        `Total inc VAT: ${money(pricingResult.recommendedTotalIncVat)}`,
        duration?.workingDays
          ? `Estimated install: ${duration.workingDays} ${duration.workingDays === 1 ? 'day' : 'days'}, ${duration.teamSize || 1} ${duration.teamSize === 1 ? 'person' : 'people'}`
          : '',
        '',
        'Customer-ready draft:',
        quote.whatsappQuote,
        '',
        'Trevor / CHAS quote conversation:',
        transcript,
      ]
        .filter(Boolean)
        .join('\n')

      const sendResponse = await fetch('/api/chas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: 'furlads',
          worker: 'Trevor',
          customerId: job.customer.id,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          customerPostcode,
          jobId: job.id,
          sessionId: sessionIdRef.current,
          question: pricingResult.optionMode
            ? 'Options quote draft ready for Kelly review'
            : 'Quote draft ready for Kelly review',
          answer: quote.whatsappQuote,
          intent: 'quote_request',
          confidence: 1,
          escalateTo: 'kelly',
          safetyFlag: false,
          workSummary: internalWorkSummary,
          roughPriceText: pricingResult.optionMode
            ? `${options.length} priced ${quoteMode === 'packages' ? 'packages' : 'options'}${pricingResult.combinedOffer?.available ? ` / all together ${money(pricingResult.combinedOffer.priceExVat)} + VAT` : ''}`
            : `${money(pricingResult.recommendedPriceExVat)} + VAT / ${money(pricingResult.recommendedTotalIncVat)} total`,
          enquirySummary: pricingResult.optionMode
            ? `Trevor completed assigned quote visit #${job.id} with ${options.length} customer choices ready for Kelly review. ${pricingResult.summary}`
            : `Trevor completed assigned quote visit #${job.id}. ${pricingResult.summary}`,
          enquiryReadyForKelly: true,
        }),
      })

      const sentData = await sendResponse.json().catch(() => null)
      if (!sendResponse.ok || sentData?.success === false) {
        throw new Error('The quote was written, but I could not send it to Kelly.')
      }

      setMessages((current) => [
        ...current,
        {
          id: createId('chas'),
          role: 'assistant',
          text: pricingResult.optionMode
            ? "Done 👍 I've sent all of the customer options to Kelly for review, including the all-together price where there is one."
            : "Done 👍 I've sent this quote to Kelly and kept it linked to the original quote visit.",
        },
      ])
      setSentToKelly(true)
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'I could not send the quote to Kelly.'
      )
    } finally {
      setSendingToKelly(false)
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (!busy && !sendingToKelly) void handleSend()
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-100 p-4 text-zinc-700">
        Loading quote visit…
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-[100dvh] bg-zinc-100 p-4">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-5">
          <h1 className="text-xl font-black">Could not open quote visit</h1>
          <p className="mt-2 text-sm text-red-700">{customerError || 'Quote visit not found.'}</p>
          <Link href="/trev" className="mt-4 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">
            Back to Trev dashboard
          </Link>
        </div>
      </main>
    )
  }

  if (!customerReady) {
    return (
      <main className="min-h-[100dvh] bg-zinc-100 px-3 py-4 text-zinc-950 sm:px-5">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-yellow-300">C</div>
              <div>
                <div className="font-black">CHAS · Assigned Quote</div>
                <div className="text-xs font-medium text-zinc-500">Quote visit #{job.id}</div>
              </div>
            </div>
            <Link href="/trev" className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-bold text-white">Back</Link>
          </div>

          <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Customer check</p>
            <h1 className="mt-1 text-2xl font-black">Confirm the customer details</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              These have been loaded from Kelly’s quote visit. Correct anything that has changed before starting CHAS.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold">Name *</span>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600" />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Phone number *</span>
                <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600" />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Postcode *</span>
                <input value={customerPostcode} onChange={(e) => setCustomerPostcode(e.target.value.toUpperCase())} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base uppercase outline-none focus:border-zinc-600" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold">Address</span>
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold">Email</span>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600" />
              </label>
            </div>

            {customerError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{customerError}</div> : null}

            <button type="button" onClick={handleStartQuote} disabled={customerSaving} className="mt-5 min-h-12 w-full rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black disabled:opacity-50">
              {customerSaving ? 'Updating customer…' : 'Confirm details & start quote with CHAS'}
            </button>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-100 text-zinc-950">
      <header className="flex-none border-b border-zinc-200 bg-white px-3 py-3 sm:px-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-yellow-300">C</div>
            <div className="min-w-0">
              <div className="truncate text-base font-black">CHAS · Quote visit</div>
              <button type="button" onClick={() => setCustomerReady(false)} className="block max-w-full truncate text-left text-xs font-bold text-zinc-500 underline decoration-zinc-300 underline-offset-2">
                {customerName} · {customerPostcode}
              </button>
            </div>
          </div>
          <Link href="/trev" className="flex min-h-10 items-center rounded-xl bg-zinc-950 px-3 text-xs font-bold text-white">Back</Link>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-3 py-5 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-[15px] leading-6 shadow-sm sm:max-w-[82%] ${message.role === 'user' ? 'rounded-br-lg bg-zinc-950 text-white' : 'rounded-bl-lg border border-zinc-200 bg-white text-zinc-900'}`}>
                {message.text}
              </div>
            </div>
          ))}
          {busy ? <div className="flex justify-start"><div className="rounded-3xl rounded-bl-lg border border-zinc-200 bg-white px-4 py-3 text-[15px] font-medium text-zinc-600 shadow-sm">I’m working that quote out…</div></div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div> : null}
          <div ref={messagesEndRef} />
        </div>
      </section>

      <footer className="flex-none border-t border-zinc-200 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <div className="mx-auto max-w-3xl">
          {photos.length ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo) => (
                <div key={photo.id} className="relative h-16 w-16 flex-none overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={photo.fileName} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removePhoto(photo.id)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-black text-white">×</button>
                  <div className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-bold text-white ${photo.status === 'uploaded' ? 'bg-green-700/90' : photo.status === 'failed' ? 'bg-red-700/90' : 'bg-black/70'}`}>{photo.status === 'uploaded' ? 'Ready' : photo.status === 'failed' ? 'Failed' : 'Uploading'}</div>
                </div>
              ))}
            </div>
          ) : null}

          {pricingResult?.optionMode && !sentToKelly ? (
            <div className="mb-3 rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-center text-sm font-bold text-yellow-900">
              These choices can go to the customer before they decide. Kelly can review and send the full options quote.
            </div>
          ) : null}

          {pricingResult && !sentToKelly ? (
            <button type="button" onClick={handleSendToKelly} disabled={busy || sendingToKelly || uploadsInProgress} className="mb-3 min-h-12 w-full rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black shadow-sm disabled:opacity-50">
              {sendingToKelly
                ? 'Writing it up and sending to Kelly…'
                : pricingResult.optionMode
                  ? 'Happy with these options — send to Kelly'
                  : 'Happy with this — send to Kelly'}
            </button>
          ) : null}

          {sentToKelly ? <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-bold text-green-800">Sent to Kelly for review ✓</div> : null}

          <div className="flex items-end gap-2 rounded-3xl border border-zinc-300 bg-zinc-50 p-2 shadow-sm focus-within:border-zinc-500">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoSelection} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy || sendingToKelly || photos.length >= 12} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-xl shadow-sm ring-1 ring-zinc-200 disabled:opacity-40">📷</button>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={handleComposerKeyDown} rows={2} placeholder="Tell Chas about the job…" className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-base leading-6 outline-none placeholder:text-zinc-400" disabled={busy || sendingToKelly} />
            <button type="button" onClick={handleSend} disabled={busy || sendingToKelly || uploadsInProgress} className="flex h-11 min-w-11 flex-none items-center justify-center rounded-full bg-zinc-950 px-3 text-sm font-black text-white disabled:opacity-40">↑</button>
          </div>
          <div className="mt-2 text-center text-[11px] font-medium text-zinc-400">Enter sends · Shift + Enter adds a new line · up to 12 site photos</div>
        </div>
      </footer>
    </main>
  )
}
