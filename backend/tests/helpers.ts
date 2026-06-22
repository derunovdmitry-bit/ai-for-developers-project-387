import type { FastifyInstance } from 'fastify'

import type { BackendConfig } from '../src/config.js'
import { createServer } from '../src/server.js'

export function testConfig(overrides: Partial<BackendConfig> = {}): BackendConfig {
  return {
    adminPassword: 'admin-password',
    host: '127.0.0.1',
    port: 0,
    ...overrides,
  }
}

export async function createTestApp(
  overrides: Partial<BackendConfig> = {},
): Promise<FastifyInstance> {
  const app = createServer(testConfig(overrides))
  await app.ready()
  return app
}

export async function loginAsAdmin(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/admin/login',
    payload: { password: 'admin-password' },
  })

  if (response.statusCode !== 200) {
    throw new Error(`Login failed in test: ${response.statusCode} ${response.body}`)
  }

  const setCookie = response.headers['set-cookie']
  if (!setCookie) {
    throw new Error('Login did not set a cookie.')
  }

  if (Array.isArray(setCookie)) {
    const firstCookie = setCookie[0]
    if (!firstCookie) {
      throw new Error('Login returned an empty set-cookie header.')
    }
    return firstCookie
  }

  return setCookie
}

export function futureIsoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

export function addMinutesToIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}
