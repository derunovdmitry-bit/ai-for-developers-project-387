import { conflict, notFound, validation } from '../errors.js'
import type { AppStore } from '../store.js'
import {
  containsInterval,
  intervalsOverlap,
  parseIsoDateTime,
  toIso,
} from '../time.js'
import type { AvailabilityWindow, Booking } from '../types.js'

export interface AvailabilityInput {
  startsAt: Date
  endsAt: Date
}

function validateWindowInterval(input: AvailabilityInput, now = new Date()): void {
  if (input.endsAt <= input.startsAt) {
    throw validation('Время окончания должно быть позже начала.')
  }
  if (input.startsAt < now) {
    throw validation('Окно доступности не может начинаться в прошлом.')
  }
}

function assertNoOverlap(
  store: AppStore,
  input: AvailabilityInput,
  ignoredWindowId?: string,
): void {
  const hasOverlap = store.availabilityWindows.some((window) => {
    if (window.id === ignoredWindowId) {
      return false
    }
    const startsAt = parseIsoDateTime(window.startsAt)
    const endsAt = parseIsoDateTime(window.endsAt)
    return Boolean(
      startsAt &&
        endsAt &&
        intervalsOverlap(input.startsAt, input.endsAt, startsAt, endsAt),
    )
  })

  if (hasOverlap) {
    throw validation('Окна доступности не должны пересекаться.')
  }
}

function bookingsInsideWindow(
  store: AppStore,
  window: AvailabilityWindow,
  now = new Date(),
): Booking[] {
  const windowStart = parseIsoDateTime(window.startsAt)
  const windowEnd = parseIsoDateTime(window.endsAt)
  if (!windowStart || !windowEnd) {
    return []
  }

  return store.bookings.filter((booking) => {
    const startsAt = parseIsoDateTime(booking.startsAt)
    const endsAt = parseIsoDateTime(booking.endsAt)
    return Boolean(
      startsAt &&
        endsAt &&
        startsAt >= now &&
        booking.status === 'confirmed' &&
        containsInterval(windowStart, windowEnd, startsAt, endsAt),
    )
  })
}

export function listAvailabilityWindows(store: AppStore): AvailabilityWindow[] {
  return [...store.availabilityWindows].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  )
}

export function createAvailabilityWindow(
  store: AppStore,
  input: AvailabilityInput,
  now = new Date(),
): AvailabilityWindow {
  validateWindowInterval(input, now)
  assertNoOverlap(store, input)

  const window = {
    id: `window-${store.counters.availabilityWindow++}`,
    startsAt: toIso(input.startsAt),
    endsAt: toIso(input.endsAt),
  }
  store.availabilityWindows.push(window)
  return window
}

export function updateAvailabilityWindow(
  store: AppStore,
  windowId: string,
  input: AvailabilityInput,
  now = new Date(),
): AvailabilityWindow {
  const index = store.availabilityWindows.findIndex(
    (window) => window.id === windowId,
  )
  const current = store.availabilityWindows[index]
  if (!current) {
    throw notFound('availability-window-not-found', 'Окно доступности не найдено.')
  }

  validateWindowInterval(input, now)
  assertNoOverlap(store, input, windowId)

  const affectedBookings = bookingsInsideWindow(store, current, now)
  const allRemainInside = affectedBookings.every((booking) => {
    const startsAt = parseIsoDateTime(booking.startsAt)
    const endsAt = parseIsoDateTime(booking.endsAt)
    return Boolean(
      startsAt &&
        endsAt &&
        containsInterval(input.startsAt, input.endsAt, startsAt, endsAt),
    )
  })
  if (!allRemainInside) {
    throw conflict(
      'availability-window-has-upcoming-bookings',
      'Нельзя изменить окно доступности так, чтобы будущие бронирования оказались вне него.',
    )
  }

  const updated = {
    id: windowId,
    startsAt: toIso(input.startsAt),
    endsAt: toIso(input.endsAt),
  }
  store.availabilityWindows[index] = updated
  return updated
}

export function deleteAvailabilityWindow(
  store: AppStore,
  windowId: string,
  now = new Date(),
): void {
  const current = store.availabilityWindows.find((window) => window.id === windowId)
  if (!current) {
    throw notFound('availability-window-not-found', 'Окно доступности не найдено.')
  }
  if (bookingsInsideWindow(store, current, now).length > 0) {
    throw conflict(
      'availability-window-has-upcoming-bookings',
      'Нельзя удалить окно доступности с будущими бронированиями.',
    )
  }

  store.availabilityWindows = store.availabilityWindows.filter(
    (window) => window.id !== windowId,
  )
}
