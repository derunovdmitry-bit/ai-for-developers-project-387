import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  User,
} from 'lucide-react'
import { ru } from 'date-fns/locale'

import { ApiRequestError, getErrorMessage, publicApi } from '@/api/client'
import type {
  AvailableSlot,
  Booking,
  CalendarOwnerProfile,
  EventType,
} from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  dateToLocalDayKey,
  dayKeyToLocalDate,
  formatDateTime,
  formatTime,
  groupSlotsByDay,
} from '@/lib/date-time'
import { validateEmail, validateRequired } from '@/lib/validation'

interface GuestFormState {
  guestName: string
  guestEmail: string
  guestComment: string
}

const initialGuestForm: GuestFormState = {
  guestName: '',
  guestEmail: '',
  guestComment: '',
}

function PublicPageSkeleton() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    </main>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Что-то пошло не так</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function PublicBookingPage() {
  const [owner, setOwner] = useState<CalendarOwnerProfile | null>(null)
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>('')
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [selectedSlotDayKey, setSelectedSlotDayKey] = useState<string>('')
  const [selectedSlotStartsAt, setSelectedSlotStartsAt] = useState<string>('')
  const [guestForm, setGuestForm] = useState<GuestFormState>(initialGuestForm)
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null)
  const [pageError, setPageError] = useState<string>('')
  const [slotError, setSlotError] = useState<string>('')
  const [formError, setFormError] = useState<string>('')
  const [loadingPage, setLoadingPage] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedEventType = useMemo(
    () => eventTypes.find((eventType) => eventType.id === selectedEventTypeId),
    [eventTypes, selectedEventTypeId],
  )

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startsAt === selectedSlotStartsAt),
    [slots, selectedSlotStartsAt],
  )

  const slotGroups = useMemo(
    () => (owner ? groupSlotsByDay(slots, owner.timezone) : []),
    [owner, slots],
  )

  const availableSlotDayKeys = useMemo(
    () => new Set(slotGroups.map((group) => group.dayKey)),
    [slotGroups],
  )

  const activeSlotDayKey = availableSlotDayKeys.has(selectedSlotDayKey)
    ? selectedSlotDayKey
    : (slotGroups[0]?.dayKey ?? '')

  const selectedSlotGroup = useMemo(
    () => slotGroups.find((group) => group.dayKey === activeSlotDayKey),
    [activeSlotDayKey, slotGroups],
  )

  const selectedSlotDate = activeSlotDayKey
    ? dayKeyToLocalDate(activeSlotDayKey)
    : undefined

  const loadInitialData = useCallback(async () => {
    setLoadingPage(true)
    setPageError('')

    try {
      const [ownerProfile, publicEventTypes] = await Promise.all([
        publicApi.getOwnerProfile(),
        publicApi.listEventTypes(),
      ])
      setOwner(ownerProfile)
      setEventTypes(publicEventTypes)
      setSelectedEventTypeId(publicEventTypes[0]?.id ?? '')
    } catch (error) {
      setPageError(getErrorMessage(error))
    } finally {
      setLoadingPage(false)
    }
  }, [])

  const loadSlots = useCallback(async (eventTypeId: string) => {
    if (!eventTypeId) {
      setSlots([])
      return
    }

    setLoadingSlots(true)
    setSlotError('')

    try {
      setSlots(await publicApi.listAvailableSlots(eventTypeId))
    } catch (error) {
      setSlotError(getErrorMessage(error))
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInitialData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadInitialData])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSlots(selectedEventTypeId)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadSlots, selectedEventTypeId])

  function handleSelectEventType(eventTypeId: string) {
    setSelectedEventTypeId(eventTypeId)
    setSelectedSlotDayKey('')
    setSelectedSlotStartsAt('')
    setConfirmedBooking(null)
  }

  function handleSelectSlotDay(date: Date | undefined) {
    if (!date) {
      return
    }

    const dayKey = dateToLocalDayKey(date)
    if (!availableSlotDayKeys.has(dayKey)) {
      return
    }

    setSelectedSlotDayKey(dayKey)
    setSelectedSlotStartsAt('')
  }

  async function handleSubmitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedEventType || !selectedSlot) {
      setFormError('Сначала выберите тип встречи и свободный слот.')
      return
    }

    const nameValidation = validateRequired(guestForm.guestName, 'Имя')
    if (!nameValidation.valid) {
      setFormError(nameValidation.message ?? 'Введите имя.')
      return
    }

    const emailValidation = validateEmail(guestForm.guestEmail)
    if (!emailValidation.valid) {
      setFormError(emailValidation.message ?? 'Введите корректный адрес электронной почты.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const guestComment = guestForm.guestComment.trim()
      const booking = await publicApi.createBooking({
        eventTypeId: selectedEventType.id,
        startsAt: selectedSlot.startsAt,
        guestName: guestForm.guestName.trim(),
        guestEmail: guestForm.guestEmail.trim(),
        ...(guestComment ? { guestComment } : {}),
      })

      setConfirmedBooking(booking)
      setGuestForm(initialGuestForm)
    } catch (error) {
      setFormError(getErrorMessage(error))

      if (
        error instanceof ApiRequestError &&
        (error.code === 'slot-not-available' ||
          error.code === 'booking-conflict' ||
          error.code === 'slot-outside-booking-window')
      ) {
        setSelectedSlotStartsAt('')
        await loadSlots(selectedEventType.id)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingPage) {
    return <PublicPageSkeleton />
  }

  if (!owner) {
    return (
      <main className="min-h-svh bg-background px-4 py-6 text-foreground">
        <div className="mx-auto max-w-3xl">
          <ErrorAlert message={pageError || 'Профиль владельца недоступен.'} />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 rounded-lg border bg-card p-5 text-card-foreground sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              Бронирование слотов
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Забронировать время у {owner.displayName}
              </h1>
              {owner.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {owner.description}
                </p>
              ) : null}
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            Часовой пояс: {owner.timezone}
          </Badge>
        </header>

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Тип встречи</CardTitle>
                <CardDescription>Выберите, какую встречу хотите забронировать.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {eventTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Пока нет доступных типов встреч.
                  </p>
                ) : (
                  eventTypes.map((eventType) => (
                    <button
                      key={eventType.id}
                      type="button"
                      className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:border-primary data-[selected=true]:bg-accent"
                      data-selected={eventType.id === selectedEventTypeId}
                      onClick={() => handleSelectEventType(eventType.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{eventType.title}</div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {eventType.description}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {eventType.durationMinutes} мин
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                window.history.pushState(null, '', '/admin/login')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              Админка
            </Button>
          </section>

          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Свободные слоты</CardTitle>
                <CardDescription>
                  Выберите дату в календаре. Слоты показаны в часовом поясе{' '}
                  {owner.timezone}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {slotError ? <ErrorAlert message={slotError} /> : null}

                {loadingSlots ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                  </div>
                ) : slotGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Для этого типа встречи нет свободных слотов.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                    <Calendar
                      mode="single"
                      selected={selectedSlotDate}
                      onSelect={handleSelectSlotDay}
                      locale={ru}
                      disabled={(date) =>
                        !availableSlotDayKeys.has(dateToLocalDayKey(date))
                      }
                      className="rounded-lg border bg-card"
                    />
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium">
                          {selectedSlotGroup?.dayLabel ?? 'Дата не выбрана'}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedSlotGroup
                            ? 'Выберите удобное время для встречи.'
                            : 'Выберите доступную дату в календаре.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSlotGroup?.slots.map((slot) => (
                          <Button
                            key={slot.startsAt}
                            type="button"
                            variant={
                              slot.startsAt === selectedSlotStartsAt
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            onClick={() => setSelectedSlotStartsAt(slot.startsAt)}
                          >
                            <Clock className="size-4" aria-hidden="true" />
                            {formatTime(slot.startsAt, owner.timezone)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {confirmedBooking ? (
              <Alert>
                <CheckCircle2 aria-hidden="true" />
                <AlertTitle>Бронирование подтверждено</AlertTitle>
                <AlertDescription>
                  {confirmedBooking.eventTypeTitle}: {' '}
                  {formatDateTime(confirmedBooking.startsAt, owner.timezone)}.
                </AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Данные гостя</CardTitle>
                <CardDescription>
                  {selectedSlot
                    ? `Выбран слот: ${formatDateTime(selectedSlot.startsAt, owner.timezone)}`
                    : 'Выберите слот перед отправкой данных.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmitBooking}>
                  {formError ? <ErrorAlert message={formError} /> : null}

                  <div className="grid gap-2">
                    <Label htmlFor="guestName">Имя</Label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="guestName"
                        className="pl-8"
                        value={guestForm.guestName}
                        onChange={(event) =>
                          setGuestForm((current) => ({
                            ...current,
                            guestName: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="guestEmail">Электронная почта</Label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="guestEmail"
                        className="pl-8"
                        type="email"
                        value={guestForm.guestEmail}
                        onChange={(event) =>
                          setGuestForm((current) => ({
                            ...current,
                            guestEmail: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="guestComment">Комментарий</Label>
                    <Textarea
                      id="guestComment"
                      value={guestForm.guestComment}
                      onChange={(event) =>
                        setGuestForm((current) => ({
                          ...current,
                          guestComment: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  <Button
                    type="submit"
                    disabled={!selectedSlot || submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Подтвердить бронирование
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  )
}
