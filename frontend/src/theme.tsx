import { ConfigProvider, theme } from 'antd'
import enGB from 'antd/locale/en_GB'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Mode = 'light' | 'dark'

const STORAGE_KEY = 'pb_theme'
const PRIMARY = { light: '#15803d', dark: '#22a052' }
const media = window.matchMedia('(prefers-color-scheme: dark)')

const readStored = (): Mode | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const ThemeContext = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} })

/** Follows the phone's light/dark setting until the user picks one with the header button. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Mode | null>(readStored)
  const [system, setSystem] = useState<Mode>(media.matches ? 'dark' : 'light')
  const mode = stored ?? system

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#141414' : PRIMARY.light)
  }, [mode])

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the choice just won't survive a reload.
    }
    setStored(next)
  }

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      <ConfigProvider
        locale={enGB}
        theme={{
          algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: { colorPrimary: PRIMARY[mode], borderRadius: 8 },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export const useThemeMode = () => useContext(ThemeContext)
