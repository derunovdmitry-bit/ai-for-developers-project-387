import { validation } from './errors.js'
import { parseIsoDateTime } from './time.js'

export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw validation('Тело запроса должно быть JSON-объектом.')
  }

  return value as Record<string, unknown>
}

export function requireTrimmedString(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validation(`Поле ${field} обязательно.`)
  }

  return value.trim()
}

export function optionalTrimmedString(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = body[field]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw validation(`Поле ${field} должно быть строкой.`)
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function requireIntegerAtLeast(
  body: Record<string, unknown>,
  field: string,
  min: number,
): number {
  const value = body[field]
  if (!Number.isInteger(value) || (value as number) < min) {
    throw validation(`Поле ${field} должно быть целым числом не меньше ${min}.`)
  }

  return value as number
}

export function requireIsoDate(body: Record<string, unknown>, field: string): Date {
  const date = parseIsoDateTime(body[field])
  if (!date) {
    throw validation(`Поле ${field} должно быть корректной ISO date-time строкой.`)
  }

  return date
}

export function assertEmail(value: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw validation('Введите корректный email.')
  }
}
