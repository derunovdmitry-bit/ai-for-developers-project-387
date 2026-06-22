import type { FastifyInstance } from 'fastify'

import { createBooking, listAvailableSlots } from '../services/bookings.js'
import { listEventTypes } from '../services/event-types.js'
import type { AppStore } from '../store.js'
import {
  assertEmail,
  optionalTrimmedString,
  requireIsoDate,
  requireObject,
  requireTrimmedString,
} from '../validation.js'

function parseBookingInput(bodyValue: unknown) {
  const body = requireObject(bodyValue)
  const guestName = requireTrimmedString(body, 'guestName')
  const guestEmail = requireTrimmedString(body, 'guestEmail')
  const guestComment = optionalTrimmedString(body, 'guestComment')
  assertEmail(guestEmail)

  return {
    eventTypeId: requireTrimmedString(body, 'eventTypeId'),
    startsAt: requireIsoDate(body, 'startsAt'),
    guestName,
    guestEmail,
    ...(guestComment ? { guestComment } : {}),
  }
}

export async function registerPublicRoutes(
  app: FastifyInstance,
  store: AppStore,
) {
  app.get('/public/owner', async () => store.owner)

  app.get('/public/event-types', async () => ({
    items: listEventTypes(store),
  }))

  app.get('/public/event-types/:eventTypeId/slots', async (request) => ({
    items: listAvailableSlots(
      store,
      (request.params as { eventTypeId: string }).eventTypeId,
    ),
  }))

  app.post('/public/bookings', async (request) =>
    createBooking(store, parseBookingInput(request.body)),
  )
}
