# Backend Design

## Context

The project is a calendar booking MVP with an existing Vite React frontend, TypeSpec API contract, and Prism mock API. The new backend must implement the API described by `typeSpec/main.tsp` for a separate frontend client. Backend business rules are the source of truth. Persistent database storage is out of scope for this step; data may reset after service restart.

## Goals

- Add a real API backend for `/public/*` and `/admin/*`.
- Keep frontend API paths relative.
- Implement booking business rules on the backend.
- Use in-memory storage only.
- Keep Prism mock API available separately for contract mocking.
- Cover backend behavior with focused tests.

## Non-Goals

- No database.
- No recurring availability.
- No multi-user or role system.
- No editable owner profile.
- No backend serving of the built frontend.
- No CORS support in this step; local development uses Vite proxy.

## Architecture

The backend will be a separate TypeScript package in `backend/` using Fastify. It will listen on `127.0.0.1:3000` and expose only API routes from the TypeSpec contract.

Suggested module layout:

- `src/server.ts`: creates the Fastify app and registers routes/plugins.
- `src/config.ts`: reads required runtime configuration.
- `src/store.ts`: owns in-memory state.
- `src/services/*`: owns auth, event type, availability, slot, and booking rules.
- `src/routes/*`: maps HTTP requests to services and converts domain errors to API responses.
- `tests/*`: tests the API through Fastify `inject()`.

Root scripts will include backend commands:

- `dev:backend`
- `build:backend`
- `lint:backend`
- `test:backend`

The frontend Vite proxy default will point `/public` and `/admin` to `http://127.0.0.1:3000`. Prism remains on `4010` through `npm run mock:api`.

## Runtime Configuration

`ADMIN_PASSWORD` is required. If it is not set, backend startup must fail with a clear error message. There is no development fallback password.

## Initial State

Backend state resets on restart.

Initial in-memory data:

- event types: empty list;
- availability windows: empty list;
- bookings: empty list;
- admin sessions: empty set.

The owner profile is fixed and read-only:

- `id`: `owner-main`;
- `displayName`: `Дмитрий Дерунов`;
- `timezone`: `Europe/Moscow`;
- `description`: omitted.

## Auth And Sessions

`POST /admin/login` accepts `{ password }`. Password comparison is exact; the backend must not trim the password before comparing it with `ADMIN_PASSWORD`.

On invalid or missing password, return `401`:

```json
{ "code": "unauthorized", "message": "Неверный пароль." }
```

On success:

- generate a cryptographically random session id;
- store it in an in-memory `Set`;
- set the `admin_session` cookie;
- cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Max-Age`;
- return `{ "authenticated": true }`.

Protected `/admin/*` endpoints require a known `admin_session` cookie. `POST /admin/login` and `POST /admin/logout` are not protected by the session guard.

`POST /admin/logout` removes the current session id when present, clears the cookie, and returns `204`. Logout is idempotent.

## Validation

The backend validates every request even when the frontend already performs UX validation.

Rules:

- required strings are trimmed and must not be empty, except password comparison;
- `durationMinutes` must be an integer greater than or equal to `1`;
- email uses a simple practical email check;
- date-time fields must parse as valid ISO date-time strings;
- availability `endsAt` must be later than `startsAt`;
- availability `startsAt` must not be in the past;
- overlapping availability windows are forbidden;
- adjacent availability windows are allowed;
- unknown JSON fields are ignored.

## Error Handling

All API errors use the TypeSpec error shape:

```json
{ "code": "validation-error", "message": "Проверьте заполненные поля." }
```

HTTP status mapping:

- `401`: `unauthorized`;
- `404`: `event-type-not-found`, `availability-window-not-found`;
- `409`: business conflicts, including upcoming booking restrictions, unavailable slots, and booking overlap conflicts;
- `422`: validation errors and slot outside the booking window;
- `204`: successful delete and logout responses.

## Event Types

The owner can list, create, update, and delete event types through protected admin endpoints.

Create:

- backend generates the id;
- id is a slug derived from title;
- if slug generation fails or the id already exists, use a fallback or numeric suffix;
- example fallback sequence: `event-type-1`, `event-type-2`.

Update:

- id never changes;
- title and description can change even with upcoming bookings;
- duration can change only when this event type has no upcoming confirmed bookings.

Delete:

- allowed only when this event type has no upcoming confirmed bookings.

Public event type list returns all event types.

## Availability Windows

The owner can list, create, update, and delete one-time availability windows through protected admin endpoints.

Create:

- validate `startsAt` and `endsAt`;
- reject `startsAt` in the past;
- reject overlap with any existing availability window;
- allow adjacent windows.

Update:

- validate the new interval as on create;
- reject overlap with any other availability window while ignoring the edited window itself;
- if upcoming confirmed bookings were inside the old window, all of those bookings must remain fully inside the new interval.

Delete:

- allowed only when there are no upcoming confirmed bookings inside the window.

Lists are sorted by `startsAt`.

## Slots And Bookings

Available slots are generated for a selected event type for the next 14 days in the owner timezone `Europe/Moscow`.

The booking window starts at the beginning of the current day in Moscow and ends at the beginning of the 15th day. Slots in the past relative to the current instant are not returned.

Slot generation:

- uses manual availability windows;
- step equals the event type `durationMinutes`;
- step starts from `availabilityWindow.startsAt`;
- only full slots inside the availability window are produced;
- occupied slots are excluded;
- global busy time applies across all event types.

Example: a `30` minute event type and a `10:10-11:10` availability window produce `10:10-10:40` and `10:40-11:10`; `10:20-10:50` is not a valid generated slot.

Booking creation:

- request sends `eventTypeId`, `startsAt`, and guest data;
- backend finds the current event type;
- backend calculates `endsAt` from current duration;
- backend verifies that the slot is inside the 14-day booking window;
- backend verifies that the slot exactly matches a generated free slot;
- backend rejects any overlap with existing confirmed bookings across all event types;
- booking is created with status `confirmed`;
- booking stores `eventTypeTitle` as a snapshot from creation time.

If event type duration changes after the guest loaded slots, the backend validates against the current duration and rejects stale slot submissions.

## Upcoming Bookings

`GET /admin/bookings/upcoming` returns confirmed bookings with `startsAt >= now`, sorted by `startsAt`.

The endpoint is read-only. The MVP does not support cancelling, moving, editing, or deleting bookings.

## Testing

Backend tests will use Fastify `inject()` where possible so tests do not need a real network port.

Coverage:

- startup/config error when `ADMIN_PASSWORD` is missing;
- auth: invalid password, valid login, protected access, logout;
- event types: CRUD, duration update restriction, delete restriction;
- availability windows: CRUD, past start rejection, overlap rejection, update/delete restrictions with bookings;
- slots: 14-day window, owner timezone, step from window start, past slot exclusion, occupied slot exclusion;
- bookings: success, unknown event type, outside booking window, unavailable slot, global overlap conflict.

## Verification

Before reporting implementation complete, run relevant checks:

```bash
npm run build:frontend
npm run lint:frontend
npm run openapi:generate
npm run build:backend
npm run lint:backend
npm run test:backend
```

If mock API behavior changes, also run Prism manually and verify at least one endpoint:

```bash
npm run mock:api
curl http://127.0.0.1:4010/public/owner
```

Do not leave Vite or Prism running in the background unless explicitly requested.
