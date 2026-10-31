import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { Loading } from './Loading'
import { AdminPage } from './pages/AdminPage'
import { HistoryPage } from './pages/HistoryPage'
import { InvitePage } from './pages/InvitePage'
import { LoginPage } from './pages/LoginPage'
import { StatsPage } from './pages/StatsPage'
import { TodayPage } from './pages/TodayPage'
import { useSession } from './session'

export function App() {
  const { user, loading, isAdmin } = useSession()

  if (loading) {
    return <Loading fullScreen />
  }

  return (
    <Routes>
      {/* Once the invite is accepted the user is signed in and the (now used) link must not be re-checked */}
      <Route path="/invite/:token" element={user ? <Navigate to="/" replace /> : <InvitePage />} />
      {user ? (
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="stats" element={<StatsPage />} />
          {isAdmin && <Route path="admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<LoginPage />} />
      )}
    </Routes>
  )
}
