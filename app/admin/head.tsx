export default function Head() {
  return (
    <>
      <style>{`
        section[class*="from-zinc-950"][class*="to-zinc-800"] {
          background: linear-gradient(135deg, #09090b 0%, #18181b 55%, #27272a 100%) !important;
          color: #ffffff !important;
          border-color: #3f3f46 !important;
        }

        section[class*="from-zinc-950"][class*="to-zinc-800"] h1,
        section[class*="from-zinc-950"][class*="to-zinc-800"] h2,
        section[class*="from-zinc-950"][class*="to-zinc-800"] h3 {
          color: #ffffff !important;
        }

        section[class*="from-zinc-950"][class*="to-zinc-800"] .text-zinc-300 {
          color: #d4d4d8 !important;
        }

        section[class*="from-zinc-950"][class*="to-zinc-800"] a[href="/admin/schedule"] {
          background: #27272a !important;
          color: #ffffff !important;
          border-color: #71717a !important;
        }

        section[class*="from-zinc-950"][class*="to-zinc-800"] a[href="/admin/inbox"] {
          background: #ffffff !important;
          color: #18181b !important;
        }

        section[class*="from-zinc-950"][class*="to-zinc-800"] a[href="/kelly/time-off"] {
          background: #facc15 !important;
          color: #18181b !important;
        }
      `}</style>
    </>
  )
}
