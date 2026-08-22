'use client'

import React from 'react'

type Props = {
  size?: number
  showBrandBadges?: boolean
  className?: string
  style?: React.CSSProperties
}

const CHAS_AVATAR = 'data:image/jpeg;base64,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' 

export default function ChasAvatar({ size = 48, showBrandBadges = true, className, style }: Props) {
  const badgeSize = Math.max(14, Math.round(size * 0.28))

  return (
    <span
      className={className}
      aria-label="Chas AI assistant for Furlads and Three Counties"
      title="Chas — Furlads & Three Counties AI assistant"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        overflow: 'visible',
        display: 'inline-block',
        position: 'relative',
        background: '#111',
        boxShadow: '0 5px 16px rgba(0,0,0,.18)',
        ...style,
      }}
    >
      <img
        src={CHAS_AVATAR}
        alt="Chas"
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      />
      {showBrandBadges ? (
        <>
          <span
            title="Furlads"
            style={{
              position: 'absolute', right: -2, bottom: -2, width: badgeSize, height: badgeSize,
              borderRadius: '50%', background: '#facc15', color: '#111', border: '2px solid white',
              fontSize: Math.max(7, Math.round(badgeSize * .38)), fontWeight: 1000,
              display: 'grid', placeItems: 'center', lineHeight: 1,
            }}
          >F</span>
          <span
            title="Three Counties Property Care"
            style={{
              position: 'absolute', left: -2, bottom: -2, width: badgeSize, height: badgeSize,
              borderRadius: '50%', background: '#7faa38', color: 'white', border: '2px solid white',
              fontSize: Math.max(6, Math.round(badgeSize * .32)), fontWeight: 1000,
              display: 'grid', placeItems: 'center', lineHeight: 1,
            }}
          >3C</span>
        </>
      ) : null}
    </span>
  )
}
