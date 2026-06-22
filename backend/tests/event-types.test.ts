import { describe, expect, it } from 'vitest'

import {
  addMinutesToIso,
  createTestApp,
  futureIsoMinutesFromNow,
  loginAsAdmin,
} from './helpers.js'

describe('event types', () => {
  it('starts with an empty public and admin list', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    expect((await app.inject('/public/event-types')).json()).toEqual({
      items: [],
    })
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/event-types',
          headers: { cookie },
        })
      ).json(),
    ).toEqual({ items: [] })
  })

  it('creates, updates, and deletes an event type', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    const created = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: {
        title: 'Стратегическая сессия',
        description: 'Roadmap',
        durationMinutes: 60,
      },
    })
    expect(created.statusCode).toBe(200)
    expect(created.json()).toMatchObject({
      id: 'event-type-1',
      title: 'Стратегическая сессия',
      description: 'Roadmap',
      durationMinutes: 60,
    })

    const id = created.json().id as string
    const updated = await app.inject({
      method: 'PUT',
      url: `/admin/event-types/${id}`,
      headers: { cookie },
      payload: {
        title: 'Product strategy',
        description: 'Updated',
        durationMinutes: 45,
      },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toEqual({
      id,
      title: 'Product strategy',
      description: 'Updated',
      durationMinutes: 45,
    })

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/admin/event-types/${id}`,
      headers: { cookie },
    })
    expect(deleted.statusCode).toBe(204)
  })

  it('rejects invalid event type input', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    const response = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: { title: '', description: '', durationMinutes: 0 },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().code).toBe('validation-error')
  })

  it('rejects duration changes and deletion when upcoming bookings exist', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)
    const slotStart = futureIsoMinutesFromNow(60)
    const slotEnd = addMinutesToIso(slotStart, 60)

    const created = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: {
        title: 'Consulting',
        description: 'Product consulting',
        durationMinutes: 30,
      },
    })
    const eventTypeId = created.json().id as string

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
        eventTypeId,
        startsAt: slotStart,
        guestName: 'Dmitry',
        guestEmail: 'dmitry@example.com',
      },
    })

    const durationUpdate = await app.inject({
      method: 'PUT',
      url: `/admin/event-types/${eventTypeId}`,
      headers: { cookie },
      payload: {
        title: 'Consulting renamed',
        description: 'Updated',
        durationMinutes: 45,
      },
    })
    expect(durationUpdate.statusCode).toBe(409)
    expect(durationUpdate.json().code).toBe(
      'event-type-has-upcoming-bookings',
    )

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/admin/event-types/${eventTypeId}`,
      headers: { cookie },
    })
    expect(deleteResponse.statusCode).toBe(409)
    expect(deleteResponse.json().code).toBe(
      'event-type-has-upcoming-bookings',
    )
  })
})
