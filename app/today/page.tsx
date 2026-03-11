'use client'

import { useEffect, useState } from 'react'

export default function TodayPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [workerName, setWorkerName] = useState<string | null>(null)

  useEffect(() => {
    const name = localStorage.getItem('workerName')
    setWorkerName(name)

    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(data))
  }, [])

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>
        Today
      </h1>

      {workerName && (
        <p style={{ marginBottom: 20 }}>
          Logged in as <strong>{workerName}</strong>
        </p>
      )}

      <div style={{ maxWidth: 600 }}>
        {jobs.length === 0 && <p>No jobs yet.</p>}

        {jobs.map(job => (
          <div
            key={job.id}
            style={{
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 10,
              marginBottom: 12
            }}
          >
            <strong>{job.title}</strong>
            <p>{job.address}</p>
            <small>Status: {job.status}</small>
          </div>
        ))}
      </div>
    </main>
  )
}