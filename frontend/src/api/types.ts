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

export interface CreateEventTypeRequest {
  title: string
  description: string
  durationMinutes: number
}

export type UpdateEventTypeRequest = CreateEventTypeRequest

export interface AvailabilityWindow {
  id: string
  startsAt: string
  endsAt: string
}

export interface CreateAvailabilityWindowRequest {
  startsAt: string
  endsAt: string
}

export type UpdateAvailabilityWindowRequest = CreateAvailabilityWindowRequest

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

export interface CreateBookingRequest {
  eventTypeId: string
  startsAt: string
  guestName: string
  guestEmail: string
  guestComment?: string
}

export interface AdminLoginRequest {
  password: string
}

export interface AdminSession {
  authenticated: true
}

export type ApiErrorCode =
  | 'unauthorized'
  | 'event-type-not-found'
  | 'event-type-has-upcoming-bookings'
  | 'availability-window-not-found'
  | 'availability-window-has-upcoming-bookings'
  | 'slot-outside-booking-window'
  | 'slot-not-available'
  | 'booking-conflict'
  | 'validation-error'

export interface ApiError {
  code: ApiErrorCode
  message: string
}

export interface EventTypeList {
  items: EventType[]
}

export interface AvailabilityWindowList {
  items: AvailabilityWindow[]
}

export interface AvailableSlotList {
  items: AvailableSlot[]
}

export interface BookingList {
  items: Booking[]
}
