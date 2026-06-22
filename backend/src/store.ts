import type {
  AvailabilityWindow,
  Booking,
  CalendarOwnerProfile,
  EventType,
} from './types.js'

export interface Counters {
  eventType: number
  availabilityWindow: number
  booking: number
}

export interface AppStore {
  owner: CalendarOwnerProfile
  eventTypes: EventType[]
  availabilityWindows: AvailabilityWindow[]
  bookings: Booking[]
  sessions: Set<string>
  counters: Counters
}

export function createStore(): AppStore {
  return {
    owner: {
      id: 'owner-main',
      displayName: 'Дмитрий Дерунов',
      timezone: 'Europe/Moscow',
    },
    eventTypes: [],
    availabilityWindows: [],
    bookings: [],
    sessions: new Set<string>(),
    counters: {
      eventType: 1,
      availabilityWindow: 1,
      booking: 1,
    },
  }
}
