type PageProps = {
  params: {
    id: string
  }
}

export default function AdminJobPage({ params }: PageProps) {
  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Job Details</h1>

      <p style={{ fontSize: 18, marginBottom: 20 }}>
        Job ID: <strong>{params.id}</strong>
      </p>

      <div
        style={{
          maxWidth: 600,
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 12
        }}
      >
        <p>This page is not built yet.</p>
      </div>
    </main>
  )
}