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
        }
      `}</style>
      {children}
      <TrevMobileDock />
    </div>
  )
}
