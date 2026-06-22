export const OWNER_TIMEZONE = 'Europe/Moscow'
export const BOOKING_WINDOW_DAYS = 14
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000

export function parseIsoDateTime(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toIso(date: Date): string {
  return date.toISOString()
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function containsInterval(
  outerStart: Date,
  outerEnd: Date,
  innerStart: Date,
  innerEnd: Date,
): boolean {
  return outerStart <= innerStart && innerEnd <= outerEnd
}

export function getMoscowBookingWindow(now = new Date()): {
  startsAt: Date
  endsAt: Date
} {
  const moscowTime = new Date(now.getTime() + MOSCOW_OFFSET_MS)
  const startUtcMs =
    Date.UTC(
      moscowTime.getUTCFullYear(),
      moscowTime.getUTCMonth(),
      moscowTime.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - MOSCOW_OFFSET_MS

  return {
    startsAt: new Date(startUtcMs),
    endsAt: new Date(
      startUtcMs + (BOOKING_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000,
    ),
  }
}
