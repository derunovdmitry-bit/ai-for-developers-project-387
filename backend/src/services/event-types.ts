import { conflict, notFound } from '../errors.js'
import type { AppStore } from '../store.js'
import { parseIsoDateTime } from '../time.js'
import type { EventType } from '../types.js'

export interface EventTypeInput {
  title: string
  description: string
  durationMinutes: number
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generateEventTypeId(store: AppStore, title: string): string {
  const slug = slugify(title)
  const base = slug || `event-type-${store.counters.eventType++}`
  let id = base
  let suffix = 2

  while (store.eventTypes.some((eventType) => eventType.id === id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  return id
}

function hasUpcomingBookings(
  store: AppStore,
  eventTypeId: string,
  now = new Date(),
): boolean {
  return store.bookings.some((booking) => {
    const startsAt = parseIsoDateTime(booking.startsAt)
    return (
      booking.eventTypeId === eventTypeId &&
      booking.status === 'confirmed' &&
      Boolean(startsAt && startsAt >= now)
    )
  })
}

export function listEventTypes(store: AppStore): EventType[] {
  return [...store.eventTypes]
}

export function createEventType(
  store: AppStore,
  input: EventTypeInput,
): EventType {
  const eventType = {
    id: generateEventTypeId(store, input.title),
    ...input,
  }
  store.eventTypes.push(eventType)
  return eventType
}

export function updateEventType(
  store: AppStore,
  eventTypeId: string,
  input: EventTypeInput,
  now = new Date(),
): EventType {
  const index = store.eventTypes.findIndex(
    (eventType) => eventType.id === eventTypeId,
  )
  const current = store.eventTypes[index]
  if (!current) {
    throw notFound('event-type-not-found', 'Тип встречи не найден.')
  }

  if (
    current.durationMinutes !== input.durationMinutes &&
    hasUpcomingBookings(store, eventTypeId, now)
  ) {
    throw conflict(
      'event-type-has-upcoming-bookings',
      'Нельзя изменить длительность типа встречи с будущими бронированиями.',
    )
  }

  const updated = { ...current, ...input }
  store.eventTypes[index] = updated
  return updated
}

export function deleteEventType(
  store: AppStore,
  eventTypeId: string,
  now = new Date(),
): void {
  if (!store.eventTypes.some((eventType) => eventType.id === eventTypeId)) {
    throw notFound('event-type-not-found', 'Тип встречи не найден.')
  }
  if (hasUpcomingBookings(store, eventTypeId, now)) {
    throw conflict(
      'event-type-has-upcoming-bookings',
      'Нельзя удалить тип встречи с будущими бронированиями.',
    )
  }

  store.eventTypes = store.eventTypes.filter(
    (eventType) => eventType.id !== eventTypeId,
  )
}
