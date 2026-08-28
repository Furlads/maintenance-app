export const LANDSCAPING_WORKDAY_MINUTES = 390

function parseDateOnly(value: string | Date) {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    )
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  )

  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function isWeekday(value: Date) {
  const day = value.getUTCDay()
  return day !== 0 && day !== 6
}

export function getLandscapingWorkingDates(
  startDate: string | Date,
  durationMinutes: number | null | undefined
) {
  const start = parseDateOnly(startDate)
  if (!start) return []

  const minutes =
    typeof durationMinutes === 'number' && durationMinutes > 0
      ? durationMinutes
      : LANDSCAPING_WORKDAY_MINUTES
  const daysNeeded = Math.max(
    1,
    Math.ceil(minutes / LANDSCAPING_WORKDAY_MINUTES)
  )
  const dates: string[] = []
  const cursor = new Date(start)

  while (dates.length < daysNeeded) {
    if (isWeekday(cursor)) dates.push(dateKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export function getLandscapingFinishDate(
  startDate: string | Date,
  durationMinutes: number | null | undefined
) {
  const dates = getLandscapingWorkingDates(startDate, durationMinutes)
  return dates.at(-1) || ''
}

export function countLandscapingWorkingDays(startDate: string, finishDate: string) {
  const start = parseDateOnly(startDate)
  const finish = parseDateOnly(finishDate)
  if (!start || !finish || finish < start) return 0

  let count = 0
  const cursor = new Date(start)

  while (cursor <= finish) {
    if (isWeekday(cursor)) count += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return count
}
