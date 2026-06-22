export interface ValidationResult {
  valid: boolean
  message?: string
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (value.trim().length > 0) {
    return { valid: true }
  }

  return { valid: false, message: `Поле «${fieldName}» обязательно.` }
}

export function validateDuration(value: number): ValidationResult {
  if (Number.isFinite(value) && value >= 1) {
    return { valid: true }
  }

  return { valid: false, message: 'Длительность должна быть не меньше 1 минуты.' }
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: true }
  }

  return { valid: false, message: 'Введите корректный адрес электронной почты.' }
}

export function validateDateRange(startsAt: string, endsAt: string): ValidationResult {
  if (!startsAt || !endsAt) {
    return { valid: false, message: 'Укажите время начала и окончания.' }
  }

  if (new Date(endsAt).getTime() > new Date(startsAt).getTime()) {
    return { valid: true }
  }

  return { valid: false, message: 'Время окончания должно быть позже начала.' }
}
