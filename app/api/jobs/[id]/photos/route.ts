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

  async function loadPhotos() {
    const res = await fetch(`/api/jobs/${id}/photos`, { cache: 'no-store' })

    if (!res.ok) {
      throw new Error('Failed to load photos')
    }

    const data = await res.json()
    setPhotos(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    async function loadJob() {
      try {
        setError('')

        const [jobRes, photoRes] = await Promise.all([
          fetch('/api/jobs', { cache: 'no-store' }),
          fetch(`/api/jobs/${id}/photos`, { cache: 'no-store' })
        ])

        if (!jobRes.ok) {
          throw new Error('Failed to load jobs')
        }

        if (!photoRes.ok) {
          throw new Error('Failed to load photos')
        }

        const jobData = await jobRes.json()
        const jobs = Array.isArray(jobData) ? jobData : []
        const foundJob = jobs.find((item: Job) => item.id === id) || null
        setJob(foundJob)

        const photoData = await photoRes.json()
        setPhotos(Array.isArray(photoData) ? photoData : [])
      } catch (err) {
        console.error(err)
        setError('Failed to load job.')
        setJob(null)
        setPhotos([])
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadJob()
    }
  }, [id])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const workerId = localStorage.getItem('workerId')

    if (!file || !id) return

    setUploading(true)
    setPhotoMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', label)

      if (workerId) {
        formData.append('workerId', workerId)
      }

      const res = await fetch(`/api/jobs/${id}/photos`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to upload photo')
      }

      await loadPhotos()
      setPhotoMessage('Photo uploaded successfully.')
      event.target.value = ''
    } catch (error) {
      console.error(error)
      setPhotoMessage('Failed to upload photo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeletePhoto(photoId: number) {
    const confirmed = window.confirm('Delete this photo?')

    if (!confirmed) return

    setDeletingPhotoId(photoId)
    setPhotoMessage('')

    try {
      const res = await fetch(`/api/job-photos/${photoId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete photo')
      }

      await loadPhotos()
      setPhotoMessage('Photo deleted successfully.')
    } catch (error) {
      console.error(error)
      setPhotoMessage('Failed to delete photo.')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <p>Loading job...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <p>{error}</p>
      </main>
    )
  }

  if (!job) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <p>Job not found.</p>
      </main>
    )
  }

  const navigationQuery =
    job.customer?.postcode || job.address || job.customer?.address || ''

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>{job.title}</h1>

      <div
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 10,
          marginBottom: 20
        }}
      >
        <p style={{ margin: '4px 0' }}>
          <strong>Customer:</strong> {job.customer?.name || 'Unknown customer'}
        </p>

        <p style={{ margin: '4px 0' }}>
          <strong>Type:</strong> {job.jobType}
        </p>

        <p style={{ margin: '4px 0' }}>
          <strong>Status:</strong> {job.status}
        </p>

        <p style={{ margin: '4px 0' }}>
          <strong>Address:</strong> {job.address}
        </p>

        {job.notes && (
          <p style={{ margin: '4px 0' }}>
            <strong>Notes:</strong> {job.notes}
          </p>
        )}

        <p style={{ margin: '4px 0' }}>
          <strong>Assigned:</strong>{' '}
          {job.assignments.length > 0
            ? job.assignments
                .map(
                  (assignment) =>
                    `${assignment.worker.firstName} ${assignment.worker.lastName}`
                )
                .join(', ')
            : 'Nobody assigned'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {job.customer?.phone && (
          <a
            href={`tel:${job.customer.phone}`}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Call Customer
          </a>
        )}

        {navigationQuery && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Navigate
          </a>
        )}
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Photos</h2>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Photo Label</label>
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 240,
                padding: 12,
                border: '1px solid #ccc',
                borderRadius: 8
              }}
            >
              <option value="Before">Before</option>
              <option value="During">During</option>
              <option value="After">After</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
          />

          {photoMessage && <p style={{ marginTop: 12 }}>{photoMessage}</p>}
        </div>

        {photos.length === 0 && <p>No photos uploaded yet.</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 12
              }}
            >
              <a
                href={photo.imageUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.label || 'Job photo'}
                  style={{
                    width: '100%',
                    height: 180,
                    objectFit: 'cover',
                    borderRadius: 8,
                    marginBottom: 10
                  }}
                />

                <p style={{ margin: '4px 0' }}>
                  <strong>Label:</strong> {photo.label || 'None'}
                </p>

                <p style={{ margin: '4px 0 12px 0' }}>Tap to open full size</p>
              </a>

              <button
                type="button"
                onClick={() => handleDeletePhoto(photo.id)}
                disabled={deletingPhotoId === photo.id}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #d33',
                  background: '#fff',
                  color: '#d33',
                  cursor: deletingPhotoId === photo.id ? 'not-allowed' : 'pointer',
                  opacity: deletingPhotoId === photo.id ? 0.6 : 1
                }}
              >
                {deletingPhotoId === photo.id ? 'Deleting...' : 'Delete Photo'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}