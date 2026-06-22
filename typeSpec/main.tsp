import "@typespec/http";

using Http;

@service(#{ title: "Calendar Booking API" })
@server("http://localhost:3000", "Local development server")
namespace CalendarBooking;

alias AdminSessionAuth = ApiKeyAuth<ApiKeyLocation.cookie, "admin_session">;

/** A single preconfigured owner profile used by the admin area and public booking pages. */
@example(#{
  id: "owner-main",
  displayName: "Анна Смирнова",
  description: "Консультации по продуктовой стратегии и запуску MVP.",
  timezone: "Europe/Moscow",
})
model CalendarOwnerProfile {
  id: string;
  displayName: string;
  description?: string;
  timezone: string;
}

/** A booking type that guests can choose before selecting an available slot. */
@example(#{
  id: "product-consultation",
  title: "Продуктовая консультация",
  description: "Разбор идеи, целевой аудитории и следующих шагов.",
  durationMinutes: 30,
})
model EventType {
  id: string;

  @minLength(1)
  title: string;

  description: string;

  @minValue(1)
  durationMinutes: int32;
}

/** Request used by the owner to create an event type. The backend generates the stable id. */
@example(#{
  title: "Продуктовая консультация",
  description: "Разбор идеи, целевой аудитории и следующих шагов.",
  durationMinutes: 30,
})
model CreateEventTypeRequest {
  @minLength(1)
  title: string;

  description: string;

  @minValue(1)
  durationMinutes: int32;
}

/** Request used by the owner to update an existing event type. The id is stable and cannot be changed. */
@example(#{
  title: "Стратегическая сессия",
  description: "Подробная встреча для планирования roadmap.",
  durationMinutes: 60,
})
model UpdateEventTypeRequest {
  @minLength(1)
  title: string;

  description: string;

  @minValue(1)
  durationMinutes: int32;
}

/** A manually created owner availability interval for a concrete date and time range. */
@example(#{
  id: "window-2026-06-20-morning",
  startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
  endsAt: utcDateTime.fromISO("2026-06-20T09:00:00Z"),
})
model AvailabilityWindow {
  id: string;
  startsAt: utcDateTime;
  endsAt: utcDateTime;
}

/** Request used by the owner to create a manual availability interval. */
@example(#{
  startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
  endsAt: utcDateTime.fromISO("2026-06-20T09:00:00Z"),
})
model CreateAvailabilityWindowRequest {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
}

/** Request used by the owner to update a manual availability interval. */
@example(#{
  startsAt: utcDateTime.fromISO("2026-06-21T10:00:00Z"),
  endsAt: utcDateTime.fromISO("2026-06-21T13:00:00Z"),
})
model UpdateAvailabilityWindowRequest {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
}

/** A slot generated from an availability window for the selected event type duration. */
@example(#{
  startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
  endsAt: utcDateTime.fromISO("2026-06-20T06:30:00Z"),
  eventTypeId: "product-consultation",
})
model AvailableSlot {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
  eventTypeId: string;
}

enum BookingStatus {
  confirmed,
}

/** A confirmed guest booking. New bookings are created as confirmed in v1. */
@example(#{
  id: "booking-2026-06-20-0900",
  eventTypeId: "product-consultation",
  eventTypeTitle: "Продуктовая консультация",
  startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
  endsAt: utcDateTime.fromISO("2026-06-20T06:30:00Z"),
  guestName: "Дмитрий Иванов",
  guestEmail: "dmitry@example.com",
  guestComment: "Хочу обсудить MVP сервиса бронирования.",
  status: BookingStatus.confirmed,
  createdAt: utcDateTime.fromISO("2026-06-18T10:00:00Z"),
})
model Booking {
  id: string;
  eventTypeId: string;
  eventTypeTitle: string;
  startsAt: utcDateTime;
  endsAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  guestComment?: string;
  status: BookingStatus;
  createdAt: utcDateTime;
}

/** Request used by a guest to book one generated free slot. */
@example(#{
  eventTypeId: "product-consultation",
  startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
  guestName: "Дмитрий Иванов",
  guestEmail: "dmitry@example.com",
  guestComment: "Хочу обсудить MVP сервиса бронирования.",
})
model CreateBookingRequest {
  eventTypeId: string;
  startsAt: utcDateTime;

  @minLength(1)
  guestName: string;

  @format("email")
  guestEmail: string;

  guestComment?: string;
}

/** Request used by the predefined calendar owner to sign in to the admin area. */
@example(#{
  password: "admin-password",
})
model AdminLoginRequest {
  @minLength(1)
  password: string;
}

/** Response returned after the predefined calendar owner signs in. */
@example(#{
  authenticated: true,
})
model AdminSession {
  authenticated: true;
}

/** Standard API error response. */
@error
@example(#{
  code: "validation-error",
  message: "Проверьте заполненные поля.",
})
model ApiError {
  code:
    | "unauthorized"
    | "event-type-not-found"
    | "event-type-has-upcoming-bookings"
    | "availability-window-not-found"
    | "availability-window-has-upcoming-bookings"
    | "slot-outside-booking-window"
    | "slot-not-available"
    | "booking-conflict"
    | "validation-error";
  message: string;
}

@example(#{
  items: #[
    #{
      id: "product-consultation",
      title: "Продуктовая консультация",
      description: "Разбор идеи, целевой аудитории и следующих шагов.",
      durationMinutes: 30,
    },
    #{
      id: "strategy-session",
      title: "Стратегическая сессия",
      description: "Подробная встреча для планирования roadmap.",
      durationMinutes: 60,
    },
  ],
})
model EventTypeList {
  items: EventType[];
}

@example(#{
  items: #[
    #{
      id: "window-2026-06-20-morning",
      startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
      endsAt: utcDateTime.fromISO("2026-06-20T09:00:00Z"),
    },
    #{
      id: "window-2026-06-21-afternoon",
      startsAt: utcDateTime.fromISO("2026-06-21T10:00:00Z"),
      endsAt: utcDateTime.fromISO("2026-06-21T13:00:00Z"),
    },
  ],
})
model AvailabilityWindowList {
  items: AvailabilityWindow[];
}

@example(#{
  items: #[
    #{
      startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
      endsAt: utcDateTime.fromISO("2026-06-20T06:30:00Z"),
      eventTypeId: "product-consultation",
    },
    #{
      startsAt: utcDateTime.fromISO("2026-06-20T06:30:00Z"),
      endsAt: utcDateTime.fromISO("2026-06-20T07:00:00Z"),
      eventTypeId: "product-consultation",
    },
  ],
})
model AvailableSlotList {
  items: AvailableSlot[];
}

@example(#{
  items: #[
    #{
      id: "booking-2026-06-20-0900",
      eventTypeId: "product-consultation",
      eventTypeTitle: "Продуктовая консультация",
      startsAt: utcDateTime.fromISO("2026-06-20T06:00:00Z"),
      endsAt: utcDateTime.fromISO("2026-06-20T06:30:00Z"),
      guestName: "Дмитрий Иванов",
      guestEmail: "dmitry@example.com",
      guestComment: "Хочу обсудить MVP сервиса бронирования.",
      status: BookingStatus.confirmed,
      createdAt: utcDateTime.fromISO("2026-06-18T10:00:00Z"),
    },
  ],
})
model BookingList {
  items: Booking[];
}

@route("/public")
@tag("Public")
interface PublicApi {
  /** Get the single predefined calendar owner profile. */
  @get
  @route("/owner")
  getOwnerProfile(): CalendarOwnerProfile | ApiError;

  /** List event types visible to guests. */
  @get
  @route("/event-types")
  listEventTypes(): EventTypeList | ApiError;

  /**
   * List free slots for an event type within the next 14 days.
   * Slots are generated from manual availability windows using a step equal to the selected event type duration.
   */
  @get
  @route("/event-types/{eventTypeId}/slots")
  listAvailableSlots(@path eventTypeId: string): AvailableSlotList | ApiError;

  /**
   * Create a confirmed booking for a free generated slot.
   * The server calculates endsAt from the selected event type duration and rejects any interval overlap
   * with existing confirmed bookings, even when they belong to different event types.
   */
  @post
  @route("/bookings")
  createBooking(@body request: CreateBookingRequest): Booking | ApiError;
}

@route("/admin")
@tag("Admin Auth")
interface AdminAuthApi {
  /** Sign in the single predefined calendar owner using the configured admin password. */
  @post
  @route("/login")
  login(@body request: AdminLoginRequest): AdminSession | ApiError;

  /** Sign out the calendar owner by clearing the admin session cookie. */
  @post
  @route("/logout")
  logout(): void | ApiError;
}

@useAuth(AdminSessionAuth)
@route("/admin")
@tag("Admin")
interface AdminApi {
  /** Get the single predefined owner profile used by the admin area. */
  @get
  @route("/owner")
  getOwnerProfile(): CalendarOwnerProfile | ApiError;

  /** List all event types managed by the owner. */
  @get
  @route("/event-types")
  listEventTypes(): EventTypeList | ApiError;

  /** Create an event type. The backend generates the stable id from the title and guarantees uniqueness. */
  @post
  @route("/event-types")
  createEventType(@body request: CreateEventTypeRequest): EventType | ApiError;

  /** Update an existing event type. The id is stable and cannot be changed. */
  @put
  @route("/event-types/{eventTypeId}")
  updateEventType(
    @path eventTypeId: string,
    @body request: UpdateEventTypeRequest
  ): EventType | ApiError;

  /** Delete an event type if it has no upcoming confirmed bookings. */
  @delete
  @route("/event-types/{eventTypeId}")
  deleteEventType(@path eventTypeId: string): void | ApiError;

  /** List manually created availability windows. */
  @get
  @route("/availability-windows")
  listAvailabilityWindows(): AvailabilityWindowList | ApiError;

  /** Create a manual availability interval for a concrete date and time range. */
  @post
  @route("/availability-windows")
  createAvailabilityWindow(
    @body request: CreateAvailabilityWindowRequest
  ): AvailabilityWindow | ApiError;

  /** Update an availability window if all upcoming confirmed bookings remain inside the new interval. */
  @put
  @route("/availability-windows/{availabilityWindowId}")
  updateAvailabilityWindow(
    @path availabilityWindowId: string,
    @body request: UpdateAvailabilityWindowRequest
  ): AvailabilityWindow | ApiError;

  /** Delete an availability window if it has no upcoming confirmed bookings inside it. */
  @delete
  @route("/availability-windows/{availabilityWindowId}")
  deleteAvailabilityWindow(
    @path availabilityWindowId: string
  ): void | ApiError;

  /** List upcoming confirmed bookings across all event types. */
  @get
  @route("/bookings/upcoming")
  listUpcomingBookings(): BookingList | ApiError;
}
