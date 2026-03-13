type InboxSource =
  | 'whatsapp'
  | 'furlads-email'
  | 'threecounties-email'
  | 'facebook'
  | 'wix'
  | 'worker-quote'

type SourceBadgeProps = {
  source: InboxSource
  compact?: boolean
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5A8.5 8.5 0 0 1 8.5 19L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M9.5 9.5c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.4 1c.1.2.1.4 0 .6l-.4.7c.4.8 1 1.4 1.8 1.8l.7-.4c.2-.1.4-.1.6 0l1 .4c.5.2.5.4.5.6v.5c0 .2 0 .4-.5.6-.5.2-1 .3-1.5.2-2.5-.6-4.5-2.6-5.1-5.1-.1-.5 0-1 .2-1.5Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v12H4z" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6H16V4.8c-.3 0-.9-.1-1.8-.1-2.6 0-4.3 1.6-4.3 4.5V11H7.5v3h2.4v7h3.6Z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4.5h6" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  )
}

function getSourceConfig(source: InboxSource) {
  switch (source) {
    case 'whatsapp':
      return {
        label: 'WhatsApp',
        classes: 'bg-green-50 text-green-700 ring-green-200',
        Icon: WhatsAppIcon,
      }
    case 'furlads-email':
      return {
        label: 'Furlads Email',
        classes: 'bg-amber-50 text-amber-700 ring-amber-200',
        Icon: MailIcon,
      }
    case 'threecounties-email':
      return {
        label: 'Three Counties Email',
        classes: 'bg-blue-50 text-blue-700 ring-blue-200',
        Icon: MailIcon,
      }
    case 'facebook':
      return {
        label: 'Facebook',
        classes: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
        Icon: FacebookIcon,
      }
    case 'wix':
      return {
        label: 'Wix',
        classes: 'bg-purple-50 text-purple-700 ring-purple-200',
        Icon: GlobeIcon,
      }
    case 'worker-quote':
      return {
        label: 'Worker Quote',
        classes: 'bg-orange-50 text-orange-700 ring-orange-200',
        Icon: ClipboardIcon,
      }
  }
}

export default function SourceBadge({ source, compact = false }: SourceBadgeProps) {
  const config = getSourceConfig(source)
  const Icon = config.Icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset ${config.classes} ${
        compact ? 'px-2 py-1 text-[11px] font-semibold' : 'px-2.5 py-1 text-xs font-semibold'
      }`}
    >
      <Icon />
      {config.label}
    </span>
  )
}