import { describe, expect, it } from 'vitest'

import {
  addMinutesToIso,
  createTestApp,
  futureIsoMinutesFromNow,
  loginAsAdmin,
} from './helpers.js'

async function createEventTypeAndWindow(durationMinutes = 30) {
  const app = await createTestApp()
  const cookie = await loginAsAdmin(app)
  const slotStart = futureIsoMinutesFromNow(60)
  const slotMiddle = addMinutesToIso(slotStart, durationMinutes)
  const slotEnd = addMinutesToIso(slotStart, durationMinutes * 2)
  const nonGeneratedStart = addMinutesToIso(slotStart, 10)

  const eventType = await app.inject({
    method: 'POST',
    url: '/admin/event-types',
    headers: { cookie },
    payload: {
      title: 'Consulting',
      description: 'Product consulting',
      durationMinutes,
    },
  })

  await app.inject({
    method: 'POST',
    url: '/admin/availability-windows',
    headers: { cookie },
    payload: {
      startsAt: slotStart,
      endsAt: slotEnd,
    },
  })

  return {
    app,
    cookie,
    eventTypeId: eventType.json().id as string,
    slotStart,
    slotMiddle,
    slotEnd,
    nonGeneratedStart,
  }
}

describe('slots and bookings', () => {
  it('generates slots from window start using event duration step', async () => {
    const { app, eventTypeId, slotEnd, slotMiddle, slotStart } =
      await createEventTypeAndWindow()

    const response = await app.inject(`/public/event-types/${eventTypeId}/slots`)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      items: [
        {
          eventTypeId,
          startsAt: slotStart,
          endsAt: slotMiddle,
        },
        {
          eventTypeId,
          startsAt: slotMiddle,
          endsAt: slotEnd,
        },
      ],
    })
  })

  it('creates a confirmed booking and removes the occupied slot', async () => {
    const { app, eventTypeId, slotEnd, slotMiddle, slotStart } =
      await createEventTypeAndWindow()

    const booking = await app.inject({
      method: 'POST',
      url: '/public/bookings',
      payload: {
        eventTypeId,
        startsAt: slotStart,
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
        guestComment: 'Discuss MVP',
      },
    })

    expect(booking.statusCode).toBe(200)
    expect(booking.json()).toMatchObject({
      id: 'booking-1',
      eventTypeId,
      eventTypeTitle: 'Consulting',
      startsAt: slotStart,
      endsAt: slotMiddle,
      guestName: 'Dmitry',
      guestEmail: 'dmitry@example.com',
      guestComment: 'Discuss MVP',
      status: 'confirmed',
    })

    const slots = await app.inject(`/public/event-types/${eventTypeId}/slots`)
    expect(slots.json().items).toEqual([
      {
        eventTypeId,
        startsAt: slotMiddle,
        endsAt: slotEnd,
      },
    ])
  })

  it('rejects a non-generated slot start', async () => {
    const { app, eventTypeId, nonGeneratedStart } =
      await createEventTypeAndWindow()

    const response = await app.inject({
      method: 'POST',
      url: '/public/bookings',
      payload: {
        eventTypeId,
        startsAt: nonGeneratedStart,
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('slot-not-available')
  })

  it('returns upcoming bookings for admin', async () => {
    const { app, cookie, eventTypeId, slotStart } =
      await createEventTypeAndWindow()

    await app.inject({
      method: 'POST',
      url: '/public/bookings',
      payload: {
        eventTypeId,
        startsAt: slotStart,
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/admin/bookings/upcoming',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().items).toHaveLength(1)
  })

  it('rejects a booking outside the 14-day booking window', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    const eventType = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: {
        title: 'Outside window test',
        description: 'Checks 14 day limit',
        durationMinutes: 30,
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/public/bookings',
      payload: {
        eventTypeId: eventType.json().id as string,
        startsAt: futureIsoMinutesFromNow(16 * 24 * 60),
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
      },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().code).toBe('slot-outside-booking-window')
  })

  it('prevents overlapping bookings across different event types', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)
    const slotStart = futureIsoMinutesFromNow(60)
    const slotEnd = addMinutesToIso(slotStart, 120)

    const longEvent = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: {
        title: 'Long consulting',
        description: 'Long',
        durationMinutes: 60,
      },
    })

    const shortEvent = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: {
        title: 'Short consulting',
        description: 'Short',
        durationMinutes: 30,
      },
    })

    await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: {
        startsAt: slotStart,
        endsAt: slotEnd,
      },
    })

    await app.inject({
      method: 'POST',
      url: '/public/bookings',
      payload: {
        eventTypeId: longEvent.json().id as string,
        startsAt: slotStart,
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
      },
    })

    const overlap = await app.inject({
      method: 'POST',
      url: '/public/bookings',
      payload: {
        eventTypeId: shortEvent.json().id as string,
        startsAt: slotStart,
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
      },
    })

    expect(overlap.statusCode).toBe(409)
    expect(overlap.json().code).toBe('slot-not-available')
  })
})
