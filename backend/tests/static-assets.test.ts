import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import type { BackendConfig } from '../src/config.js'
import { createServer } from '../src/server.js'

const indexHtml = '<!doctype html><html><body><div id="root"></div></body></html>'

let staticAssetsDir: string | undefined

async function createStaticApp(): Promise<FastifyInstance> {
  staticAssetsDir = await mkdtemp(path.join(tmpdir(), 'booking-static-'))
  await writeFile(path.join(staticAssetsDir, 'index.html'), indexHtml)

  const config: BackendConfig = {
    adminPassword: 'admin-password',
    host: '127.0.0.1',
    port: 0,
    staticAssetsDir,
  }
  const app = createServer(config)
  await app.ready()
  return app
}

describe('static assets', () => {
  afterEach(async () => {
    if (staticAssetsDir) {
      await rm(staticAssetsDir, { recursive: true, force: true })
      staticAssetsDir = undefined
    }
  })

  it('serves the frontend index for document routes without shadowing public API routes', async () => {
    const app = await createStaticApp()

    const publicApiResponse = await app.inject({
      method: 'GET',
      url: '/public/owner',
    })
    expect(publicApiResponse.statusCode).toBe(200)
    expect(publicApiResponse.headers['content-type']).toContain(
      'application/json',
    )

    const adminPageResponse = await app.inject({
      method: 'GET',
      url: '/admin/login',
      headers: { accept: 'text/html' },
    })
    expect(adminPageResponse.statusCode).toBe(200)
    expect(adminPageResponse.headers['content-type']).toContain('text/html')
    expect(adminPageResponse.body).toBe(indexHtml)
  })
})
