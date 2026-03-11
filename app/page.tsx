'use client'

import { useEffect, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
}

export default function Page() {
  const [workers, setWorkers] = useState<Worker[]>([])

  useEffect(() => {
    fetch('/api/workers')
      .then(res => res.json())
      .then(data => setWorkers(data))
  }, [])

  function selectWorker(worker: Worker) {
    localStorage.setItem('workerId', worker.id.toString())
    localStorage.setItem('workerName', worker.firstName + ' ' + worker.lastName)
    window.location.href = '/today'
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>
        Select Worker
      </h1>

      {workers.map(worker => (
        <button
          key={worker.id}
          onClick={() => selectWorker(worker)}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 400,
            padding: 16,
            marginBottom: 12,
            fontSize: 18,
            borderRadius: 10,
            border: '1px solid #ccc',
            background: '#000',
            color: '#fff'
          }}
        >
          {worker.firstName} {worker.lastName}
        </button>
      ))}
    </main>
  )
}