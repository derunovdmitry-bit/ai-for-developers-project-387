import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { BackendConfig } from '../config.js'
import { unauthorized } from '../errors.js'
import {
  ADMIN_SESSION_COOKIE,
  clearSession,
  createSession,
  hasSession,
} from '../services/auth.js'
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listAvailabilityWindows,
  updateAvailabilityWindow,
} from '../services/availability.js'
import { listUpcomingBookings } from '../services/bookings.js'
import {
  createEventType,
  deleteEventType,
  listEventTypes,
  updateEventType,
} from '../services/event-types.js'
import type { AppStore } from '../store.js'
import {
  requireIntegerAtLeast,
  requireIsoDate,
  requireObject,
  requireTrimmedString,
} from '../validation.js'

function getSessionId(request: FastifyRequest): string | undefined {
  return request.cookies[ADMIN_SESSION_COOKIE]
}

function parseEventTypeInput(bodyValue: unknown) {
  const body = requireObject(bodyValue)
  return {
    title: requireTrimmedString(body, 'title'),
    description: requireTrimmedString(body, 'description'),
    durationMinutes: requireIntegerAtLeast(body, 'durationMinutes', 1),
  }
}

function parseAvailabilityInput(bodyValue: unknown) {
  const body = requireObject(bodyValue)
  return {
    startsAt: requireIsoDate(body, 'startsAt'),
    endsAt: requireIsoDate(body, 'endsAt'),
  }
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  store: AppStore,
  config: BackendConfig,
) {
  app.post('/admin/login', async (request, reply) => {
    const body = requireObject(request.body)
    const password = body.password

    if (
      !config.adminPassword ||
      typeof password !== 'string' ||
      password !== config.adminPassword
    ) {
      throw unauthorized('Неверный пароль.')
    }

    const sessionId = createSession(store)
    reply.setCookie(ADMIN_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })

    return { authenticated: true as const }
  })

  app.post('/admin/logout', async (request, reply) => {
    clearSession(store, getSessionId(request))
    reply.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' })
    return reply.status(204).send()
  })

  app.addHook('preHandler', async (request) => {
    if (!request.url.startsWith('/admin/')) {
      return
    }
    if (request.url === '/admin/login' || request.url === '/admin/logout') {
      return
    }
    if (!hasSession(store, getSessionId(request))) {
      throw unauthorized()
    }
  })

  app.get('/admin/owner', async () => store.owner)

  app.get('/admin/event-types', async () => ({
    items: listEventTypes(store),
  }))

  app.post('/admin/event-types', async (request) =>
    createEventType(store, parseEventTypeInput(request.body)),
  )

  app.put('/admin/event-types/:eventTypeId', async (request) =>
    updateEventType(
      store,
      (request.params as { eventTypeId: string }).eventTypeId,
      parseEventTypeInput(request.body),
    ),
  )

  app.delete('/admin/event-types/:eventTypeId', async (request, reply) => {
    deleteEventType(store, (request.params as { eventTypeId: string }).eventTypeId)
    return reply.status(204).send()
  })

  app.get('/admin/availability-windows', async () => ({
    items: listAvailabilityWindows(store),
  }))

  app.post('/admin/availability-windows', async (request) =>
    createAvailabilityWindow(store, parseAvailabilityInput(request.body)),
  )

  app.put('/admin/availability-windows/:availabilityWindowId', async (request) =>
    updateAvailabilityWindow(
      store,
      (request.params as { availabilityWindowId: string }).availabilityWindowId,
      parseAvailabilityInput(request.body),
    ),
  )

  app.delete(
    '/admin/availability-windows/:availabilityWindowId',
    async (request, reply) => {
      deleteAvailabilityWindow(
        store,
        (request.params as { availabilityWindowId: string }).availabilityWindowId,
      )
      return reply.status(204).send()
    },
  )

  app.get('/admin/bookings/upcoming', async () => ({
    items: listUpcomingBookings(store),
  }))
}
