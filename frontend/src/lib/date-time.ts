import type { AvailableSlot } from '@/api/types'

export interface SlotGroup {
  dayKey: string
  dayLabel: string
  slots: AvailableSlot[]
}

export function normalizeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone: timezone }).format(new Date())
    return timezone
  } catch {
    return 'UTC'
  }
}

export function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: normalizeTimezone(timezone),
  }).format(new Date(value))
}

export function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: normalizeTimezone(timezone),
  }).format(new Date(value))
}

export function formatDay(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: normalizeTimezone(timezone),
  }).format(new Date(value))
}

export function getDayKey(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: normalizeTimezone(timezone),
  }).formatToParts(new Date(value))

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  const day = parts.find((part) => part.type === 'day')?.value ?? '00'

  return `${year}-${month}-${day}`
}

export function groupSlotsByDay(
  slots: AvailableSlot[],
  timezone: string,
): SlotGroup[] {
  const groups = new Map<string, SlotGroup>()

  for (const slot of slots) {
    const dayKey = getDayKey(slot.startsAt, timezone)
    const existing = groups.get(dayKey)

    if (existing) {
      existing.slots.push(slot)
      continue
    }

    groups.set(dayKey, {
      dayKey,
      dayLabel: formatDay(slot.startsAt, timezone),
      slots: [slot],
    })
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    slots: [...group.slots].sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    ),
  }))
}

export function dateToLocalDayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function dayKeyToLocalDate(dayKey: string): Date | undefined {
  const [year, month, day] = dayKey.split('-').map(Number)

  if (!year || !month || !day) {
    return undefined
  }

  return new Date(year, month - 1, day)
}

export function formatLocalDay(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(value)
}

export function getDatePartFromDateTimeLocal(value: string): string {
  return value.slice(0, 10)
}

export function getTimePartFromDateTimeLocal(value: string): string {
  return value.slice(11, 16)
}

export function mergeDateAndTimeParts(datePart: string, timePart: string): string {
  if (!datePart || !timePart) {
    return ''
  }

  return `${datePart}T${timePart}`
}

export function toDateTimeLocalValue(value: string): string {
  const date = new Date(value)
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function localDateTimeToUtcIso(value: string): string {
  return new Date(value).toISOString()
}
