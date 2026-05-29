import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

type Theme =
  | 'dark'
  | 'light'
  | 'system'
  | 'blue'
  | 'green'
  | 'pink'
  | 'roslib-dark'
  | 'roslib-light'
type ResolvedTheme = Exclude<Theme, 'system'>

export type Accent =
  | 'accent-roslib'
  | 'accent-tech'
  | 'accent-sunset'
  | 'accent-corporate'
  | 'accent-natural'

const DEFAULT_THEME = 'system'
const DEFAULT_ACCENT: Accent = 'accent-roslib'
const THEME_COOKIE_NAME = 'vite-ui-theme'
const ACCENT_COOKIE_NAME = 'vite-ui-accent'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const THEME_CLASSES = [
  'light',
  'dark',
  'blue',
  'green',
  'pink',
  'roslib-dark',
  'roslib-light',
] as const

const ACCENT_CLASSES: readonly Accent[] = [
  'accent-roslib',
  'accent-tech',
  'accent-sunset',
  'accent-corporate',
  'accent-natural',
] as const

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: Theme
  resolvedTheme: ResolvedTheme
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
  accent: Accent
  setAccent: (accent: Accent) => void
}

const initialState: ThemeProviderState = {
  defaultTheme: DEFAULT_THEME,
  resolvedTheme: 'light',
  theme: DEFAULT_THEME,
  setTheme: () => null,
  resetTheme: () => null,
  accent: DEFAULT_ACCENT,
  setAccent: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

function resolveThemeClass(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme as ResolvedTheme
}

function isAccent(value: string | undefined): value is Accent {
  return !!value && (ACCENT_CLASSES as readonly string[]).includes(value)
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_COOKIE_NAME,
  ...props
}: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(
    () => (getCookie(storageKey) as Theme) || defaultTheme
  )
  const [accent, _setAccent] = useState<Accent>(() => {
    const stored = getCookie(ACCENT_COOKIE_NAME)
    return isAccent(stored) ? stored : DEFAULT_ACCENT
  })

  const resolvedTheme = useMemo((): ResolvedTheme => resolveThemeClass(theme), [theme])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (currentTheme: ResolvedTheme) => {
      for (const cls of THEME_CLASSES) {
        root.classList.remove(cls)
      }
      root.classList.add(currentTheme)
    }

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(resolveThemeClass('system'))
      }
    }

    applyTheme(resolvedTheme)

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, resolvedTheme])

  useEffect(() => {
    const root = window.document.documentElement
    for (const cls of ACCENT_CLASSES) {
      root.classList.remove(cls)
    }
    root.classList.add(accent)
  }, [accent])

  const setTheme = (newTheme: Theme) => {
    setCookie(storageKey, newTheme, THEME_COOKIE_MAX_AGE)
    _setTheme(newTheme)
  }

  const setAccent = (newAccent: Accent) => {
    setCookie(ACCENT_COOKIE_NAME, newAccent, THEME_COOKIE_MAX_AGE)
    _setAccent(newAccent)
  }

  const resetTheme = () => {
    removeCookie(storageKey)
    removeCookie(ACCENT_COOKIE_NAME)
    _setTheme(DEFAULT_THEME)
    _setAccent(DEFAULT_ACCENT)
  }

  const contextValue = {
    defaultTheme,
    resolvedTheme,
    resetTheme,
    theme,
    setTheme,
    accent,
    setAccent,
  }

  return (
    <ThemeContext value={contextValue} {...props}>
      {children}
    </ThemeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
