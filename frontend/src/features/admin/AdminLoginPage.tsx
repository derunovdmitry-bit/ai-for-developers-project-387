import { useState } from 'react'
import { CalendarDays, Loader2, Lock } from 'lucide-react'

import { adminApi, getErrorMessage } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateRequired } from '@/lib/validation'

interface AdminLoginPageProps {
  onAuthenticated: () => void
}

export function AdminLoginPage({ onAuthenticated }: AdminLoginPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateRequired(password, 'Пароль')
    if (!validation.valid) {
      setError(validation.message ?? 'Введите пароль.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await adminApi.login({ password })
      onAuthenticated()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            Бронирование слотов
          </div>
          <CardTitle>Вход в админку</CardTitle>
          <CardDescription>Введите настроенный пароль владельца календаря.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <Alert variant="destructive">
                <Lock aria-hidden="true" />
                <AlertTitle>Не удалось войти</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="adminPassword">Пароль</Label>
              <Input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Войти
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.history.pushState(null, '', '/')
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }}
              >
                Публичная страница
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
