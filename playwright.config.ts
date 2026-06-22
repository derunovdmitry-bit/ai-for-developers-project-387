import { defineConfig, devices } from '@playwright/test'

const backendPort = process.env.E2E_BACKEND_PORT ?? '3100'
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '5173'
const backendUrl = `http://127.0.0.1:${backendPort}`
const frontendUrl = `http://127.0.0.1:${frontendPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: frontendUrl,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:backend',
      env: {
        ADMIN_PASSWORD: 'e2e-admin-password',
        HOST: '127.0.0.1',
        PORT: backendPort,
      },
      timeout: 30_000,
      url: `${backendUrl}/public/owner`,
    },
    {
      command: `npm --prefix frontend run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      env: {
        VITE_API_PROXY_TARGET: backendUrl,
      },
      timeout: 30_000,
      url: frontendUrl,
    },
  ],
})
