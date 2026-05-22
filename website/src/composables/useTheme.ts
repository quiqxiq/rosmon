import { useTweaks } from './useTweaks'

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useTweaks()
  return { theme, setTheme, toggleTheme }
}
