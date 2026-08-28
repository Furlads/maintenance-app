export function titleCasePersonName(value: unknown) {
  if (typeof value !== 'string') return ''

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) =>
      part
        .split(/([-'’])/)
        .map((segment) => {
          if (!segment || segment === '-' || segment === "'" || segment === '’') return segment
          return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
        })
        .join('')
    )
    .join(' ')
}
