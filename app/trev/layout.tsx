import type { ReactNode } from 'react'
import TrevLegacyPauseCleaner from './TrevLegacyPauseCleaner'
import TrevMobileDock from './TrevMobileDock'

type Props = {
  children: ReactNode
}

export default function TrevLayout({ children }: Props) {
  return (
    <div className="trev-mobile-shell">
      <style>{`
        .trev-mobile-shell a,
        .trev-mobile-shell button {
          -webkit-tap-highlight-color: transparent;
        }

        .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(5) {
          display: none !important;
        }

        @media (max-width: 767px) {
          .trev-mobile-shell > main > div {
            padding-left: 10px !important;
            padding-right: 10px !important;
            padding-top: 10px !important;
            padding-bottom: 108px !important;
          }

          .trev-mobile-shell > main > div > section:first-child {
            border-radius: 20px !important;
            padding: 16px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child {
            gap: 10px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > p {
            display: none !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > h1 {
            margin-top: 6px !important;
            font-size: 2rem !important;
            line-height: 1.05 !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:first-child > div:last-child {
            margin-top: 10px !important;
            padding: 5px 10px !important;
            font-size: 11px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div:first-child > div:last-child {
            display: none !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid {
            margin-top: 14px !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div {
            min-height: 108px;
            padding: 12px !important;
            border-radius: 18px !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div > div:nth-child(2) {
            margin-top: 2px !important;
            font-size: 2rem !important;
            line-height: 1 !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div > div:last-child {
            margin-top: 5px !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(1) {
            order: 1;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(3) {
            order: 2;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(4) {
            order: 3;
          }

          .trev-mobile-shell > main > div > section:first-child > div.mt-5.grid > div:nth-child(2) {
            order: 4;
          }

          .trev-mobile-shell main section a,
          .trev-mobile-shell main section button {
            min-height: 44px;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:first-child {
            order: 2;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child {
            order: 1;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child > section:first-child {
            border-color: #fde68a !important;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.07) !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child > section:nth-child(2) {
            border-color: #dbeafe !important;
          }

          .trev-mobile-shell > main > div > div.mt-6.grid > div:last-child > section:nth-child(3) {
            opacity: 0.96;
          }
        }
      `}</style>
      {children}
      <TrevLegacyPauseCleaner />
      <TrevMobileDock />
    </div>
  )
}
