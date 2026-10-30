import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { api, type Member } from './api'

/** Loads data with `load` whenever `deps` change; `reload` refetches on demand. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await run())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, setData, loading, error, reload }
}

export function useMembers(groupId: number) {
  return useLoad<Member[]>(() => api.members(groupId), [groupId])
}

/** Wraps an async action: shows the server's error message as a toast and returns undefined on failure. */
export function useAction() {
  const { message } = App.useApp()
  return useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await fn()
        if (success) message.success(success)
        return result
      } catch (e) {
        message.error((e as Error).message)
        return undefined
      }
    },
    [message],
  )
}
