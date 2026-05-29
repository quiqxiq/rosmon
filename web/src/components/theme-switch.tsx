import { useEffect } from 'react'
import { Check, Moon, Sun, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themes = [
  { value: 'light' as const, label: 'Light', color: '#f0f2f5' },
  { value: 'dark' as const, label: 'Dark', color: '#161b22' },
  { value: 'blue' as const, label: 'Ocean Blue', color: '#0369a1' },
  { value: 'green' as const, label: 'Forest Green', color: '#065f46' },
  { value: 'pink' as const, label: 'Rose Pink', color: '#9d174d' },
]

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const themeColors: Record<string, string> = {
      dark: '#020817',
      light: '#fff',
      blue: '#0369a1',
      green: '#065f46',
      pink: '#9d174d',
    }
    const resolved = theme === 'system' ? 'light' : theme
    const themeColor = themeColors[resolved] || '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [theme])

  const isLight = !['dark', 'blue', 'green', 'pink'].includes(
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='scale-95 rounded-full'>
          <Sun
            className={cn(
              'size-[1.2rem] transition-all',
              isLight ? 'scale-100 rotate-0' : 'scale-0 -rotate-90'
            )}
          />
          <Moon
            className={cn(
              'absolute size-[1.2rem] transition-all',
              theme === 'dark'
                ? 'scale-100 rotate-0'
                : 'scale-0 rotate-90'
            )}
          />
          <Palette
            className={cn(
              'absolute size-[1.2rem] transition-all',
              ['blue', 'green', 'pink'].includes(theme)
                ? 'scale-100 rotate-0'
                : 'scale-0 rotate-90'
            )}
          />
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel className='text-xs text-muted-foreground'>
          Theme
        </DropdownMenuLabel>
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className='flex items-center gap-2'
          >
            <span
              className='size-4 shrink-0 rounded-full border'
              style={{ background: t.color }}
            />
            {t.label}
            <Check
              size={14}
              className={cn('ms-auto', theme !== t.value && 'hidden')}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Sun className='size-4' />
          System
          <Check
            size={14}
            className={cn('ms-auto', theme !== 'system' && 'hidden')}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
