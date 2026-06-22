import { expect, test, type APIRequestContext } from '@playwright/test'

const adminPassword = 'e2e-admin-password'
const ownerTimezone = 'Europe/Moscow'

interface EventTypeResponse {
  id: string
  title: string
  description: string
  durationMinutes: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nextQuarterHourIso(minutesAhead: number): string {
  const date = new Date(Date.now() + minutesAhead * 60_000)
  date.setUTCSeconds(0, 0)

  const remainder = date.getUTCMinutes() % 15
  if (remainder !== 0) {
    date.setUTCMinutes(date.getUTCMinutes() + 15 - remainder)
  }

  return date.toISOString()
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: ownerTimezone,
  }).format(new Date(iso))
}

async function loginViaApi(request: APIRequestContext): Promise<void> {
  const response = await request.post('/admin/login', {
    data: { password: adminPassword },
  })

  expect(response.ok(), await response.text()).toBe(true)
}

async function seedBookableSlot(request: APIRequestContext, title: string) {
  await loginViaApi(request)

  const eventTypeResponse = await request.post('/admin/event-types', {
    data: {
      title,
      description: 'Интеграционный сценарий',
      durationMinutes: 30,
    },
  })
  expect(eventTypeResponse.ok(), await eventTypeResponse.text()).toBe(true)

  const eventType = (await eventTypeResponse.json()) as EventTypeResponse
  const slotStart = nextQuarterHourIso(24 * 60)
  const slotEnd = addMinutes(slotStart, eventType.durationMinutes * 2)

  const availabilityResponse = await request.post('/admin/availability-windows', {
    data: {
      startsAt: slotStart,
      endsAt: slotEnd,
    },
  })
  expect(availabilityResponse.ok(), await availabilityResponse.text()).toBe(true)

  return {
    eventType,
    slotStart,
  }
}

test.describe('calendar booking MVP integration flow', () => {
  test('admin signs in and reaches the protected dashboard', async ({ page }) => {
    await page.goto('/admin/login')

    await expect(page.getByText('Вход в админку')).toBeVisible()

    await page.getByLabel('Пароль').fill(adminPassword)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole('heading', { name: 'Дмитрий Дерунов' }),
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Типы встреч' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Доступность' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Бронирования' })).toBeVisible()

    await page.getByRole('button', { name: 'Выйти' }).click()

    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('guest books a public slot and admin sees it as upcoming', async ({
    page,
    request,
  }) => {
    const uniqueSuffix = Date.now().toString()
    const eventTitle = `E2E консультация ${uniqueSuffix}`
    const guestName = `Ирина Гость ${uniqueSuffix}`
    const guestEmail = `irina-${uniqueSuffix}@example.com`

    const { slotStart } = await seedBookableSlot(request, eventTitle)
    const slotTime = formatSlotTime(slotStart)

    await page.goto('/')

    await expect(
      page.getByRole('heading', {
        name: /Забронировать время у Дмитрий Дерунов/,
      }),
    ).toBeVisible()

    await page
      .getByRole('button', { name: new RegExp(escapeRegExp(eventTitle)) })
      .click()
    await page.getByRole('button', { name: slotTime }).click()
    await page.getByLabel('Имя').fill(guestName)
    await page.getByLabel('Электронная почта').fill(guestEmail)
    await page.getByLabel('Комментарий').fill('Хочу обсудить MVP.')
    await page.getByRole('button', { name: 'Подтвердить бронирование' }).click()

    await expect(page.getByText('Бронирование подтверждено')).toBeVisible()
    await expect(
      page.getByText(new RegExp(`^${escapeRegExp(eventTitle)}:`)),
    ).toBeVisible()

    await page.goto('/admin/login')
    await page.getByLabel('Пароль').fill(adminPassword)
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByRole('tab', { name: 'Бронирования' }).click()

    await expect(page.getByRole('cell', { name: eventTitle })).toBeVisible()
    await expect(page.getByText(guestName)).toBeVisible()
    await expect(page.getByText(guestEmail)).toBeVisible()
  })
})
