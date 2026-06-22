import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import type { BackendConfig } from './config.js'
import { ApiDomainError } from './errors.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerPublicRoutes } from './routes/public.js'
import { createStore } from './store.js'

const frontendRoutes = new Set(['/', '/admin', '/admin/login'])

const contentTypesByExtension = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
])

function getRequestPath(request: FastifyRequest): string | undefined {
  try {
    return decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  } catch {
    return undefined
  }
}

function resolveStaticFile(staticRoot: string, requestPath: string): string | undefined {
  const filePath = path.resolve(staticRoot, `.${requestPath}`)
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
    return undefined
  }

  return filePath
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath)
    return fileStat.isFile()
  } catch {
    return false
  }
}

async function sendStaticFile(reply: FastifyReply, filePath: string) {
  reply.type(
    contentTypesByExtension.get(path.extname(filePath)) ??
      'application/octet-stream',
  )
  return reply.send(createReadStream(filePath))
}

function registerStaticAssets(app: FastifyInstance, staticAssetsDir: string) {
  const staticRoot = path.resolve(staticAssetsDir)
  const indexPath = path.join(staticRoot, 'index.html')

  app.get('/*', async (request, reply) => {
    const requestPath = getRequestPath(request)
    if (!requestPath) {
      return reply.callNotFound()
    }

    const filePath = resolveStaticFile(staticRoot, requestPath)
    if (filePath && (await isFile(filePath))) {
      return sendStaticFile(reply, filePath)
    }

    if (frontendRoutes.has(requestPath) && (await isFile(indexPath))) {
      return sendStaticFile(reply, indexPath)
    }

    return reply.callNotFound()
  })
}

export function createServer(config: BackendConfig) {
  const app = Fastify({ logger: false })
  const store = createStore()

  void app.register(cookie)
  void registerPublicRoutes(app, store)
  void registerAdminRoutes(app, store, config)
  if (config.staticAssetsDir) {
    registerStaticAssets(app, config.staticAssetsDir)
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiDomainError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      })
    }

    return reply.status(500).send({
      code: 'validation-error',
      message: 'Внутренняя ошибка сервера.',
    })
  })

  return app
}
