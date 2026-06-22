import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Edit,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { ru } from 'date-fns/locale'

import { adminApi, ApiRequestError, getErrorMessage } from '@/api/client'
import type {
  AvailabilityWindow,
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  dateToLocalDayKey,
  dayKeyToLocalDate,
  formatDateTime,
  formatLocalDay,
  getDatePartFromDateTimeLocal,
  getTimePartFromDateTimeLocal,
  localDateTimeToUtcIso,
  mergeDateAndTimeParts,
  toDateTimeLocalValue,
} from '@/lib/date-time'
import {
  validateDateRange,
  validateDuration,
  validateRequired,
} from '@/lib/validation'

interface AdminDashboardProps {
  onUnauthorized: () => void
}

interface EventTypeFormState {
  title: string
  description: string
  durationMinutes: string
}

interface AvailabilityFormState {
  startsAt: string
  endsAt: string
}

const emptyEventTypeForm: EventTypeFormState = {
  title: '',
  description: '',
  durationMinutes: '30',
}

const emptyAvailabilityForm: AvailabilityFormState = {
  startsAt: '',
  endsAt: '',
}

function ErrorAlert({ title, message }: { title: string; message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'unauthorized'
}

function bookingEventTypeLabel(eventTypes: EventType[], booking: Booking): string {
  return (
    eventTypes.find((eventType) => eventType.id === booking.eventTypeId)?.title ??
    booking.eventTypeTitle
  )
}

interface DateTimeCalendarFieldProps {
  id: string
  label: string
  value: string
  defaultTime: string
  onChange: (value: string) => void
}

function DateTimeCalendarField({
  id,
  label,
  value,
  defaultTime,
  onChange,
}: DateTimeCalendarFieldProps) {
  const datePart = getDatePartFromDateTimeLocal(value)
  const timePart = getTimePartFromDateTimeLocal(value)
  const selectedDate = datePart ? dayKeyToLocalDate(datePart) : undefined

  function handleSelectDate(date: Date | undefined) {
    if (!date) {
      return
    }

    onChange(mergeDateAndTimeParts(dateToLocalDayKey(date), timePart || defaultTime))
  }

  function handleTimeChange(nextTime: string) {
    onChange(mergeDateAndTimeParts(datePart, nextTime))
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}Time`}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={`${id}Date`}
              type="button"
              variant="outline"
              className="justify-start font-normal"
            >
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              {selectedDate ? formatLocalDay(selectedDate) : 'Выберите дату'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              locale={ru}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <Input
          id={`${id}Time`}
          type="time"
          value={timePart}
          onChange={(event) => handleTimeChange(event.target.value)}
        />
      </div>
    </div>
  )
}

export function AdminDashboard({ onUnauthorized }: AdminDashboardProps) {
  const [owner, setOwner] = useState<CalendarOwnerProfile | null>(null)
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [availabilityWindows, setAvailabilityWindows] = useState<
    AvailabilityWindow[]
  >([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [eventForm, setEventForm] =
    useState<EventTypeFormState>(emptyEventTypeForm)
  const [availabilityForm, setAvailabilityForm] =
    useState<AvailabilityFormState>(emptyAvailabilityForm)
  const [editingEventType, setEditingEventType] = useState<EventType | null>(null)
  const [editingAvailabilityWindow, setEditingAvailabilityWindow] =
    useState<AvailabilityWindow | null>(null)
  const [eventTypeToDelete, setEventTypeToDelete] = useState<EventType | null>(
    null,
  )
  const [availabilityWindowToDelete, setAvailabilityWindowToDelete] =
    useState<AvailabilityWindow | null>(null)
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [eventFormError, setEventFormError] = useState('')
  const [availabilityFormError, setAvailabilityFormError] = useState('')

  const filteredBookings = useMemo(() => {
    if (eventTypeFilter === 'all') {
      return bookings
    }

    return bookings.filter((booking) => booking.eventTypeId === eventTypeFilter)
  }, [bookings, eventTypeFilter])

  const timezone = owner?.timezone ?? 'UTC'

  const handleError = useCallback(
    (requestError: unknown) => {
      if (isUnauthorized(requestError)) {
        onUnauthorized()
        return
      }

      setError(getErrorMessage(requestError))
    },
    [onUnauthorized],
  )

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [ownerProfile, managedEventTypes, windows, upcomingBookings] =
        await Promise.all([
          adminApi.getOwnerProfile(),
          adminApi.listEventTypes(),
          adminApi.listAvailabilityWindows(),
          adminApi.listUpcomingBookings(),
        ])

      setOwner(ownerProfile)
      setEventTypes(managedEventTypes)
      setAvailabilityWindows(windows)
      setBookings(upcomingBookings)
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  const reloadEventTypes = useCallback(async () => {
    try {
      setEventTypes(await adminApi.listEventTypes())
    } catch (requestError) {
      handleError(requestError)
    }
  }, [handleError])

  const reloadAvailabilityWindows = useCallback(async () => {
    try {
      setAvailabilityWindows(await adminApi.listAvailabilityWindows())
    } catch (requestError) {
      handleError(requestError)
    }
  }, [handleError])

  const reloadBookings = useCallback(async () => {
    try {
      setBookings(await adminApi.listUpcomingBookings())
    } catch (requestError) {
      handleError(requestError)
    }
  }, [handleError])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  async function handleLogout() {
    setSubmitting(true)
    setError('')

    try {
      await adminApi.logout()
      onUnauthorized()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  function validateEventForm(form: EventTypeFormState): number | null {
    const titleValidation = validateRequired(form.title, 'Название')
    if (!titleValidation.valid) {
      setEventFormError(titleValidation.message ?? 'Введите название.')
      return null
    }

    const duration = Number(form.durationMinutes)
    const durationValidation = validateDuration(duration)
    if (!durationValidation.valid) {
      setEventFormError(
        durationValidation.message ?? 'Длительность должна быть не меньше 1 минуты.',
      )
      return null
    }

    return duration
  }

  async function handleCreateEventType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const duration = validateEventForm(eventForm)
    if (duration === null) {
      return
    }

    setSubmitting(true)
    setEventFormError('')

    try {
      await adminApi.createEventType({
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        durationMinutes: duration,
      })
      setEventForm(emptyEventTypeForm)
      await reloadEventTypes()
    } catch (requestError) {
      setEventFormError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateEventType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingEventType) {
      return
    }

    const duration = validateEventForm(eventForm)
    if (duration === null) {
      return
    }

    setSubmitting(true)
    setEventFormError('')

    try {
      await adminApi.updateEventType(editingEventType.id, {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        durationMinutes: duration,
      })
      setEditingEventType(null)
      setEventForm(emptyEventTypeForm)
      await reloadEventTypes()
    } catch (requestError) {
      setEventFormError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteEventType() {
    if (!eventTypeToDelete) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await adminApi.deleteEventType(eventTypeToDelete.id)
      setEventTypeToDelete(null)
      await reloadEventTypes()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  function validateAvailabilityForm(form: AvailabilityFormState): boolean {
    const validation = validateDateRange(form.startsAt, form.endsAt)
    if (!validation.valid) {
      setAvailabilityFormError(
        validation.message ?? 'Время окончания должно быть позже начала.',
      )
      return false
    }

    return true
  }

  async function handleCreateAvailabilityWindow(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!validateAvailabilityForm(availabilityForm)) {
      return
    }

    setSubmitting(true)
    setAvailabilityFormError('')

    try {
      await adminApi.createAvailabilityWindow({
        startsAt: localDateTimeToUtcIso(availabilityForm.startsAt),
        endsAt: localDateTimeToUtcIso(availabilityForm.endsAt),
      })
      setAvailabilityForm(emptyAvailabilityForm)
      await reloadAvailabilityWindows()
    } catch (requestError) {
      setAvailabilityFormError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateAvailabilityWindow(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!editingAvailabilityWindow || !validateAvailabilityForm(availabilityForm)) {
      return
    }

    setSubmitting(true)
    setAvailabilityFormError('')

    try {
      await adminApi.updateAvailabilityWindow(editingAvailabilityWindow.id, {
        startsAt: localDateTimeToUtcIso(availabilityForm.startsAt),
        endsAt: localDateTimeToUtcIso(availabilityForm.endsAt),
      })
      setEditingAvailabilityWindow(null)
      setAvailabilityForm(emptyAvailabilityForm)
      await reloadAvailabilityWindows()
    } catch (requestError) {
      setAvailabilityFormError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAvailabilityWindow() {
    if (!availabilityWindowToDelete) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await adminApi.deleteAvailabilityWindow(availabilityWindowToDelete.id)
      setAvailabilityWindowToDelete(null)
      await reloadAvailabilityWindows()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  function openEditEventTypeDialog(eventType: EventType) {
    setEventForm({
      title: eventType.title,
      description: eventType.description,
      durationMinutes: String(eventType.durationMinutes),
    })
    setEventFormError('')
    setEditingEventType(eventType)
  }

  function openEditAvailabilityWindowDialog(window: AvailabilityWindow) {
    setAvailabilityForm({
      startsAt: toDateTimeLocalValue(window.startsAt),
      endsAt: toDateTimeLocalValue(window.endsAt),
    })
    setAvailabilityFormError('')
    setEditingAvailabilityWindow(window)
  }

  if (loading) {
    return (
      <main className="min-h-svh bg-background px-4 py-6 text-foreground">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              Админка
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                {owner?.displayName ?? 'Владелец календаря'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {owner?.description ??
                  'Управляйте типами встреч, доступностью и бронированиями.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Badge variant="outline" className="w-fit">
              Часовой пояс: {timezone}
            </Badge>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadDashboard()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Обновить
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => void handleLogout()}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Выйти
              </Button>
            </div>
          </div>
        </header>

        {error ? <ErrorAlert title="Ошибка запроса в админке" message={error} /> : null}

        <Tabs defaultValue="event-types" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:w-fit">
            <TabsTrigger value="event-types">Типы встреч</TabsTrigger>
            <TabsTrigger value="availability">Доступность</TabsTrigger>
            <TabsTrigger value="bookings">Бронирования</TabsTrigger>
          </TabsList>

          <TabsContent value="event-types" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Создать тип встречи</CardTitle>
                <CardDescription>
                  Гости могут бронировать любой тип встречи из этого списка.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 lg:grid-cols-[1fr_1fr_9rem_auto]"
                  onSubmit={handleCreateEventType}
                >
                  {eventFormError ? (
                    <div className="lg:col-span-4">
                      <ErrorAlert title="Ошибка типа встречи" message={eventFormError} />
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <Label htmlFor="eventTitle">Название</Label>
                    <Input
                      id="eventTitle"
                      value={eventForm.title}
                      onChange={(event) =>
                        setEventForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="eventDescription">Описание</Label>
                    <Input
                      id="eventDescription"
                      value={eventForm.description}
                      onChange={(event) =>
                        setEventForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="eventDuration">Минуты</Label>
                    <Input
                      id="eventDuration"
                      type="number"
                      min="1"
                      value={eventForm.durationMinutes}
                      onChange={(event) =>
                        setEventForm((current) => ({
                          ...current,
                          durationMinutes: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="self-end">
                    <Plus className="size-4" aria-hidden="true" />
                    Создать
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              {eventTypes.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    Типы встреч пока не созданы.
                  </CardContent>
                </Card>
              ) : (
                eventTypes.map((eventType) => (
                  <Card key={eventType.id} size="sm">
                    <CardHeader>
                      <CardTitle>{eventType.title}</CardTitle>
                      <CardDescription>{eventType.description}</CardDescription>
                      <CardAction>
                        <Badge variant="secondary">
                          {eventType.durationMinutes} мин
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditEventTypeDialog(eventType)}
                      >
                        <Edit className="size-4" aria-hidden="true" />
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setEventTypeToDelete(eventType)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Удалить
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Создать окно доступности</CardTitle>
                <CardDescription>
                  Используйте конкретные разовые интервалы. Значения вводятся в
                  локальном времени браузера и отправляются как UTC.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                  onSubmit={handleCreateAvailabilityWindow}
                >
                  {availabilityFormError ? (
                    <div className="sm:col-span-3">
                      <ErrorAlert
                        title="Ошибка доступности"
                        message={availabilityFormError}
                      />
                    </div>
                  ) : null}
                  <DateTimeCalendarField
                    id="availabilityStartsAt"
                    label="Начало"
                    value={availabilityForm.startsAt}
                    defaultTime="09:00"
                    onChange={(value) =>
                      setAvailabilityForm((current) => ({
                        ...current,
                        startsAt: value,
                      }))
                    }
                  />
                  <DateTimeCalendarField
                    id="availabilityEndsAt"
                    label="Окончание"
                    value={availabilityForm.endsAt}
                    defaultTime="18:00"
                    onChange={(value) =>
                      setAvailabilityForm((current) => ({
                        ...current,
                        endsAt: value,
                      }))
                    }
                  />
                  <Button type="submit" disabled={submitting} className="self-end">
                    <Plus className="size-4" aria-hidden="true" />
                    Создать
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              {availabilityWindows.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    Окна доступности пока не созданы.
                  </CardContent>
                </Card>
              ) : (
                availabilityWindows.map((window) => (
                  <Card key={window.id} size="sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="size-4" aria-hidden="true" />
                        {formatDateTime(window.startsAt, timezone)}
                      </CardTitle>
                      <CardDescription>
                        Окончание: {formatDateTime(window.endsAt, timezone)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditAvailabilityWindowDialog(window)}
                      >
                        <Edit className="size-4" aria-hidden="true" />
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setAvailabilityWindowToDelete(window)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Удалить
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Предстоящие бронирования</CardTitle>
                <CardDescription>
                  Подтвержденные бронирования по всем типам встреч.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:w-64">
                  <Label>Фильтр по типу встречи</Label>
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Все типы встреч" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все типы встреч</SelectItem>
                      {eventTypes.map((eventType) => (
                        <SelectItem key={eventType.id} value={eventType.id}>
                          {eventType.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Встреча</TableHead>
                        <TableHead>Начало</TableHead>
                        <TableHead>Окончание</TableHead>
                        <TableHead>Гость</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Создано</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Предстоящих бронирований нет.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell className="font-medium">
                              {bookingEventTypeLabel(eventTypes, booking)}
                            </TableCell>
                            <TableCell>
                              {formatDateTime(booking.startsAt, timezone)}
                            </TableCell>
                            <TableCell>
                              {formatDateTime(booking.endsAt, timezone)}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div>{booking.guestName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {booking.guestEmail}
                                </div>
                                {booking.guestComment ? (
                                  <div className="max-w-56 text-xs text-muted-foreground">
                                    {booking.guestComment}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge>
                                {booking.status === 'confirmed'
                                  ? 'Подтверждено'
                                  : booking.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDateTime(booking.createdAt, timezone)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void reloadBookings()}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Обновить бронирования
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={editingEventType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEventType(null)
            setEventForm(emptyEventTypeForm)
            setEventFormError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить тип встречи</DialogTitle>
            <DialogDescription>
              Идентификатор типа встречи остается неизменным.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateEventType}>
            {eventFormError ? (
              <ErrorAlert title="Ошибка типа встречи" message={eventFormError} />
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="editEventTitle">Название</Label>
              <Input
                id="editEventTitle"
                value={eventForm.title}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEventDescription">Описание</Label>
              <Textarea
                id="editEventDescription"
                value={eventForm.description}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEventDuration">Длительность в минутах</Label>
              <Input
                id="editEventDuration"
                type="number"
                min="1"
                value={eventForm.durationMinutes}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    durationMinutes: event.target.value,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eventTypeToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEventTypeToDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить тип встречи</DialogTitle>
            <DialogDescription>
              Сервер отклонит удаление, если у этого типа встречи есть
              предстоящие подтвержденные бронирования.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Удалить {eventTypeToDelete ? eventTypeToDelete.title : 'этот тип встречи'}?
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleDeleteEventType()}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingAvailabilityWindow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAvailabilityWindow(null)
            setAvailabilityForm(emptyAvailabilityForm)
            setAvailabilityFormError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить окно доступности</DialogTitle>
            <DialogDescription>
              Существующие предстоящие бронирования должны остаться внутри интервала.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateAvailabilityWindow}>
            {availabilityFormError ? (
              <ErrorAlert
                title="Ошибка доступности"
                message={availabilityFormError}
              />
            ) : null}
            <DateTimeCalendarField
              id="editAvailabilityStartsAt"
              label="Начало"
              value={availabilityForm.startsAt}
              defaultTime="09:00"
              onChange={(value) =>
                setAvailabilityForm((current) => ({
                  ...current,
                  startsAt: value,
                }))
              }
            />
            <DateTimeCalendarField
              id="editAvailabilityEndsAt"
              label="Окончание"
              value={availabilityForm.endsAt}
              defaultTime="18:00"
              onChange={(value) =>
                setAvailabilityForm((current) => ({
                  ...current,
                  endsAt: value,
                }))
              }
            />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={availabilityWindowToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAvailabilityWindowToDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить окно доступности</DialogTitle>
            <DialogDescription>
              Сервер отклонит удаление, если внутри этого окна есть
              подтвержденные предстоящие бронирования.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Удалить это окно доступности с{' '}
            {availabilityWindowToDelete
              ? formatDateTime(availabilityWindowToDelete.startsAt, timezone)
              : ''}
            ?
          </p>
          <Separator />
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleDeleteAvailabilityWindow()}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
