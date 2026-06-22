import type { ApiError } from './types.js'

export class ApiDomainError extends Error {
  readonly code: ApiError['code']
  readonly statusCode: number

  constructor(code: ApiError['code'], message: string, statusCode: number) {
    super(message)
    this.name = 'ApiDomainError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function unauthorized(message = 'Требуется вход в админку.') {
  return new ApiDomainError('unauthorized', message, 401)
}

export function notFound(
  code: 'event-type-not-found' | 'availability-window-not-found',
  message: string,
) {
  return new ApiDomainError(code, message, 404)
}

export function conflict(
  code:
    | 'event-type-has-upcoming-bookings'
    | 'availability-window-has-upcoming-bookings'
    | 'slot-not-available'
    | 'booking-conflict',
  message: string,
) {
  return new ApiDomainError(code, message, 409)
}

export function validation(message = 'Проверьте заполненные поля.') {
  return new ApiDomainError('validation-error', message, 422)
}

export function slotOutsideBookingWindow(
  message = 'Выбранный слот находится вне доступного окна бронирования.',
) {
  return new ApiDomainError('slot-outside-booking-window', message, 422)
}
