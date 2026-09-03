const UK_POSTCODE_AT_END = /\b(GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i

export function normaliseUkPostcode(value: unknown) {
  const compact = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

  if (!compact) return ''
  if (compact === 'GIR0AA') return 'GIR 0AA'
  if (compact.length <= 3) return compact
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

export function splitCustomerAddress(addressValue: unknown, postcodeValue?: unknown) {
  let address = String(addressValue || '').trim()
  const addressMatch = address.match(UK_POSTCODE_AT_END)
  const explicitPostcode = normaliseUkPostcode(postcodeValue)
  const extractedPostcode = normaliseUkPostcode(addressMatch?.[1] || '')
  const postcode = explicitPostcode || extractedPostcode

  if (addressMatch) {
    address = address
      .slice(0, addressMatch.index)
      .replace(/[\s,]+$/g, '')
      .trim()
  }

  return {
    address,
    postcode,
  }
}
