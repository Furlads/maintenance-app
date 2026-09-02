export default function Head() {
  return (
    <>
      <style>{`
        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] {
          background: linear-gradient(135deg, #09090b 0%, #18181b 55%, #27272a 100%) !important;
          color: #ffffff !important;
          border-color: #3f3f46 !important;
        }

        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] h1,
        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] h2,
        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] h3 {
          color: #ffffff !important;
        }

        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] .text-zinc-300 {
          color: #d4d4d8 !important;
        }

        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] a[href="/admin/schedule"] {
          background: #27272a !important;
          color: #ffffff !important;
          border-color: #71717a !important;
        }

        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] a[href="/admin/inbox"] {
          background: #ffffff !important;
          color: #18181b !important;
          border-color: #ffffff !important;
        }

        body.app-polished.app-admin-view .admin-main > div.space-y-4 > section:first-child[class*="from-zinc-950"][class*="to-zinc-800"] a[href="/kelly/time-off"] {
          background: #facc15 !important;
          color: #18181b !important;
          border-color: #eab308 !important;
        }
      `}</style>
    </>
  )
}
