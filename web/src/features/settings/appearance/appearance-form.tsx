import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { fonts } from '@/config/fonts'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { cn } from '@/lib/utils'
import { useFont } from '@/context/font-provider'
import { useTheme } from '@/context/theme-provider'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const themeOptions = [
  'light',
  'dark',
  'blue',
  'green',
  'pink',
  'roslib-dark',
  'roslib-light',
] as const

const accentOptions = [
  'accent-roslib',
  'accent-tech',
  'accent-sunset',
  'accent-corporate',
  'accent-natural',
] as const

const appearanceFormSchema = z.object({
  theme: z.enum(themeOptions),
  font: z.enum(fonts),
  accent: z.enum(accentOptions),
})

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>

const accentPreviews: Record<
  (typeof accentOptions)[number],
  { label: string; colors: [string, string, string] }
> = {
  'accent-roslib': {
    label: 'Roslib',
    colors: ['#22D3EE', '#8B5CF6', '#A3E635'],
  },
  'accent-tech': {
    label: 'Tech',
    colors: ['#3B82F6', '#06B6D4', '#10B981'],
  },
  'accent-sunset': {
    label: 'Sunset',
    colors: ['#F97316', '#FACC15', '#EF4444'],
  },
  'accent-corporate': {
    label: 'Corporate',
    colors: ['#1E40AF', '#0EA5E9', '#64748B'],
  },
  'accent-natural': {
    label: 'Natural',
    colors: ['#84CC16', '#14B8A6', '#E7E5E4'],
  },
}

const themePreviews: Record<
  (typeof themeOptions)[number],
  { label: string; bg: string; card: string; bar: string; sidebar: string }
> = {
  light: {
    label: 'Light',
    bg: '#ecedef',
    card: '#ffffff',
    bar: '#ecedef',
    sidebar: '#ffffff',
  },
  dark: {
    label: 'Dark',
    bg: '#020617',
    card: '#1e293b',
    bar: '#475569',
    sidebar: '#0f172a',
  },
  blue: {
    label: 'Ocean Blue',
    bg: '#e0f2fe',
    card: '#ffffff',
    bar: '#bae6fd',
    sidebar: '#0369a1',
  },
  green: {
    label: 'Forest Green',
    bg: '#d1fae5',
    card: '#ffffff',
    bar: '#a7f3d0',
    sidebar: '#065f46',
  },
  pink: {
    label: 'Rose Pink',
    bg: '#fce7f3',
    card: '#ffffff',
    bar: '#fbcfe8',
    sidebar: '#9d174d',
  },
  'roslib-dark': {
    label: 'Roslib Dark',
    bg: '#0B1220',
    card: '#131D36',
    bar: '#22D3EE',
    sidebar: '#0E162A',
  },
  'roslib-light': {
    label: 'Roslib Light',
    bg: '#F4F6FB',
    card: '#FFFFFF',
    bar: '#8B5CF6',
    sidebar: '#FFFFFF',
  },
}

function ThemePreview({ themeKey }: { themeKey: (typeof themeOptions)[number] }) {
  const p = themePreviews[themeKey]
  return (
    <div className='space-y-2 rounded-sm p-2' style={{ background: p.bg }}>
      <div
        className='space-y-2 rounded-md p-2 shadow-xs'
        style={{ background: p.card }}
      >
        <div
          className='h-2 w-20 rounded-lg'
          style={{ background: p.bar }}
        />
        <div
          className='h-2 w-25 rounded-lg'
          style={{ background: p.bar }}
        />
      </div>
      <div
        className='flex items-center space-x-2 rounded-md p-2 shadow-xs'
        style={{ background: p.card }}
      >
        <div
          className='h-4 w-4 rounded-full'
          style={{ background: p.sidebar }}
        />
        <div
          className='h-2 w-25 rounded-lg'
          style={{ background: p.bar }}
        />
      </div>
      <div
        className='flex items-center space-x-2 rounded-md p-2 shadow-xs'
        style={{ background: p.card }}
      >
        <div
          className='h-4 w-4 rounded-full'
          style={{ background: p.sidebar }}
        />
        <div
          className='h-2 w-25 rounded-lg'
          style={{ background: p.bar }}
        />
      </div>
    </div>
  )
}

export function AppearanceForm() {
  const { font, setFont } = useFont()
  const { theme, setTheme, accent, setAccent } = useTheme()

  const defaultValues: Partial<AppearanceFormValues> = {
    theme: theme === 'system' ? 'light' : (theme as (typeof themeOptions)[number]),
    font,
    accent,
  }

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues,
  })

  function onSubmit(data: AppearanceFormValues) {
    if (data.font != font) setFont(data.font)
    if (data.theme != theme) setTheme(data.theme)
    if (data.accent != accent) setAccent(data.accent)

    showSubmittedData(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='font'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Font</FormLabel>
              <div className='relative w-max'>
                <FormControl>
                  <select
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'w-50 appearance-none font-normal capitalize',
                      'dark:bg-background dark:hover:bg-background'
                    )}
                    {...field}
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <ChevronDownIcon className='absolute inset-e-3 top-2.5 h-4 w-4 opacity-50' />
              </div>
              <FormDescription className='font-manrope'>
                Set the font you want to use in the dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='theme'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme</FormLabel>
              <FormDescription>
                Select the theme for the dashboard.
              </FormDescription>
              <FormMessage />
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className='grid max-w-2xl grid-cols-3 gap-4 pt-2 sm:grid-cols-4 md:grid-cols-5'
              >
                {themeOptions.map((key) => (
                  <FormItem key={key}>
                    <FormLabel className='[&:has([data-state=checked])>div]:border-primary'>
                      <FormControl>
                        <RadioGroupItem value={key} className='sr-only' />
                      </FormControl>
                      <div className='items-center rounded-md border-2 border-muted p-1 hover:border-accent'>
                        <ThemePreview themeKey={key} />
                      </div>
                      <span className='block w-full p-2 text-center text-xs font-normal'>
                        {themePreviews[key].label}
                      </span>
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='accent'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Accent palette</FormLabel>
              <FormDescription>
                Pick a brand color trio (applies to Roslib themes).
              </FormDescription>
              <FormMessage />
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className='grid max-w-2xl grid-cols-3 gap-3 pt-2 sm:grid-cols-5'
              >
                {accentOptions.map((key) => {
                  const { label, colors } = accentPreviews[key]
                  const [hero, secondary, tertiary] = colors
                  return (
                    <FormItem key={key}>
                      <FormLabel className='[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:ring-2 [&:has([data-state=checked])>div]:ring-primary'>
                        <FormControl>
                          <RadioGroupItem value={key} className='sr-only' />
                        </FormControl>
                        <div
                          className='relative h-12 overflow-hidden rounded-md border-2 border-muted transition-colors hover:border-accent'
                          style={{ background: hero }}
                          aria-label={colors.join(', ')}
                          title={colors.join(' · ')}
                        >
                          <div className='absolute inset-y-0 right-0 flex w-1/3 flex-col border-l border-black/10'>
                            <span
                              className='flex-1 border-b border-black/10'
                              style={{ background: secondary }}
                            />
                            <span
                              className='flex-1'
                              style={{ background: tertiary }}
                            />
                          </div>
                        </div>
                        <span className='block w-full p-2 text-center text-xs font-normal'>
                          {label}
                        </span>
                      </FormLabel>
                    </FormItem>
                  )
                })}
              </RadioGroup>
            </FormItem>
          )}
        />

        <Button type='submit'>Update preferences</Button>
      </form>
    </Form>
  )
}
