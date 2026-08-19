'use client'

import Link from 'next/link'
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

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
  error?: string
}

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
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
  combinedOffers?: CombinedOffer[]
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
  warnings?: string[]
}

const QUOTE_INSTRUCTIONS = `
Treat this as an ongoing conversation with Trevor while he is building a Furlads landscaping quote.
The latest Trevor message overrides earlier details if anything has changed.
Previous CHAS replies and prices are provisional context only. Do not treat them as extra scope and do not double-count them.

If the customer wants choices, separate prices, "another quote", or gives Option 1 / Option 2, show those customer-visible prices separately before asking them to choose.
A quote can contain both mutually exclusive alternatives and separate purchasable jobs at the same time.
Example: 20m fence Option 1, 20m fence Option 2, another 13m fence, and artificial grass. In that case show both 20m alternatives separately, show the 13m fence separately, show the artificial grass separately, and give valid all-together totals for each 20m alternative combined with the compatible extra jobs.
Never put mutually exclusive alternatives into the same combined total.
Customers should be able to see the options before making a decision, and the whole options quote can go to Kelly for review before they choose.

Furlads OS pricing rules:
- Standard selling rates are all-in selling prices and already include normal labour, materials, standard machinery, standard waste, deliveries, consumables, overheads and profit.
- Do not add those normal components again on top of an applicable standard selling rate.
- Current standard examples: Indian sandstone £140/m², porcelain £170/m², artificial grass £110/m².
- Only genuine exceptional extras should increase a standard-rate quote, such as drainage, difficult access, concrete breakout, retaining walls, excess excavation, specialist machinery or unusual waste.
- Protect margin and flag anything Trevor should check rather than inventing hidden conditions.
- Price excluding VAT, with VAT shown separately.
- Keep assumptions sensible and practical.
- Install times must be realistic for a human crew and should be rounded up rather than squeezed down.
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

function normalisePhone(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function normalisePostcode(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, '').toUpperCase()
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

function getCombinedOffers(result: PricingResult) {
  if (Array.isArray(result.combinedOffers) && result.combinedOffers.length) {
    return result.combinedOffers
  }

  return result.combinedOffer?.available ? [result.combinedOffer] : []
}

function pricingReply(result: PricingResult) {
  const lines: string[] = []
  const options = Array.isArray(result.options) ? result.options : []
  const combinedOffers = getCombinedOffers(result)

  if (result.optionMode && options.length >= 2) {
    if (result.quoteMode === 'packages') {
      lines.push("Right — I’d show the customer these as separate priced choices/jobs rather than one lump sum.")
    } else {
      lines.push("Right — I’d show the customer the alternatives separately so they can compare them before deciding.")
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

    for (const combined of combinedOffers) {
      lines.push(combined.label)
      if (combined.summary) lines.push(combined.summary)
      if (combined.includedOptionLabels?.length) {
        lines.push(`Includes: ${combined.includedOptionLabels.join(' + ')}`)
      }
      lines.push(`Price: ${money(combined.priceExVat)} + VAT`)
      lines.push(`VAT: ${money(combined.vatAmount)}`)
      lines.push(`Total: ${money(combined.totalIncVat)}`)

      if (combined.savingExVat > 0) {
        lines.push(
          `Saving compared with those items separately: ${money(combined.savingExVat)} + VAT`
        )
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

    lines.push(
      "If those prices and descriptions look right, send the full options quote to Kelly. The customer can decide after they’ve seen it."
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
    const dayWord = result.estimatedDuration.workingDays === 1 ? 'day' : 'days'
    lines.push(
      `Likely install: ${result.estimatedDuration.workingDays} ${dayWord} with ${result.estimatedDuration.teamSize || 1} ${result.estimatedDuration.teamSize === 1 ? 'person' : 'people'}.`
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
  lines.push(
    "If anything there is wrong, just tell me normally — for example ‘make that 40m²’, ‘add drainage’ or ‘Steve reckons four days’ — and I’ll rework it."
  )

  return lines.join('\n')
}

export default function QuoteTestPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const sessionIdRef = useRef('')

  const [customerReady, setCustomerReady] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerError, setCustomerError] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerPostcode, setCustomerPostcode] = useState('')

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        "I'm Chas. Tell me about the job exactly as you would if we were stood in the garden together. Give me measurements, what the customer wants, access, levels, drainage or anything unusual. Add the site photos as well and I'll build the quote with you.",
    },
  ])
  const [question, setQuestion] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendingToKelly, setSendingToKelly] = useState(false)
  const [sentToKelly, setSentToKelly] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    sessionIdRef.current = createId('trev-quote')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCustomers() {
      try {
        setCustomersLoading(true)
        const response = await fetch('/api/customers', { cache: 'no-store' })
        const data = await response.json().catch(() => [])

        if (!response.ok) {
          throw new Error('Could not load existing customers.')
        }

        if (!cancelled) {
          setCustomers(Array.isArray(data) ? data : [])
        }
      } catch (loadError) {
        if (!cancelled) {
          setCustomerError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load existing customers.'
          )
        }
      } finally {
        if (!cancelled) {
          setCustomersLoading(false)
        }
      }
    }

    void loadCustomers()

    return () => {
      cancelled = true
    }
  }, [])

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

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase()

    if (!search) {
      return customers.slice(0, 6)
    }

    return customers
      .filter((customer) => {
        const haystack = [
          customer.name,
          customer.phone,
          customer.postcode,
          customer.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(search)
      })
      .slice(0, 8)
  }, [customerSearch, customers])

  const uploadedPhotos = useMemo(
    () => photos.filter((photo) => photo.status === 'uploaded'),
    [photos]
  )

  const uploadsInProgress = photos.some(
    (photo) => photo.status === 'uploading'
  )

  function selectCustomer(customer: Customer) {
    setCustomerId(customer.id)
    setCustomerName(customer.name || '')
    setCustomerPhone(customer.phone || '')
    setCustomerEmail(customer.email || '')
    setCustomerAddress(customer.address || '')
    setCustomerPostcode(customer.postcode || '')
    setCustomerSearch(customer.name || '')
    setCustomerError('')
  }

  function clearCustomer() {
    setCustomerId(null)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setCustomerAddress('')
    setCustomerPostcode('')
    setCustomerSearch('')
    setCustomerError('')
  }

  async function saveCustomerToId(id: number) {
    const response = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail.trim(),
        address: customerAddress.trim(),
        postcode: customerPostcode.trim(),
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error || 'Could not update customer details.')
    }

    return data as Customer
  }

  async function handleStartQuote() {
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
      let savedCustomer: Customer

      if (customerId) {
        savedCustomer = await saveCustomerToId(customerId)
      } else {
        const matchingCustomer = customers.find((customer) => {
          const samePhone =
            normalisePhone(customer.phone) &&
            normalisePhone(customer.phone) === normalisePhone(phone)

          const sameNameAndPostcode =
            customer.name.trim().toLowerCase() === name.toLowerCase() &&
            normalisePostcode(customer.postcode) === normalisePostcode(postcode)

          return Boolean(samePhone || sameNameAndPostcode)
        })

        if (matchingCustomer) {
          setCustomerId(matchingCustomer.id)
          savedCustomer = await saveCustomerToId(matchingCustomer.id)
        } else {
          const response = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              phone,
              email: customerEmail.trim(),
              address: customerAddress.trim(),
              postcode,
            }),
          })

          const data = await response.json().catch(() => null)

          if (
            response.status === 409 &&
            data?.requiresConfirmation &&
            Array.isArray(data?.duplicates) &&
            data.duplicates.length > 0
          ) {
            const duplicateId = Number(data.duplicates[0].id)
            setCustomerId(duplicateId)
            savedCustomer = await saveCustomerToId(duplicateId)
          } else {
            if (!response.ok) {
              throw new Error(data?.error || 'Could not save customer details.')
            }
            savedCustomer = data as Customer
          }
        }
      }

      setCustomerId(savedCustomer.id)
      setCustomerName(savedCustomer.name || name)
      setCustomerPhone(savedCustomer.phone || phone)
      setCustomerEmail(savedCustomer.email || '')
      setCustomerAddress(savedCustomer.address || '')
      setCustomerPostcode(savedCustomer.postcode || postcode)
      setCustomerSearch(savedCustomer.name || name)
      setCustomers((current) => {
        const withoutSaved = current.filter((item) => item.id !== savedCustomer.id)
        return [savedCustomer, ...withoutSaved]
      })
      setCustomerReady(true)
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `Right — we're quoting for ${savedCustomer.name}. Tell me what we're doing, the measurements, access, levels, drainage or anything unusual. If they want different options or separate prices for different parts, say that normally and I'll break them out properly. Add the site photos too and I'll build it with you.`,
        },
      ])
      setError('')
    } catch (saveError) {
      setCustomerError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save customer details.'
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
            ? {
                ...photo,
                uploadedUrl: data.url,
                status: 'uploaded',
                error: undefined,
              }
            : photo
        )
      )
    } catch (uploadError) {
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id
            ? {
                ...photo,
                status: 'failed',
                error:
                  uploadError instanceof Error
                    ? uploadError.message
                    : 'Photo upload failed.',
              }
            : photo
        )
      )
    }
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''

    if (!selectedFiles.length) return

    setError('')
    setSentToKelly(false)

    const remainingSpaces = Math.max(0, 12 - photos.length)
    const filesToUpload = selectedFiles.slice(0, remainingSpaces)

    if (selectedFiles.length > remainingSpaces) {
      setError('You can keep up to 12 site photos in one quote chat.')
    }

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file.`)
        continue
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10MB.`)
        continue
      }

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

      if (photo?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photo.previewUrl)
      }

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
        headers: {
          'Content-Type': 'application/json',
        },
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

      if (!response.ok) {
        throw new Error(data?.error || 'I could not price that quote.')
      }

      const result = data as PricingResult
      const assistantMessage: ChatMessage = {
        id: createId('chas'),
        role: 'assistant',
        text: pricingReply(result),
      }

      setPricingResult(result)
      setMessages([...nextMessages, assistantMessage])
    } catch (sendError) {
      console.error(sendError)
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
    if (!pricingResult || pricingResult.recommendedPriceExVat <= 0) {
      setError('I need a proper quote price before I can send anything to Kelly.')
      return
    }

    if (!customerId || !customerName.trim() || !customerPhone.trim() || !customerPostcode.trim()) {
      setError('Customer name, phone number and postcode must be saved before sending to Kelly.')
      return
    }

    setSendingToKelly(true)
    setError('')

    try {
      const options = Array.isArray(pricingResult.options) ? pricingResult.options : []
      const combinedOffers = getCombinedOffers(pricingResult)
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'write',
          customerName,
          quoteMode,
          options,
          combinedOffers,
          combinedOffer: combinedOffers[0] || null,
          jobDetails: confirmedScope || pricingResult.summary,
          additionalInstructions:
            pricingResult.optionMode
              ? 'Prepare a customer-ready options quotation for Kelly to review. Show every separate option/package price and every valid all-together combination. The customer has not chosen yet. Never combine mutually exclusive alternatives.'
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

      const combinedSummary = combinedOffers.length
        ? combinedOffers
            .map((combined) =>
              [
                `${combined.label}: ${money(combined.priceExVat)} + VAT (${money(combined.totalIncVat)} total)`,
                combined.includedOptionLabels?.length
                  ? `Includes: ${combined.includedOptionLabels.join(' + ')}`
                  : '',
                combined.estimatedDuration?.workingDays
                  ? `Combined install: ${combined.estimatedDuration.workingDays} ${combined.estimatedDuration.workingDays === 1 ? 'day' : 'days'} with ${combined.estimatedDuration.teamSize || 1}`
                  : '',
                combined.savingExVat > 0
                  ? `Saving vs those items separately: ${money(combined.savingExVat)} + VAT`
                  : '',
                combined.savingReason || '',
              ]
                .filter(Boolean)
                .join('\n')
            )
            .join('\n\n')
        : ''

      const internalWorkSummary = [
        'CHAS QUOTE DRAFT FOR KELLY',
        '',
        `Customer: ${customerName}`,
        `Phone: ${customerPhone}`,
        `Postcode: ${customerPostcode}`,
        customerAddress ? `Address: ${customerAddress}` : '',
        customerEmail ? `Email: ${customerEmail}` : '',
        `Quote mode: ${quoteMode}`,
        '',
        `Scope: ${pricingResult.summary}`,
        pricingResult.optionMode && optionSummary ? `Options / packages:\n${optionSummary}` : '',
        combinedSummary ? `All-together combinations:\n${combinedSummary}` : '',
        `Reference price ex VAT: ${money(pricingResult.recommendedPriceExVat)}`,
        `Reference VAT: ${money(pricingResult.vatAmount)}`,
        `Reference total inc VAT: ${money(pricingResult.recommendedTotalIncVat)}`,
        duration?.workingDays
          ? `Reference estimated install: ${duration.workingDays} ${duration.workingDays === 1 ? 'day' : 'days'}, ${duration.teamSize || 1} ${duration.teamSize === 1 ? 'person' : 'people'}`
          : '',
        '',
        'Customer-ready draft:',
        quote.whatsappQuote,
        '',
        'Trevor / CHAS quote conversation:',
        transcript,
      ]
        .filter((line) => line !== '')
        .join('\n')

      const sessionId = sessionIdRef.current || createId('trev-quote')
      sessionIdRef.current = sessionId

      const sendResponse = await fetch('/api/chas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: 'furlads',
          worker: 'Trevor',
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          customerPostcode,
          sessionId,
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
            ? `${options.length} separate priced choices${combinedOffers.length ? ` / ${combinedOffers.length} all-together combination${combinedOffers.length === 1 ? '' : 's'}` : ''}`
            : `${money(pricingResult.recommendedPriceExVat)} + VAT / ${money(pricingResult.recommendedTotalIncVat)} total`,
          enquirySummary: pricingResult.optionMode
            ? `Trevor has approved a CHAS multi-price quote for Kelly review with ${options.length} separate customer choices. ${pricingResult.summary}`
            : `Trevor has approved a CHAS quote draft for Kelly review. ${pricingResult.summary}`,
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
            ? "Done 👍 I've sent all of the separate customer prices and valid all-together combinations to Kelly for review."
            : "Done 👍 I've turned this into the customer-ready Furlads quote and sent the full draft to Kelly for her review before it goes to the customer.",
        },
      ])
      setSentToKelly(true)
    } catch (sendError) {
      console.error(sendError)
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'I could not send the quote to Kelly.'
      )
    } finally {
      setSendingToKelly(false)
    }
  }

  function startNewQuote() {
    setCustomerReady(false)
    clearCustomer()
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text:
          "I'm Chas. Tell me about the job exactly as you would if we were stood in the garden together.",
      },
    ])
    setQuestion('')
    setPricingResult(null)
    setSentToKelly(false)
    setError('')
    sessionIdRef.current = createId('trev-quote')

    setPhotos((current) => {
      for (const photo of current) {
        if (photo.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photo.previewUrl)
        }
      }
      return []
    })
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (!busy && !sendingToKelly) {
        void handleSend()
      }
    }
  }

  if (!customerReady) {
    return (
      <main className="min-h-[100dvh] bg-zinc-100 px-3 py-4 text-zinc-950 sm:px-5">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-yellow-300">
                C
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-black">CHAS · New Quote</div>
                <div className="truncate text-xs font-medium text-zinc-500">
                  Customer details first, then we’ll build the quote.
                </div>
              </div>
            </div>

            <Link
              href="/admin/quotes"
              className="flex min-h-10 items-center rounded-xl bg-zinc-950 px-3 text-xs font-bold text-white"
            >
              Back
            </Link>
          </div>

          <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                Step 1
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Who are we quoting for?
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Find an existing customer or enter a new one. Name, phone number and postcode are required.
              </p>
            </div>

            <div className="mt-5">
              <label className="text-sm font-bold text-zinc-800">
                Search existing customers
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Name, phone or postcode"
                  className="min-h-12 flex-1 rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600"
                />
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700"
                >
                  New
                </button>
              </div>

              {customersLoading ? (
                <div className="mt-2 text-sm text-zinc-500">Loading customers…</div>
              ) : filteredCustomers.length ? (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left last:mb-0 ${
                        customerId === customer.id
                          ? 'bg-zinc-950 text-white'
                          : 'bg-white text-zinc-900 hover:bg-zinc-100'
                      }`}
                    >
                      <div className="font-bold">{customer.name}</div>
                      <div
                        className={`mt-0.5 text-xs ${
                          customerId === customer.id
                            ? 'text-zinc-300'
                            : 'text-zinc-500'
                        }`}
                      >
                        {[customer.phone, customer.postcode]
                          .filter(Boolean)
                          .join(' · ') || 'No contact details saved'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : customerSearch.trim() ? (
                <div className="mt-2 text-sm text-zinc-500">
                  No matching customer found — enter them below as a new customer.
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-zinc-800">Name *</span>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  autoComplete="name"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600"
                  placeholder="Customer name"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-zinc-800">Phone number *</span>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  type="tel"
                  autoComplete="tel"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600"
                  placeholder="07…"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-zinc-800">Postcode *</span>
                <input
                  value={customerPostcode}
                  onChange={(event) =>
                    setCustomerPostcode(event.target.value.toUpperCase())
                  }
                  autoComplete="postal-code"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base uppercase outline-none focus:border-zinc-600"
                  placeholder="TF9 4BQ"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-zinc-800">Address</span>
                <input
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  autoComplete="street-address"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600"
                  placeholder="Optional address"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-zinc-800">Email</span>
                <input
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-600"
                  placeholder="Optional email"
                />
              </label>
            </div>

            {customerError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {customerError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleStartQuote}
              disabled={customerSaving}
              className="mt-5 min-h-12 w-full rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black text-zinc-950 shadow-sm disabled:opacity-50"
            >
              {customerSaving
                ? 'Saving customer…'
                : customerId
                  ? 'Update customer & start quote with CHAS'
                  : 'Save customer & start quote with CHAS'}
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
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-yellow-300">
              C
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-black">CHAS · Quote</div>
              <button
                type="button"
                onClick={() => setCustomerReady(false)}
                className="block max-w-full truncate text-left text-xs font-bold text-zinc-500 underline decoration-zinc-300 underline-offset-2"
              >
                {customerName} · {customerPostcode}
              </button>
            </div>
          </div>

          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={startNewQuote}
              className="min-h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-bold text-zinc-700"
            >
              New quote
            </button>
            <Link
              href="/admin/quotes"
              className="flex min-h-10 items-center rounded-xl bg-zinc-950 px-3 text-xs font-bold text-white"
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-3 py-5 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-[15px] leading-6 shadow-sm sm:max-w-[82%] ${
                  message.role === 'user'
                    ? 'rounded-br-lg bg-zinc-950 text-white'
                    : 'rounded-bl-lg border border-zinc-200 bg-white text-zinc-900'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {busy ? (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-bl-lg border border-zinc-200 bg-white px-4 py-3 text-[15px] font-medium text-zinc-600 shadow-sm">
                I’m working that quote out…
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </section>

      <footer className="flex-none border-t border-zinc-200 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <div className="mx-auto max-w-3xl">
          {photos.length ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative h-16 w-16 flex-none overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt={photo.fileName}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-black text-white"
                    aria-label={`Remove ${photo.fileName}`}
                  >
                    ×
                  </button>
                  <div
                    className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-bold text-white ${
                      photo.status === 'uploaded'
                        ? 'bg-green-700/90'
                        : photo.status === 'failed'
                          ? 'bg-red-700/90'
                          : 'bg-black/70'
                    }`}
                  >
                    {photo.status === 'uploaded'
                      ? 'Ready'
                      : photo.status === 'failed'
                        ? 'Failed'
                        : 'Uploading'}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {pricingResult?.optionMode && !sentToKelly ? (
            <div className="mb-3 rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-center text-sm font-bold text-yellow-900">
              These separate prices can go to the customer before they decide. Kelly can review and send the full options quote.
            </div>
          ) : null}

          {pricingResult && !sentToKelly ? (
            <button
              type="button"
              onClick={handleSendToKelly}
              disabled={busy || sendingToKelly || uploadsInProgress}
              className="mb-3 min-h-12 w-full rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black text-zinc-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingToKelly
                ? 'Writing it up and sending to Kelly…'
                : pricingResult.optionMode
                  ? 'Happy with these options — send to Kelly'
                  : 'Happy with this — send to Kelly'}
            </button>
          ) : null}

          {sentToKelly ? (
            <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-bold text-green-800">
              Sent to Kelly for review ✓
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-3xl border border-zinc-300 bg-zinc-50 p-2 shadow-sm focus-within:border-zinc-500">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoSelection}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || sendingToKelly || photos.length >= 12}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-xl shadow-sm ring-1 ring-zinc-200 disabled:opacity-40"
              aria-label="Add site photos"
            >
              📷
            </button>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={2}
              placeholder="Tell Chas about the job…"
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-base leading-6 outline-none placeholder:text-zinc-400"
              disabled={busy || sendingToKelly}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={busy || sendingToKelly || uploadsInProgress}
              className="flex h-11 min-w-11 flex-none items-center justify-center rounded-full bg-zinc-950 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              ↑
            </button>
          </div>

          <div className="mt-2 text-center text-[11px] font-medium text-zinc-400">
            Enter sends · Shift + Enter adds a new line · up to 12 site photos
          </div>
        </div>
      </footer>
    </main>
  )
}
