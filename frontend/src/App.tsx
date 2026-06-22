import { useEffect, useState } from 'react'

import { AdminDashboard } from '@/features/admin/AdminDashboard'
import { AdminLoginPage } from '@/features/admin/AdminLoginPage'
import { PublicBookingPage } from '@/features/public/PublicBookingPage'

function navigateTo(pathname: string) {
  window.history.pushState(null, '', pathname)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    function handlePopState() {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (pathname === '/admin/login') {
    return <AdminLoginPage onAuthenticated={() => navigateTo('/admin')} />
  }

  if (pathname === '/admin') {
    return <AdminDashboard onUnauthorized={() => navigateTo('/admin/login')} />
  }

  return <PublicBookingPage />
}

export default App
