import { conflict, notFound, slotOutsideBookingWindow } from '../errors.js'
import type { AppStore } from '../store.js'
import {
  addMinutes,
  containsInterval,
  getMoscowBookingWindow,
  intervalsOverlap,
  parseIsoDateTime,
  toIso,
} from '../time.js'
import type { AvailableSlot, Booking } from '../types.js'

export interface BookingInput {
  eventTypeId: string
  startsAt: Date
  guestName: string
  guestEmail: string
  guestComment?: string
}

function isConfirmedOverlap(
  store: AppStore,
  startsAt: Date,
  endsAt: Date,
): boolean {
  return store.bookings.some((booking) => {
    const bookingStart = parseIsoDateTime(booking.startsAt)
    const bookingEnd = parseIsoDateTime(booking.endsAt)
    return Boolean(
      booking.status === 'confirmed' &&
        bookingStart &&
        bookingEnd &&
        intervalsOverlap(startsAt, endsAt, bookingStart, bookingEnd),
    )
  })
}

function isInsideBookingWindow(
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): boolean {
  const window = getMoscowBookingWindow(now)
  return containsInterval(window.startsAt, window.endsAt, startsAt, endsAt)
}

export function listAvailableSlots(
  store: AppStore,
  eventTypeId: string,
  now = new Date(),
): AvailableSlot[] {
  const eventType = store.eventTypes.find((item) => item.id === eventTypeId)
  if (!eventType) {
    throw notFound('event-type-not-found', 'Тип встречи не найден.')
  }

  const bookingWindow = getMoscowBookingWindow(now)
  const slots: AvailableSlot[] = []

  for (const window of store.availabilityWindows) {
    const windowStart = parseIsoDateTime(window.startsAt)
    const windowEnd = parseIsoDateTime(window.endsAt)
    if (!windowStart || !windowEnd) {
      continue
    }

    let slotStart = windowStart
    while (slotStart < windowEnd) {
      const slotEnd = addMinutes(slotStart, eventType.durationMinutes)
      if (slotEnd > windowEnd) {
        break
      }

      if (
        slotEnd > now &&
        containsInterval(bookingWindow.startsAt, bookingWindow.endsAt, slotStart, slotEnd) &&
        !isConfirmedOverlap(store, slotStart, slotEnd)
      ) {
        slots.push({
          startsAt: toIso(slotStart),
          endsAt: toIso(slotEnd),
          eventTypeId,
        })
      }

      slotStart = slotEnd
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function createBooking(
  store: AppStore,
  input: BookingInput,
  now = new Date(),
): Booking {
  const eventType = store.eventTypes.find((item) => item.id === input.eventTypeId)
  if (!eventType) {
    throw notFound('event-type-not-found', 'Тип встречи не найден.')
  }

  const endsAt = addMinutes(input.startsAt, eventType.durationMinutes)
  if (!isInsideBookingWindow(input.startsAt, endsAt, now)) {
    throw slotOutsideBookingWindow()
  }

  const availableSlots = listAvailableSlots(store, input.eventTypeId, now)
  const matchesGeneratedSlot = availableSlots.some(
    (slot) => slot.startsAt === toIso(input.startsAt),
  )
  if (!matchesGeneratedSlot) {
    throw conflict('slot-not-available', 'Выбранный слот больше недоступен.')
  }

  if (isConfirmedOverlap(store, input.startsAt, endsAt)) {
    throw conflict('booking-conflict', 'Выбранное время уже занято.')
  }

  const booking: Booking = {
    id: `booking-${store.counters.booking++}`,
    eventTypeId: eventType.id,
    eventTypeTitle: eventType.title,
    startsAt: toIso(input.startsAt),
    endsAt: toIso(endsAt),
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    ...(input.guestComment ? { guestComment: input.guestComment } : {}),
    status: 'confirmed',
    createdAt: toIso(now),
  }

  store.bookings.push(booking)
  return booking
}

export function listUpcomingBookings(
  store: AppStore,
  now = new Date(),
): Booking[] {
  return store.bookings
    .filter((booking) => {
      const startsAt = parseIsoDateTime(booking.startsAt)
      return booking.status === 'confirmed' && Boolean(startsAt && startsAt >= now)
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}
