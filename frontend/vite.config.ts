import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000'
const adminSpaRoutes = new Set(['/admin', '/admin/login'])

function isAdminSpaNavigation(request: IncomingMessage): boolean {
  const requestUrl = request.url?.split('?')[0]
  const acceptHeader = request.headers.accept ?? ''

  return (
    request.method === 'GET' &&
    Boolean(requestUrl && adminSpaRoutes.has(requestUrl)) &&
    acceptHeader.includes('text/html')
  )
}

const apiProxy = {
  target: apiProxyTarget,
  bypass(request: IncomingMessage) {
    if (isAdminSpaNavigation(request)) {
      return '/index.html'
    }

    return undefined
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/admin': apiProxy,
      '/public': apiProxyTarget,
    },
  },
})
