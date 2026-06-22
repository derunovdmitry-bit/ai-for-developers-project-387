import { describe, expect, it } from 'vitest'

import { readConfig } from '../src/config.js'
import { createServer } from '../src/server.js'
import { createTestApp, loginAsAdmin } from './helpers.js'

describe('admin auth', () => {
  it('rejects invalid login', async () => {
    const app = await createTestApp()

    const response = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { password: 'wrong' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      code: 'unauthorized',
      message: 'Неверный пароль.',
    })
  })

  it('rejects login when ADMIN_PASSWORD is not configured', async () => {
    const app = createServer(readConfig({}))
    await app.ready()

    const response = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { password: 'admin-password' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      code: 'unauthorized',
      message: 'Неверный пароль.',
    })
  })

  it('sets a session cookie on valid login and allows protected access', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    const response = await app.inject({
      method: 'GET',
      url: '/admin/owner',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: 'owner-main',
      displayName: 'Дмитрий Дерунов',
      timezone: 'Europe/Moscow',
    })
  })

  it('rejects protected access without a known session', async () => {
    const app = await createTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/admin/owner',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      code: 'unauthorized',
      message: 'Требуется вход в админку.',
    })
  })

  it('clears the session on logout', async () => {
    const app = await createTestApp()
    const cookie = await loginAsAdmin(app)

    const logout = await app.inject({
      method: 'POST',
      url: '/admin/logout',
      headers: { cookie },
    })
    expect(logout.statusCode).toBe(204)

    const protectedResponse = await app.inject({
      method: 'GET',
      url: '/admin/owner',
      headers: { cookie },
    })
    expect(protectedResponse.statusCode).toBe(401)
  })
})
