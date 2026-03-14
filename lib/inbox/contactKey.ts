export function normalisePhone(phone: string | null | undefined) {
  if (!phone) return null

  const cleaned = phone.replace(/\D/g, "")

  if (!cleaned) return null

  if (cleaned.startsWith("44")) return cleaned
  if (cleaned.startsWith("0")) return `44${cleaned.slice(1)}`

  return cleaned
}

export function normaliseEmail(email: string | null | undefined) {
  if (!email) return null

  const cleaned = email.trim().toLowerCase()

  return cleaned || null
}

export function buildContactKey(input: {
  senderPhone?: string | null
  senderEmail?: string | null
  contactRef?: string | null
  conversationId?: string | null
}) {
  const phone = normalisePhone(input.senderPhone)
  if (phone) return `phone:${phone}`

  const email = normaliseEmail(input.senderEmail)
  if (email) return `email:${email}`

  const contactRef = input.contactRef?.trim()
  if (contactRef) return `ref:${contactRef}`

  const conversationId = input.conversationId?.trim()
  if (conversationId) return `conversation:${conversationId}`

  return null
}