import { randomBytes } from 'node:crypto'

import type { AppStore } from '../store.js'

export const ADMIN_SESSION_COOKIE = 'admin_session'

export function createSession(store: AppStore): string {
  const sessionId = randomBytes(32).toString('base64url')
  store.sessions.add(sessionId)
  return sessionId
}

export function hasSession(
  store: AppStore,
  sessionId: string | undefined,
): boolean {
  return Boolean(sessionId && store.sessions.has(sessionId))
}

export function clearSession(
  store: AppStore,
  sessionId: string | undefined,
): void {
  if (sessionId) {
    store.sessions.delete(sessionId)
  }
}
