import type {
  AdminLoginRequest,
  AdminSession,
  ApiError,
  AvailabilityWindow,
  AvailabilityWindowList,
  AvailableSlotList,
  Booking,
  BookingList,
  CalendarOwnerProfile,
  CreateAvailabilityWindowRequest,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  EventTypeList,
  UpdateAvailabilityWindowRequest,
  UpdateEventTypeRequest,
} from '@/api/types'

export class ApiRequestError extends Error {
  readonly code: ApiError['code']

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.code = error.code
  }
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  )
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const text = await response.text()
  if (text.length === 0) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Сервер вернул некорректный JSON.')
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new ApiRequestError(payload)
    }

    throw new Error(`Запрос к серверу завершился со статусом ${response.status}.`)
  }

  if (isApiError(payload)) {
    throw new ApiRequestError(payload)
  }

  return payload as T
}

function jsonBody(body: unknown): string {
  return JSON.stringify(body)
}

export const publicApi = {
  getOwnerProfile: () => request<CalendarOwnerProfile>('/public/owner'),
  listEventTypes: async () => {
    const response = await request<EventTypeList>('/public/event-types')
    return response.items
  },
  listAvailableSlots: async (eventTypeId: string) => {
    const response = await request<AvailableSlotList>(
      `/public/event-types/${encodeURIComponent(eventTypeId)}/slots`,
    )
    return response.items
  },
  createBooking: (body: CreateBookingRequest) =>
    request<Booking>('/public/bookings', {
      method: 'POST',
      body: jsonBody(body),
    }),
}

export const adminApi = {
  login: (body: AdminLoginRequest) =>
    request<AdminSession>('/admin/login', {
      method: 'POST',
      body: jsonBody(body),
    }),
  logout: () =>
    request<void>('/admin/logout', {
      method: 'POST',
    }),
  getOwnerProfile: () => request<CalendarOwnerProfile>('/admin/owner'),
  listEventTypes: async () => {
    const response = await request<EventTypeList>('/admin/event-types')
    return response.items
  },
  createEventType: (body: CreateEventTypeRequest) =>
    request<EventType>('/admin/event-types', {
      method: 'POST',
      body: jsonBody(body),
    }),
  updateEventType: (eventTypeId: string, body: UpdateEventTypeRequest) =>
    request<EventType>(`/admin/event-types/${encodeURIComponent(eventTypeId)}`, {
      method: 'PUT',
      body: jsonBody(body),
    }),
  deleteEventType: (eventTypeId: string) =>
    request<void>(`/admin/event-types/${encodeURIComponent(eventTypeId)}`, {
      method: 'DELETE',
    }),
  listAvailabilityWindows: async () => {
    const response = await request<AvailabilityWindowList>(
      '/admin/availability-windows',
    )
    return response.items
  },
  createAvailabilityWindow: (body: CreateAvailabilityWindowRequest) =>
    request<AvailabilityWindow>('/admin/availability-windows', {
      method: 'POST',
      body: jsonBody(body),
    }),
  updateAvailabilityWindow: (
    availabilityWindowId: string,
    body: UpdateAvailabilityWindowRequest,
  ) =>
    request<AvailabilityWindow>(
      `/admin/availability-windows/${encodeURIComponent(availabilityWindowId)}`,
      {
        method: 'PUT',
        body: jsonBody(body),
      },
    ),
  deleteAvailabilityWindow: (availabilityWindowId: string) =>
    request<void>(
      `/admin/availability-windows/${encodeURIComponent(availabilityWindowId)}`,
      {
        method: 'DELETE',
      },
    ),
  listUpcomingBookings: async () => {
    const response = await request<BookingList>('/admin/bookings/upcoming')
    return response.items
  },
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Непредвиденная ошибка.'
}
