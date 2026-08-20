import type { ReactNode } from 'react'
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

        @media (max-width: 767px) {
          .trev-mobile-shell > main > div {
            padding-left: 10px !important;
            padding-right: 10px !important;
            padding-top: 10px !important;
            padding-bottom: 96px !important;
          }

          .trev-mobile-shell > main > div > section:first-child {
            border-radius: 20px !important;
          }

          .trev-mobile-shell > main > div > section:first-child a {
            min-height: 48px;
            flex: 1 1 46%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-align: center;
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
      <TrevMobileDock />
    </div>
  )
}
