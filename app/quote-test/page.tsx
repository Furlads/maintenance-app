'use client'

import Link from 'next/link'
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type UploadedPhoto = {
  id: string
  fileName: string
  previewUrl: string
  uploadedUrl: string
  label: string
  status: 'uploading' | 'uploaded' | 'failed'
  error?: string
}

type CostItem = {
  category: string
  description: string
  estimatedCost: number
}

type PhotoObservation = {
  observation: string
  potentialImpact: string
  checkRequired: string
}

type PotentialIssue = {
  title: string
  details: string
  pricingImpact: string
}

type PricingResult = {
  summary: string
  confirmedInformation: string[]
  photoObservations: PhotoObservation[]
  potentialIssues: PotentialIssue[]
  assumptions: string[]
  missingInformation: string[]
  estimatedDuration: {
    workingDays: number
    teamSize: number
    description: string
  }
  costBreakdown: CostItem[]
  estimatedHardCosts: number
  recommendedPriceExVat: number
  vatRate: number
  vatAmount: number
  recommendedTotalIncVat: number
  depositPercent: number
  depositAmount: number
  pricingNotes: string[]
}

type QuoteResult = {
  whatsappQuote: string
  scopeItems: string[]
  customerSummary: string
  warnings: string[]
  priceExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  depositPercent: number
  depositAmount: number
}

const PHOTO_LABELS = [
  'Overall garden',
  'Access',
  'Existing patio',
  'Fence',
  'Drainage',
  'Ground levels',
  'Waste',
  'Measurements',
  'Customer drawing',
  'Potential issue',
  'Before',
]

function money(value: number | string | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(amount) ? amount : 0)
}

function asNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function createPhotoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function QuoteTestPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [jobDetails, setJobDetails] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState(
    'Keep the quote warm, detailed and exciting while remaining easy to read on WhatsApp.'
  )

  const [photos, setPhotos] = useState<UploadedPhoto[]>([])

  const [priceExVat, setPriceExVat] = useState('')
  const [vatRate, setVatRate] = useState('20')
  const [depositPercent, setDepositPercent] = useState('25')

  const [pricingResult, setPricingResult] =
    useState<PricingResult | null>(null)

  const [quoteResult, setQuoteResult] =
    useState<QuoteResult | null>(null)

  const [pricing, setPricing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [copying, setCopying] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const photoUploadsInProgress = photos.some(
    (photo) => photo.status === 'uploading'
  )

  const calculatedFigures = useMemo(() => {
    const exVat = asNumber(priceExVat)
    const vat = asNumber(vatRate)
    const deposit = asNumber(depositPercent)

    const vatAmount = (exVat * vat) / 100
    const total = exVat + vatAmount
    const depositAmount = (total * deposit) / 100

    return {
      vatAmount,
      total,
      depositAmount,
    }
  }, [priceExVat, vatRate, depositPercent])

  async function uploadPhoto(
    file: File,
    id: string,
    previewUrl: string
  ) {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/ai/quote/photos', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
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

  async function handlePhotoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(event.target.files || [])

    if (!selectedFiles.length) return

    setError('')
    setSuccess('')

    const remainingSpaces = Math.max(0, 12 - photos.length)
    const filesToUpload = selectedFiles.slice(0, remainingSpaces)

    if (selectedFiles.length > remainingSpaces) {
      setError('You can upload a maximum of 12 site photographs.')
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

      const id = createPhotoId()
      const previewUrl = URL.createObjectURL(file)

      const newPhoto: UploadedPhoto = {
        id,
        fileName: file.name,
        previewUrl,
        uploadedUrl: '',
        label:
          photos.length === 0 ? 'Overall garden' : 'Site photo',
        status: 'uploading',
      }

      setPhotos((current) => [...current, newPhoto])

      void uploadPhoto(file, id, previewUrl)
    }

    event.target.value = ''
  }

  function updatePhotoLabel(photoId: string, label: string) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              label,
            }
          : photo
      )
    )
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

  async function requestQuote(
    action: 'price' | 'write'
  ): Promise<PricingResult | QuoteResult> {
    const response = await fetch('/api/ai/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        customerName,
        jobDetails,
        additionalInstructions,
        priceExVat: asNumber(priceExVat),
        vatRate: asNumber(vatRate),
        depositPercent: asNumber(depositPercent),
        photos: uploadedPhotos.map((photo) => ({
          url: photo.uploadedUrl,
          label: photo.label || 'Site photo',
        })),
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        data?.error || 'The quote could not be generated.'
      )
    }

    return data
  }

  async function handlePriceJob() {
    try {
      setPricing(true)
      setError('')
      setSuccess('')
      setQuoteResult(null)

      const result = (await requestQuote(
        'price'
      )) as PricingResult

      setPricingResult(result)
      setPriceExVat(
        String(result.recommendedPriceExVat || 0)
      )
      setVatRate(String(result.vatRate ?? 20))
      setDepositPercent(
        String(result.depositPercent ?? 25)
      )

      setSuccess(
        'Pricing and site review completed. Check all assumptions and potential issues before using the price.'
      )
    } catch (pricingError) {
      console.error(pricingError)

      setError(
        pricingError instanceof Error
          ? pricingError.message
          : 'Unable to price the job.'
      )
    } finally {
      setPricing(false)
    }
  }

  async function handleWriteQuote() {
    try {
      setWriting(true)
      setError('')
      setSuccess('')

      const result = (await requestQuote(
        'write'
      )) as QuoteResult

      setQuoteResult(result)
      setSuccess(
        'WhatsApp quotation written and ready to copy.'
      )
    } catch (writingError) {
      console.error(writingError)

      setError(
        writingError instanceof Error
          ? writingError.message
          : 'Unable to write the quotation.'
      )
    } finally {
      setWriting(false)
    }
  }

  async function handleCopy() {
    if (!quoteResult?.whatsappQuote) return

    try {
      setCopying(true)

      await navigator.clipboard.writeText(
        quoteResult.whatsappQuote
      )

      setSuccess(
        'Quote copied. You can paste it straight into WhatsApp.'
      )
    } catch {
      setError(
        'The browser could not copy automatically. Select the message and copy it manually.'
      )
    } finally {
      setCopying(false)
    }
  }

  const canPrice =
    !pricing &&
    !writing &&
    !photoUploadsInProgress &&
    (jobDetails.trim().length > 0 ||
      uploadedPhotos.length > 0)

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                Furlads AI
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                Price and write up quote
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Add the site details and photographs. The AI will
                review the job, highlight potential issues and help
                produce a WhatsApp-ready quotation.
              </p>
            </div>

            <Link
              href="/jobs"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              Back to jobs
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-5">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <h2 className="text-lg font-bold text-slate-900">
                1. Customer and job
              </h2>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Customer name
                  </span>

                  <input
                    value={customerName}
                    onChange={(event) =>
                      setCustomerName(event.target.value)
                    }
                    className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="Customer name"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Job notes and measurements
                  </span>

                  <textarea
                    value={jobDetails}
                    onChange={(event) =>
                      setJobDetails(event.target.value)
                    }
                    rows={11}
                    className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base leading-6 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="Describe what the customer wants, measurements, materials, access, waste and anything that needs retaining..."
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <h2 className="text-lg font-bold text-slate-900">
                2. Site photographs
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Take clear photographs of the overall garden,
                access, levels, drainage, existing surfaces and
                anything that could affect the work.
              </p>

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
                disabled={photos.length >= 12}
                className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                📷 Take or upload photographs
              </button>

              <p className="mt-2 text-center text-xs text-slate-500">
                {photos.length}/12 photographs
              </p>

              {photos.length ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <article
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="aspect-square bg-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.previewUrl}
                          alt={photo.label || photo.fileName}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="space-y-2 p-2">
                        <select
                          value={photo.label}
                          onChange={(event) =>
                            updatePhotoLabel(
                              photo.id,
                              event.target.value
                            )
                          }
                          className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
                        >
                          <option value="Site photo">
                            Site photo
                          </option>

                          {PHOTO_LABELS.map((label) => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </select>

                        <div className="text-xs">
                          {photo.status === 'uploading' ? (
                            <span className="font-semibold text-amber-700">
                              Uploading…
                            </span>
                          ) : null}

                          {photo.status === 'uploaded' ? (
                            <span className="font-semibold text-green-700">
                              Uploaded
                            </span>
                          ) : null}

                          {photo.status === 'failed' ? (
                            <span className="font-semibold text-red-700">
                              {photo.error || 'Upload failed'}
                            </span>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removePhoto(photo.id)
                          }
                          className="min-h-10 w-full rounded-lg border border-red-200 bg-white px-2 text-sm font-bold text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Extra instructions
                </span>

                <textarea
                  value={additionalInstructions}
                  onChange={(event) =>
                    setAdditionalInstructions(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base leading-6 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </label>

              <button
                type="button"
                onClick={handlePriceJob}
                disabled={!canPrice}
                className="mt-4 min-h-14 w-full rounded-xl bg-slate-900 px-4 py-3 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {photoUploadsInProgress
                  ? 'Uploading photographs…'
                  : pricing
                    ? 'Reviewing and pricing…'
                    : '✨ Review Photos and Price Job'}
              </button>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <h2 className="text-lg font-bold text-slate-900">
                3. Approved figures
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Review and amend the price before writing the
                customer message.
              </p>

              <div className="mt-4 space-y-4 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Price ex VAT
                  </span>

                  <div className="flex min-h-12 overflow-hidden rounded-xl border border-slate-300">
                    <span className="flex items-center bg-slate-50 px-3 text-slate-600">
                      £
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceExVat}
                      onChange={(event) =>
                        setPriceExVat(event.target.value)
                      }
                      className="min-w-0 flex-1 px-3 text-base outline-none"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    VAT
                  </span>

                  <div className="flex min-h-12 overflow-hidden rounded-xl border border-slate-300">
                    <input
                      type="number"
                      min="0"
                      value={vatRate}
                      onChange={(event) =>
                        setVatRate(event.target.value)
                      }
                      className="min-w-0 flex-1 px-3 text-base outline-none"
                    />

                    <span className="flex items-center bg-slate-50 px-3 text-slate-600">
                      %
                    </span>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Deposit
                  </span>

                  <div className="flex min-h-12 overflow-hidden rounded-xl border border-slate-300">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={depositPercent}
                      onChange={(event) =>
                        setDepositPercent(
                          event.target.value
                        )
                      }
                      className="min-w-0 flex-1 px-3 text-base outline-none"
                    />

                    <span className="flex items-center bg-slate-50 px-3 text-slate-600">
                      %
                    </span>
                  </div>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">
                    VAT
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {money(calculatedFigures.vatAmount)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Total
                  </p>

                  <p className="mt-1 text-sm font-bold text-green-700">
                    {money(calculatedFigures.total)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Deposit
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {money(
                      calculatedFigures.depositAmount
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWriteQuote}
                disabled={
                  pricing ||
                  writing ||
                  !jobDetails.trim() ||
                  asNumber(priceExVat) <= 0
                }
                className="mt-4 min-h-14 w-full rounded-xl bg-green-700 px-4 py-3 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {writing
                  ? 'Writing quotation…'
                  : '🌿 Write Up WhatsApp Quote'}
              </button>
            </div>
          </section>

          <section className="space-y-5">
            {pricingResult ? (
              <>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                  <p className="text-sm font-bold text-green-700">
                    Internal use
                  </p>

                  <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h2 className="text-xl font-bold text-slate-900">
                      Pricing recommendation
                    </h2>

                    <div className="rounded-xl bg-green-50 p-3">
                      <p className="text-xs font-bold uppercase text-green-700">
                        Suggested
                      </p>

                      <p className="mt-1 text-lg font-bold text-green-800">
                        {money(
                          pricingResult.recommendedPriceExVat
                        )}{' '}
                        + VAT
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    {pricingResult.summary}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoBox
                      label="Duration"
                      value={
                        pricingResult.estimatedDuration
                          ?.description || 'Not supplied'
                      }
                    />

                    <InfoBox
                      label="Estimated hard costs"
                      value={money(
                        pricingResult.estimatedHardCosts
                      )}
                    />
                  </div>
                </div>

                {pricingResult.potentialIssues?.length ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
                    <h2 className="text-lg font-bold text-amber-950">
                      ⚠️ Potential issues to check
                    </h2>

                    <div className="mt-3 space-y-3">
                      {pricingResult.potentialIssues.map(
                        (issue, index) => (
                          <article
                            key={`${issue.title}-${index}`}
                            className="rounded-xl border border-amber-200 bg-white p-3"
                          >
                            <h3 className="font-bold text-amber-950">
                              {issue.title}
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-amber-900">
                              {issue.details}
                            </p>

                            <p className="mt-2 text-sm font-semibold text-amber-950">
                              Possible impact:{' '}
                              {issue.pricingImpact}
                            </p>
                          </article>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                {pricingResult.photoObservations?.length ? (
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                    <h2 className="text-lg font-bold text-slate-900">
                      Photo review
                    </h2>

                    <div className="mt-3 space-y-3">
                      {pricingResult.photoObservations.map(
                        (observation, index) => (
                          <article
                            key={index}
                            className="rounded-xl bg-slate-50 p-3"
                          >
                            <p className="font-bold text-slate-900">
                              {observation.observation}
                            </p>

                            <p className="mt-1 text-sm text-slate-700">
                              {observation.potentialImpact}
                            </p>

                            <p className="mt-2 text-sm font-semibold text-green-800">
                              Check:{' '}
                              {observation.checkRequired}
                            </p>
                          </article>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                {pricingResult.costBreakdown?.length ? (
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                    <h2 className="text-lg font-bold text-slate-900">
                      Cost breakdown
                    </h2>

                    <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                      {pricingResult.costBreakdown.map(
                        (item, index) => (
                          <div
                            key={`${item.category}-${index}`}
                            className="flex items-start justify-between gap-3 p-3"
                          >
                            <div>
                              <p className="font-bold text-slate-900">
                                {item.category}
                              </p>

                              <p className="mt-1 text-sm text-slate-600">
                                {item.description}
                              </p>
                            </div>

                            <p className="shrink-0 font-bold text-slate-900">
                              {money(item.estimatedCost)}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                <ListSection
                  title="Missing information"
                  items={
                    pricingResult.missingInformation
                  }
                  warning
                />

                <ListSection
                  title="Assumptions used"
                  items={pricingResult.assumptions}
                />

                <ListSection
                  title="Internal pricing notes"
                  items={pricingResult.pricingNotes}
                />
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-7 text-center">
                <p className="text-4xl">📸</p>

                <h2 className="mt-3 text-lg font-bold text-slate-900">
                  Site review will appear here
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upload the site photographs and enter your notes,
                  then press Review Photos and Price Job.
                </p>
              </div>
            )}

            {quoteResult ? (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-green-700">
                      Customer ready
                    </p>

                    <h2 className="text-xl font-bold text-slate-900">
                      WhatsApp quotation
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={copying}
                    className="min-h-12 rounded-xl bg-green-700 px-5 py-3 font-bold text-white disabled:opacity-50"
                  >
                    {copying
                      ? 'Copying…'
                      : 'Copy quotation'}
                  </button>
                </div>

                <textarea
                  value={quoteResult.whatsappQuote}
                  onChange={(event) =>
                    setQuoteResult((current) =>
                      current
                        ? {
                            ...current,
                            whatsappQuote:
                              event.target.value,
                          }
                        : current
                    )
                  }
                  rows={24}
                  className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base leading-7 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />

                <ListSection
                  title="Check before sending"
                  items={quoteResult.warnings}
                  warning
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

function InfoBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function ListSection({
  title,
  items,
  warning = false,
}: {
  title: string
  items?: string[]
  warning?: boolean
}) {
  if (!items?.length) return null

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 ${
        warning
          ? 'border border-amber-300 bg-amber-50'
          : 'bg-white shadow-sm ring-1 ring-slate-200'
      }`}
    >
      <h2
        className={`text-lg font-bold ${
          warning ? 'text-amber-950' : 'text-slate-900'
        }`}
      >
        {title}
      </h2>

      <ul
        className={`mt-3 space-y-2 text-sm leading-6 ${
          warning ? 'text-amber-950' : 'text-slate-700'
        }`}
      >
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex items-start gap-2"
          >
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}