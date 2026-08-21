type WorkerAvatarProps = {
  name?: string | null
  size?: number
  className?: string
  title?: string
}

const JACOB_AVATAR = '/avatars/jacob-three-counties.webp'
const CODIE_AVATAR = '/branding/workers/codie-furlads-avatar.jpg'
const STEVE_AVATAR = '/branding/workers/steve-furlads-avatar.webp'
const OLI_AVATAR = '/branding/workers/oli-furlads-avatar.webp'
const KELLY_AVATAR = '/branding/workers/kelly-both-brands-avatar.webp'

function initials(name?: string | null) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function avatarFor(name?: string | null) {
  const normalised = String(name || '').trim().toLowerCase()
  if (normalised === 'jacob' || normalised.startsWith('jacob ')) return JACOB_AVATAR
  if (normalised === 'codie' || normalised.startsWith('codie ')) return CODIE_AVATAR
  if (
    normalised === 'steve' ||
    normalised.startsWith('steve ') ||
    normalised === 'stephen' ||
    normalised.startsWith('stephen ')
  ) {
    return STEVE_AVATAR
  }
  if (
    normalised === 'oli' ||
    normalised.startsWith('oli ') ||
    normalised === 'oliver' ||
    normalised.startsWith('oliver ')
  ) {
    return OLI_AVATAR
  }
  if (normalised === 'kelly' || normalised.startsWith('kelly ')) return KELLY_AVATAR
  return null
}

export default function WorkerAvatar({
  name,
  size = 44,
  className = '',
  title,
}: WorkerAvatarProps) {
  const avatar = avatarFor(name)
  const label = title || name || 'Worker'

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={`${label} avatar`}
        title={label}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          flex: `0 0 ${size}px`,
          borderRadius: '999px',
          objectFit: 'cover',
          display: 'block',
          border: '2px solid rgba(255,255,255,.75)',
        }}
      />
    )
  }

  return (
    <span
      aria-label={`${label} avatar`}
      title={label}
      className={className}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e5e7eb',
        color: '#374151',
        fontSize: Math.max(11, Math.round(size * 0.34)),
        fontWeight: 900,
        border: '1px solid #d1d5db',
      }}
    >
      {initials(name)}
    </span>
  )
}
