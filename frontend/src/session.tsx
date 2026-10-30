import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, LOGOUT_EVENT, tokenStore, type Group, type User } from './api'

const GROUP_KEY = 'pb_group'

interface Session {
  user: User | null
  groups: Group[]
  group: Group | null
  loading: boolean
  isAdmin: boolean
  signIn: (token: string) => Promise<void>
  signOut: () => void
  selectGroup: (id: number) => void
  reload: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState<number | null>(() => Number(localStorage.getItem(GROUP_KEY)) || null)
  const [loading, setLoading] = useState(!!tokenStore.get())

  const reload = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await api.me()
      setUser(me.user)
      setGroups(me.groups)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setGroups([])
  }, [])

  useEffect(() => {
    void reload()
    window.addEventListener(LOGOUT_EVENT, signOut)
    return () => window.removeEventListener(LOGOUT_EVENT, signOut)
  }, [reload, signOut])

  const value = useMemo<Session>(() => {
    const group = groups.find((g) => g.id === groupId) ?? groups[0] ?? null
    return {
      user,
      groups,
      group,
      loading,
      isAdmin: group?.role === 'admin',
      signIn: async (token) => {
        tokenStore.set(token)
        setLoading(true)
        await reload()
      },
      signOut,
      selectGroup: (id) => {
        localStorage.setItem(GROUP_KEY, String(id))
        setGroupId(id)
      },
      reload,
    }
  }, [user, groups, groupId, loading, reload, signOut])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}

/** The selected group; only call inside screens that render after a group is known. */
export function useGroup(): Group {
  const { group } = useSession()
  if (!group) throw new Error('No group selected')
  return group
}
