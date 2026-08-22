import type { ReactNode } from 'react'
import TrevLegacyPauseCleaner from './TrevLegacyPauseCleaner'
import TrevMobileDock from './TrevMobileDock'
import TrevDashboardAvatarEnhancer from './TrevDashboardAvatarEnhancer'

type Props = {
  children: ReactNode
}

export default function TrevLayout({ children }: Props) {
  return (
    <div className="trev-mobile-shell">
      <style>{`
        .trev-mobile-shell {
          background: linear-gradient(180deg, #f4f5f6 0%, #eef1f4 100%);
          min-height: 100vh;
        }

        .trev-mobile-shell a,
        .trev-mobile-shell button {
          -webkit-tap-highlight-color: transparent;
        }

        .trev-mobile-shell > main {
          background: transparent !important;
        }

        .trev-mobile-shell > main > div > section:first-child {
          background: linear-gradient(135deg, #111111 0%, #2a2a2a 100%) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 20px 50px rgba(0,0,0,0.16) !important;
        }

        .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.10) !important;
          box-shadow: none !important;
        }

        .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(5) {
          display: none !important;
        }

        .trev-mobile-shell > main > div > div.mt-6.grid section {
          border-radius: 18px !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.06) !important;
        }

        @media (max-width: 767px) {
          .trev-mobile-shell > main > div {
            max-width: 920px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-top: 12px !important;
            padding-bottom: 108px !important;
          }

          .trev-mobile-shell > main > div > section:first-child {
            border-radius: 20px !important;
            padding: 14px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child {
            gap: 10px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > div:first-child {
            margin-bottom: 0 !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
            letter-spacing: 0.18em !important;
            color: rgba(255,255,255,0.68) !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > p {
            display: block !important;
            margin-top: 8px !important;
            max-width: none !important;
            font-size: 13px !important;
            line-height: 1.45 !important;
            color: rgba(255,255,255,0.72) !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > h1 {
            margin-top: 6px !important;
            font-size: 30px !important;
            line-height: 1 !important;
            font-weight: 900 !important;
            letter-spacing: -0.03em !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > div:last-child {
            margin-top: 10px !important;
            padding: 7px 10px !important;
            border-radius: 999px !important;
            background: rgba(255,255,255,0.08) !important;
            border: 1px solid rgba(255,255,255,0.10) !important;
            font-size: 11px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:last-child {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:last-child > a {
            display: flex !important;
            min-height: 46px !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 14px !important;
            padding: 10px 12px !important;
            text-align: center !important;
            font-size: 12px !important;
            font-weight: 800 !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:last-child > a:nth-child(3) {
            background: #facc15 !important;
            color: #18181b !important;
            border-color: #facc15 !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid {
            margin-top: 14px !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div {
            min-height: 96px !important;
            padding: 10px !important;
            border-radius: 16px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div > div:first-child {
            font-size: 10px !important;
            line-height: 1.2 !important;
            letter-spacing: 0.08em !important;
            color: rgba(255,255,255,0.70) !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div > div:nth-child(2) {
            margin-top: 4px !important;
            font-size: 24px !important;
            line-height: 1 !important;
            font-weight: 900 !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div > div:last-child {
            margin-top: 6px !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            color: rgba(255,255,255,0.72) !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(2) {
            order: 1;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(3) {
            order: 2;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(1) {
            order: 3;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(4) {
            order: 4;
          }

          .trev-mobile-shell main section a,
          .trev-mobile-shell main section button {
            min-height: 44px;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 14px !important;
            margin-top: 14px !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:first-child {
            display: contents !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:first-child > section:first-child {
            order: 1;
            border-color: #f6d85a !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:first-child > section:nth-child(2) {
            order: 2;
            border-color: #dbeafe !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child {
            display: contents !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child > section:first-child {
            order: 3;
            border-color: #f6d85a !important;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.07) !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child > section:nth-child(2) {
            order: 4;
            border-color: #dbeafe !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child > section:nth-child(3) {
            order: 5;
            opacity: 0.96;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid section > div:first-child {
            padding: 16px !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid section > div:first-child h2 {
            font-size: 20px !important;
            line-height: 1.1 !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid section > div:first-child p {
            margin-top: 6px !important;
            font-size: 13px !important;
            line-height: 1.45 !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid section > div.space-y-3 {
            padding: 12px !important;
            gap: 10px !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid section > div.space-y-3 > div {
            border-radius: 16px !important;
            padding: 12px !important;
          }
        }
      `}</style>
      {children}
      <TrevDashboardAvatarEnhancer />
      <TrevLegacyPauseCleaner />
      <TrevMobileDock />
    </div>
  )
}
