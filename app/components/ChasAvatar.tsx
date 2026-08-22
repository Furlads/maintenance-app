'use client'

import React from 'react'

type Props = {
  size?: number
  showBrandBadges?: boolean
  className?: string
  style?: React.CSSProperties
}

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
        src="/branding/chas-avatar.jpg"
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
