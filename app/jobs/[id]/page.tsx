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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (viewerIndex === null) return

      if (event.key === 'Escape') {
        setViewerIndex(null)
      }

      if (event.key === 'ArrowLeft') {
        setViewerIndex((current) => {
          if (current === null) return current
          return current > 0 ? current - 1 : current
        })
      }

      if (event.key === 'ArrowRight') {
        setViewerIndex((current) => {
          if (current === null) return current
          return current < photos.length - 1 ? current + 1 : current
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewerIndex, photos.length])

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

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to upload photo')
      }

      if (data && typeof data === 'object' && typeof data.id === 'number') {
        setPhotos((current) => [data as JobPhoto, ...current])
      } else {
        await loadPhotos()
      }

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

      setPhotos((current) => current.filter((photo) => photo.id !== photoId))
      setPhotoMessage('Photo deleted successfully.')
      setViewerIndex((current) => {
        if (current === null) return current

        const deletedIndex = photos.findIndex((photo) => photo.id === photoId)

        if (deletedIndex === -1) return current
        if (current === deletedIndex) return null
        if (current > deletedIndex) return current - 1

        return current
      })
    } catch (error) {
      console.error(error)
      setPhotoMessage('Failed to delete photo.')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  function openViewer(index: number) {
    setViewerIndex(index)
  }

  function closeViewer() {
    setViewerIndex(null)
  }

  function showPreviousPhoto() {
    setViewerIndex((current) => {
      if (current === null) return current
      return current > 0 ? current - 1 : current
    })
  }

  function showNextPhoto() {
    setViewerIndex((current) => {
      if (current === null) return current
      return current < photos.length - 1 ? current + 1 : current
    })
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

  const activePhoto =
    viewerIndex !== null && photos[viewerIndex] ? photos[viewerIndex] : null

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
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 12
              }}
            >
              <button
                type="button"
                onClick={() => openViewer(index)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left'
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
              </button>

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

      {activePhoto && (
        <div
          onClick={closeViewer}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              closeViewer()
            }}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.35)',
              background: 'rgba(0,0,0,0.45)',
              color: '#fff',
              fontSize: 24,
              lineHeight: 1,
              cursor: 'pointer'
            }}
          >
            ×
          </button>

          {viewerIndex !== null && viewerIndex > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                showPreviousPhoto()
              }}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(0,0,0,0.45)',
                color: '#fff',
                fontSize: 24,
                lineHeight: 1,
                cursor: 'pointer'
              }}
            >
              ‹
            </button>
          )}

          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 1100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12
            }}
          >
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.label || 'Job photo'}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 10
              }}
            />

            <div
              style={{
                color: '#fff',
                textAlign: 'center'
              }}
            >
              <p style={{ margin: '0 0 6px 0' }}>
                <strong>{activePhoto.label || 'Job photo'}</strong>
              </p>
              <p style={{ margin: 0, opacity: 0.8 }}>
                Photo {viewerIndex !== null ? viewerIndex + 1 : 1} of {photos.length}
              </p>
            </div>
          </div>

          {viewerIndex !== null && viewerIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                showNextPhoto()
              }}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(0,0,0,0.45)',
                color: '#fff',
                fontSize: 24,
                lineHeight: 1,
                cursor: 'pointer'
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </main>
  )
}