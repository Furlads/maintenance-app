'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Worker = {
  id: number
  firstName: string
  lastName: string
  phone: string | null
}

type JobAssignment = {
  id: number
  workerId: number
  worker: Worker
}

type Customer = {
  id: number
  name: string
  phone: string | null
  address: string | null
  postcode: string | null
}

type Job = {
  id: number
  title: string
  address: string
  notes: string | null
  status: string
  jobType: string
  createdAt: string
  customer: Customer
  assignments: JobAssignment[]
}

type JobPhoto = {
  id: number
  jobId: number
  uploadedByWorkerId: number | null
  label: string | null
  imageUrl: string
  createdAt: string
}

export default function JobPage() {
  const params = useParams()
  const id = Number(params.id)

  const [job, setJob] = useState<Job | null>(null)
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [label, setLabel] = useState('Before')
  const [uploading, setUploading] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  async function loadPhotos() {
    const res = await fetch(`/api/jobs/${id}/photos`, { cache: 'no-store' })
    const data = await res.json()
    setPhotos(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    async function loadJob() {
      try {
        const [jobRes, photoRes] = await Promise.all([
          fetch('/api/jobs', { cache: 'no-store' }),
          fetch(`/api/jobs/${id}/photos`, { cache: 'no-store' })
        ])

        const jobData = await jobRes.json()
        const jobs = Array.isArray(jobData) ? jobData : []
        const foundJob = jobs.find((item: Job) => item.id === id) || null
        setJob(foundJob)

        const photoData = await photoRes.json()
        setPhotos(Array.isArray(photoData) ? photoData : [])
      } catch (err) {
        setError('Failed to load job.')
      } finally {
        setLoading(false)
      }
    }

    if (id) loadJob()
  }, [id])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const workerId = localStorage.getItem('workerId')

    if (!file) return

    setUploading(true)
    setPhotoMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', label)

      if (workerId) formData.append('workerId', workerId)

      const res = await fetch(`/api/jobs/${id}/photos`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (data?.id) {
        setPhotos((p) => [data, ...p])
      } else {
        await loadPhotos()
      }

      setPhotoMessage('Photo uploaded successfully.')
      event.target.value = ''
    } catch {
      setPhotoMessage('Failed to upload photo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (!confirm('Delete this photo?')) return

    setDeletingPhotoId(photoId)

    try {
      await fetch(`/api/job-photos/${photoId}`, { method: 'DELETE' })
      setPhotos((p) => p.filter((photo) => photo.id !== photoId))
    } finally {
      setDeletingPhotoId(null)
    }
  }

  if (loading) return <main style={{ padding: 20 }}>Loading job...</main>
  if (error) return <main style={{ padding: 20 }}>{error}</main>
  if (!job) return <main style={{ padding: 20 }}>Job not found</main>

  const navigationQuery =
    job.customer?.postcode || job.address || job.customer?.address || ''

  return (
    <main style={{ padding: 20, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>{job.title}</h1>

      <div style={{ marginBottom: 24 }}>
        {job.customer?.phone && (
          <a href={`tel:${job.customer.phone}`} style={{ marginRight: 12 }}>
            Call Customer
          </a>
        )}

        {navigationQuery && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
            target="_blank"
          >
            Navigate
          </a>
        )}
      </div>

      <h2>Photos</h2>

      <div style={{ marginBottom: 20 }}>
        <select
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          <option>Before</option>
          <option>During</option>
          <option>After</option>
          <option>Other</option>
        </select>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
        />

        {photoMessage && <p>{photoMessage}</p>}
      </div>

      {photos.length === 0 && <p>No photos uploaded yet.</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 16
        }}
      >
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 10
            }}
          >
            <img
              src={photo.imageUrl}
              alt=""
              onClick={() => setViewerIndex(index)}
              style={{
                width: '100%',
                height: 180,
                objectFit: 'cover',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            />

            <p style={{ marginTop: 6 }}>{photo.label}</p>

            <button
              onClick={() => handleDeletePhoto(photo.id)}
              disabled={deletingPhotoId === photo.id}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {viewerIndex !== null && (
        <div
          onClick={() => setViewerIndex(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <img
            src={photos[viewerIndex].imageUrl}
            style={{
              maxWidth: '95%',
              maxHeight: '95%',
              objectFit: 'contain'
            }}
          />

          <button
            onClick={(e) => {
              e.stopPropagation()
              setViewerIndex(null)
            }}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              fontSize: 24,
              background: 'none',
              border: 'none',
              color: 'white'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </main>
  )
}