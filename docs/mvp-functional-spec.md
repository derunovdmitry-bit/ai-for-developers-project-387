# Calendar Booking MVP Functional Specification

## Goal

Build a minimal calendar booking application with two user roles:

- calendar owner;
- guest.

The application has one predefined calendar owner profile. Guests can book available slots without registration. The calendar owner manages the calendar through a protected admin area.

## Roles and Access

### Calendar Owner

The calendar owner is a single predefined profile returned by the API. The profile contains:

- `id`;
- `displayName`;
- optional `description`;
- `timezone`.

The owner profile is displayed in the admin area and on the public booking page. The profile is not editable in the MVP.

The admin area is protected by password login:

- there is no registration;
- there are no multiple users or roles;
- the admin password is configured on the backend, for example through an environment variable;
- the owner signs in through `/admin/login`;
- the backend creates an `admin_session` HttpOnly cookie;
- protected `/admin/*` API endpoints require this session;
- `/admin/logout` clears the session cookie;
- the session is not remembered permanently and lasts until logout or browser close.

### Guest

A guest can use the public booking flow without creating an account and without signing in.

The guest provides only the booking form data required to create a booking:

- name;
- email;
- optional comment.

## Public Guest Flow

The public page starts with the calendar owner profile:

- owner display name;
- optional description;
- owner timezone.

Below the owner profile, the guest sees all created event types. Every event type is public and visible to guests. Each event type shows:

- title;
- description;
- duration in minutes.

After selecting an event type, the guest opens a booking calendar for the next 14 days starting from the current date. The frontend fetches all available slots for the selected event type in one request and groups them by day on the client.

The guest selects one free slot and submits the booking form:

- selected event type;
- selected slot start time;
- guest name;
- guest email;
- optional guest comment.

After a successful booking, the guest sees a confirmation screen. There is no separate public booking details page in the MVP.

If the selected slot becomes unavailable before submission, the frontend shows an error, clears the selected slot, and reloads the available slots for the selected event type.

## Admin Owner Flow

### Login and Logout

The owner opens the admin login page, enters the configured admin password, and receives an authenticated admin session. The admin UI should treat unauthenticated responses from protected admin endpoints as a signal to return to the login page.

The owner can log out, which clears the admin session.

### Owner Profile

The admin area displays the predefined owner profile:

- display name;
- optional description;
- timezone.

The profile is read-only in the MVP.

### Event Types

The owner can list, create, edit, and delete event types.

When creating an event type, the owner enters:

- title;
- description;
- duration in minutes.

The owner does not enter the event type `id`. The backend generates a stable unique `id` and returns it as part of the created event type.

When editing an event type, the owner can change:

- title;
- description;
- duration in minutes.

The event type `id` is stable and cannot be changed.

An event type can be deleted only if it has no upcoming confirmed bookings. If upcoming confirmed bookings exist, the backend rejects deletion and the frontend shows the error.

### Availability Windows

The owner can list, create, edit, and delete availability windows.

Availability windows are one-time concrete date and time intervals. The MVP does not use recurring weekly schedules. Each availability window contains:

- `startsAt`;
- `endsAt`.

The frontend validates that `endsAt` is later than `startsAt`.

An availability window can be edited only if all existing upcoming confirmed bookings inside that window remain inside the updated interval.

An availability window can be deleted only if it has no upcoming confirmed bookings inside it. If such bookings exist, the backend rejects deletion and the frontend shows the error.

### Upcoming Bookings

The owner can view upcoming confirmed bookings across all event types in one list.

Each booking entry shows:

- event type title;
- start time;
- end time;
- guest name;
- guest email;
- optional guest comment;
- status;
- creation time.

The upcoming bookings page is read-only in the MVP. The owner cannot cancel, move, edit, or delete bookings from this page.

The frontend may sort and group bookings by date and may provide client-side filtering by event type. The API returns one combined upcoming bookings list.

## Slot and Booking Rules

Available slots are generated for the selected event type within the next 14 days starting from the current date.

Slots are generated from manually created availability windows. The slot step is equal to the selected event type duration:

- a 30-minute event type produces slots at 30-minute intervals;
- a 60-minute event type produces slots at 60-minute intervals.

Only full slots that fit completely inside an availability window are available. If the end of an availability window has a partial leftover interval shorter than the event duration, that leftover interval is ignored.

There are no buffers between bookings. Two bookings may be adjacent if their intervals do not overlap.

The server calculates the booking `endsAt` from the selected event type duration. The client sends only `eventTypeId` and `startsAt` when creating a booking.

At booking time, the server uses the current event type duration. If the event type duration changed after the guest loaded slots and the selected slot is no longer valid, the server rejects the booking and the frontend refreshes the slots.

The busy-time rule applies globally across event types: two confirmed bookings cannot overlap, even if they belong to different event types.

All new bookings are created with status `confirmed`.

## Timezone Rules

The API exchanges date-time values as `utcDateTime`.

The frontend displays all booking, slot, and availability times in the calendar owner's timezone from `CalendarOwnerProfile.timezone`. The UI should make the timezone visible near date and time controls.

## Validation and Errors

The frontend performs basic validation before sending forms:

- event type title is required;
- event type duration must be at least 1 minute;
- availability window `endsAt` must be later than `startsAt`;
- guest name is required;
- guest email must look like an email address;
- guest comment is optional.

The backend remains the source of truth for all business rules.

The frontend should show API errors near the relevant form or action. Important API error cases include:

- unauthorized admin access;
- event type not found;
- event type cannot be deleted because it has upcoming bookings;
- availability window not found;
- availability window cannot be changed or deleted because it has upcoming bookings;
- selected slot is outside the booking window;
- selected slot is no longer available;
- booking conflict;
- validation error.

## TypeSpec Endpoint Mapping

Public API:

- `GET /public/owner` returns the predefined owner profile for the public page.
- `GET /public/event-types` returns public event types visible to guests.
- `GET /public/event-types/{eventTypeId}/slots` returns available slots for the selected event type within the next 14 days.
- `POST /public/bookings` creates a confirmed guest booking.

Admin auth API:

- `POST /admin/login` authenticates the predefined owner with the configured password and creates the admin session.
- `POST /admin/logout` clears the admin session.

Protected admin API:

- `GET /admin/owner` returns the predefined owner profile for the admin area.
- `GET /admin/event-types` lists managed event types.
- `POST /admin/event-types` creates an event type and returns the generated stable `id`.
- `PUT /admin/event-types/{eventTypeId}` updates an existing event type without changing its `id`.
- `DELETE /admin/event-types/{eventTypeId}` deletes an event type if it has no upcoming confirmed bookings.
- `GET /admin/availability-windows` lists manually created availability windows.
- `POST /admin/availability-windows` creates a concrete availability window.
- `PUT /admin/availability-windows/{availabilityWindowId}` updates an availability window if existing upcoming bookings remain valid.
- `DELETE /admin/availability-windows/{availabilityWindowId}` deletes an availability window if it has no upcoming confirmed bookings.
- `GET /admin/bookings/upcoming` returns upcoming confirmed bookings across all event types.
