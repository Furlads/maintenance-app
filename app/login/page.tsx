// app/login/page.tsx
export default function LoginPage() {
  // Auth is disabled during build phase.
  // This page intentionally does NOT redirect to avoid bounce loops.
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 6 }}>Login disabled (dev)</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        We’ve temporarily removed login while building pages.
      </p>
      <a href="/today" style={{ display: "inline-block", marginTop: 12 }}>
        Go to Today →
      </a>
    </main>
  );
}