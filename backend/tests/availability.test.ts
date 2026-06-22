import { describe, expect, it } from 'vitest'

import {
  addMinutesToIso,
  createTestApp,
  futureIsoMinutesFromNow,
  loginAsAdmin,
} from './helpers.js'

describe('availability windows', () => {
  it('creates, lists, updates, and deletes an availability window', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)
    const futureStart = futureIsoMinutesFromNow(60)
    const futureEnd = futureIsoMinutesFromNow(120)
    const updatedStart = futureIsoMinutesFromNow(180)
    const updatedEnd = futureIsoMinutesFromNow(240)

    const created = await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: { startsAt: futureStart, endsAt: futureEnd },
    })
    expect(created.statusCode).toBe(200)
    expect(created.json()).toEqual({
      id: 'window-1',
      startsAt: futureStart,
      endsAt: futureEnd,
    })

    const list = await app.inject({
      method: 'GET',
      url: '/admin/availability-windows',
      headers: { cookie },
    })
    expect(list.json()).toEqual({ items: [created.json()] })

    const updated = await app.inject({
      method: 'PUT',
      url: '/admin/availability-windows/window-1',
      headers: { cookie },
      payload: {
        startsAt: updatedStart,
        endsAt: updatedEnd,
      },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toEqual({
      id: 'window-1',
      startsAt: updatedStart,
      endsAt: updatedEnd,
    })

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/admin/availability-windows/window-1',
      headers: { cookie },
    })
    expect(deleted.statusCode).toBe(204)
  })

  it('rejects windows in the past', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    const response = await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: {
        startsAt: '2020-01-01T00:00:00.000Z',
        endsAt: '2020-01-01T01:00:00.000Z',
      },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().code).toBe('validation-error')
  })

  it('rejects overlapping windows and allows adjacent windows', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)
    const futureStart = futureIsoMinutesFromNow(60)
    const futureEnd = futureIsoMinutesFromNow(120)
    const overlapStart = futureIsoMinutesFromNow(90)
    const adjacentEnd = futureIsoMinutesFromNow(180)

    await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: { startsAt: futureStart, endsAt: futureEnd },
    })

    const overlap = await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: {
        startsAt: overlapStart,
        endsAt: adjacentEnd,
      },
    })
    expect(overlap.statusCode).toBe(422)

    const adjacent = await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: {
        startsAt: futureEnd,
        endsAt: adjacentEnd,
      },
    })
    expect(adjacent.statusCode).toBe(200)
  })

  it('rejects shrinking or deleting a window with upcoming bookings inside', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)
    const slotStart = futureIsoMinutesFromNow(60)
    const slotMiddle = addMinutesToIso(slotStart, 30)
    const slotEnd = addMinutesToIso(slotStart, 60)

    const eventType = await app.inject({
      method: 'POST',
      url: '/admin/event-types',
      headers: { cookie },
      payload: {
        title: 'Consulting',
        description: 'Product consulting',
        durationMinutes: 30,
      },
    })
    const eventTypeId = eventType.json().id as string

    const window = await app.inject({
      method: 'POST',
      url: '/admin/availability-windows',
      headers: { cookie },
      payload: {
        startsAt: slotStart,
        endsAt: slotEnd,
      },
    })
    const windowId = window.json().id as string

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

    const shrinkWindow = await app.inject({
      method: 'PUT',
      url: `/admin/availability-windows/${windowId}`,
      headers: { cookie },
      payload: {
        startsAt: slotMiddle,
        endsAt: slotEnd,
      },
    })
    expect(shrinkWindow.statusCode).toBe(409)
    expect(shrinkWindow.json().code).toBe(
      'availability-window-has-upcoming-bookings',
    )

    const deleteWindow = await app.inject({
      method: 'DELETE',
      url: `/admin/availability-windows/${windowId}`,
      headers: { cookie },
    })
    expect(deleteWindow.statusCode).toBe(409)
    expect(deleteWindow.json().code).toBe(
      'availability-window-has-upcoming-bookings',
    )
  })
})
