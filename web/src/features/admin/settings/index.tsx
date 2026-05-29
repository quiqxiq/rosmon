import { useMemo, useRef, useState } from 'react'
import { ImageIcon, Loader2, Save, Upload } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import {
  useSettings,
  useUpdateSettings,
  useUploadLogo,
} from './api/queries'
import { getLogoUrl } from './api/service'
import type {
  ReportMode,
  Settings,
  UpdateSettingsRequest,
} from './api/schema'

// Logo files are validated server-side, but reject the obvious cases
// client-side too so the user gets immediate feedback.
const MAX_LOGO_BYTES = 1 * 1024 * 1024 // 1 MB — matches backend limit.
const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp']

type Draft = {
  hotspot_name: string
  dns_name: string
  currency: string
  phone: string
  email: string
  info_lp: string
  idle_timeout: number
  report_mode: ReportMode
  timezone: string
}

function settingsToDraft(s: Settings): Draft {
  return {
    hotspot_name: s.hotspot_name,
    dns_name: s.dns_name,
    currency: s.currency,
    phone: s.phone,
    email: s.email,
    info_lp: s.info_lp,
    idle_timeout: s.idle_timeout,
    report_mode: s.report_mode,
    timezone: s.timezone,
  }
}

// Build a PUT body that only includes fields the user actually changed.
// Backend treats omitted fields as "preserve", so this keeps the patch
// surface minimal and avoids race conditions with concurrent edits.
function diffDraft(
  original: Draft,
  next: Draft,
): UpdateSettingsRequest {
  const body: UpdateSettingsRequest = {}
  if (next.hotspot_name !== original.hotspot_name)
    body.hotspot_name = next.hotspot_name
  if (next.dns_name !== original.dns_name) body.dns_name = next.dns_name
  if (next.currency !== original.currency) body.currency = next.currency
  if (next.phone !== original.phone) body.phone = next.phone
  if (next.email !== original.email) body.email = next.email
  if (next.info_lp !== original.info_lp) body.info_lp = next.info_lp
  if (next.idle_timeout !== original.idle_timeout)
    body.idle_timeout = next.idle_timeout
  if (next.report_mode !== original.report_mode)
    body.report_mode = next.report_mode
  if (next.timezone !== original.timezone) body.timezone = next.timezone
  return body
}

export function AdminSettings() {
  const settingsQuery = useSettings()
  const updateMut = useUpdateSettings()
  const uploadMut = useUploadLogo()

  // Local draft is re-seeded every time the server data lands; this
  // lets the form stay in sync if another admin updates the same
  // settings row concurrently.
  const [draft, setDraft] = useState<Draft | null>(null)
  // Tracks which server snapshot the current draft was seeded from.
  // We compare against `settingsQuery.data.updated_at` (an ISO string
  // bumped by the backend on every write) so the draft is re-seeded
  // when the upstream row changes — without mirroring state in a
  // useEffect (which would trip react-hooks/set-state-in-effect).
  const [seededFrom, setSeededFrom] = useState<string | null>(null)
  // Cache-buster forces <img> to re-fetch the logo after a successful
  // upload without reloading the page.
  const [logoVersion, setLogoVersion] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // React 19-recommended pattern for "adjust state when an input
  // changes": detect the change during render and call setState; React
  // restarts the render before the user sees the stale UI.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (
    settingsQuery.data &&
    seededFrom !== settingsQuery.data.updated_at
  ) {
    setSeededFrom(settingsQuery.data.updated_at)
    setDraft(settingsToDraft(settingsQuery.data))
  }

  const original = useMemo<Draft | null>(
    () =>
      settingsQuery.data ? settingsToDraft(settingsQuery.data) : null,
    [settingsQuery.data],
  )

  const isDirty = useMemo(() => {
    if (!original || !draft) return false
    return Object.keys(diffDraft(original, draft)).length > 0
  }, [original, draft])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!original || !draft || !isDirty) return
    const body = diffDraft(original, draft)
    updateMut.mutate(body, {
      onSuccess: () => toast.success('Settings saved'),
      onError: (err) =>
        toast.error('Failed to save settings', {
          description: err.message,
        }),
    })
  }

  const handleReset = () => {
    if (original) setDraft(original)
  }

  const handleLogoPick = () => fileInputRef.current?.click()

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset input so picking the same file twice still triggers onChange.
    e.target.value = ''
    if (!file) return
    if (!LOGO_MIME.includes(file.type)) {
      toast.error('Unsupported format', {
        description: 'Logo must be PNG, JPEG, or WebP.',
      })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo too large', {
        description: 'Maximum file size is 1 MB.',
      })
      return
    }
    uploadMut.mutate(file, {
      onSuccess: () => {
        toast.success('Logo updated')
        setLogoVersion(String(Date.now()))
      },
      onError: (err) =>
        toast.error('Failed to upload logo', {
          description: err.message,
        }),
    })
  }

  const logoUrl = settingsQuery.data?.logo_path
    ? getLogoUrl(logoVersion ?? settingsQuery.data.updated_at)
    : null

  if (settingsQuery.isLoading || !draft) {
    return (
      <Main className='flex flex-1 items-center justify-center'>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          Loading settings…
        </div>
      </Main>
    )
  }

  if (settingsQuery.isError) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-2 text-center'>
        <p className='text-sm text-destructive'>
          Failed to load settings
          {settingsQuery.error?.message
            ? `: ${settingsQuery.error.message}`
            : '.'}
        </p>
        <Button
          size='sm'
          variant='outline'
          onClick={() => settingsQuery.refetch()}
        >
          Retry
        </Button>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Application Settings
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            Global configuration for this Roskit instance.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className='grid grid-cols-1 gap-4 lg:grid-cols-3'
      >
        {/* Branding column — name + logo. Logo upload is its own
            mutation, independent from the main settings PUT. */}
        <Card className='lg:col-span-1'>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              How this instance identifies itself.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='hotspot_name'>Hotspot name</Label>
              <Input
                id='hotspot_name'
                value={draft.hotspot_name}
                onChange={(e) =>
                  setDraft({ ...draft, hotspot_name: e.target.value })
                }
                disabled={updateMut.isPending}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='dns_name'>DNS / portal name</Label>
              <Input
                id='dns_name'
                value={draft.dns_name}
                onChange={(e) =>
                  setDraft({ ...draft, dns_name: e.target.value })
                }
                disabled={updateMut.isPending}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Logo</Label>
              <div className='flex items-center gap-3'>
                <div className='flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted'>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt='Hotspot logo'
                      className='size-full object-contain'
                    />
                  ) : (
                    <ImageIcon className='size-6 text-muted-foreground' />
                  )}
                </div>
                <div className='flex flex-1 flex-col gap-1.5'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={handleLogoPick}
                    disabled={uploadMut.isPending}
                    className='gap-1.5'
                  >
                    {uploadMut.isPending ? (
                      <Loader2 className='size-4 animate-spin' />
                    ) : (
                      <Upload className='size-4' />
                    )}
                    Upload logo
                  </Button>
                  <p className='text-[11px] text-muted-foreground'>
                    PNG, JPEG, or WebP. Max 1 MB.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept={LOGO_MIME.join(',')}
                  className='hidden'
                  onChange={handleLogoChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact + operational column. */}
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle>Contact & operations</CardTitle>
            <CardDescription>
              Customer-facing info and session behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label htmlFor='currency'>Currency</Label>
                <Input
                  id='currency'
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft({ ...draft, currency: e.target.value })
                  }
                  disabled={updateMut.isPending}
                  maxLength={10}
                  placeholder='Rp'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='timezone'>Timezone</Label>
                <Input
                  id='timezone'
                  value={draft.timezone}
                  onChange={(e) =>
                    setDraft({ ...draft, timezone: e.target.value })
                  }
                  disabled={updateMut.isPending}
                  maxLength={50}
                  placeholder='Asia/Jakarta'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='phone'>Phone</Label>
                <Input
                  id='phone'
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                  disabled={updateMut.isPending}
                  maxLength={20}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='email'>Email</Label>
                <Input
                  id='email'
                  type='email'
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                  disabled={updateMut.isPending}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='idle_timeout'>Idle timeout (sec)</Label>
                <Input
                  id='idle_timeout'
                  type='number'
                  min={0}
                  value={draft.idle_timeout}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      idle_timeout: Math.max(
                        0,
                        Number(e.target.value) || 0,
                      ),
                    })
                  }
                  disabled={updateMut.isPending}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='report_mode'>Report mode</Label>
                <Select
                  value={draft.report_mode}
                  onValueChange={(v) =>
                    setDraft({ ...draft, report_mode: v as ReportMode })
                  }
                  disabled={updateMut.isPending}
                >
                  <SelectTrigger id='report_mode'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='enable'>Enable</SelectItem>
                    <SelectItem value='disable'>Disable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='info_lp'>Login page info</Label>
              <Textarea
                id='info_lp'
                value={draft.info_lp}
                onChange={(e) =>
                  setDraft({ ...draft, info_lp: e.target.value })
                }
                disabled={updateMut.isPending}
                rows={3}
                placeholder='Shown on the hotspot login page (HTML allowed).'
              />
            </div>
          </CardContent>
        </Card>

        <div className='flex items-center justify-end gap-2 lg:col-span-3'>
          <Button
            type='button'
            variant='outline'
            onClick={handleReset}
            disabled={!isDirty || updateMut.isPending}
          >
            Reset
          </Button>
          <Button
            type='submit'
            disabled={!isDirty || updateMut.isPending}
            className='gap-1.5'
          >
            {updateMut.isPending ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Save className='size-4' />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </Main>
  )
}
