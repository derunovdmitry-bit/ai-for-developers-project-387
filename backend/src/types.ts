export interface CalendarOwnerProfile {
  id: string
  displayName: string
  description?: string
  timezone: string
}

export interface EventType {
  id: string
  title: string
  description: string
  durationMinutes: number
}

export interface AvailabilityWindow {
  id: string
  startsAt: string
  endsAt: string
}

export interface AvailableSlot {
  startsAt: string
  endsAt: string
  eventTypeId: string
}

export type BookingStatus = 'confirmed'

export interface Booking {
  id: string
  eventTypeId: string
  eventTypeTitle: string
  startsAt: string
  endsAt: string
  guestName: string
  guestEmail: string
  guestComment?: string
  status: BookingStatus
  createdAt: string
}

export interface ApiError {
  code:
    | 'unauthorized'
    | 'event-type-not-found'
    | 'event-type-has-upcoming-bookings'
    | 'availability-window-not-found'
    | 'availability-window-has-upcoming-bookings'
    | 'slot-outside-booking-window'
    | 'slot-not-available'
    | 'booking-conflict'
    | 'validation-error'
  message: string
}
