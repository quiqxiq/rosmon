import { Loader2, Plus, RotateCcw } from 'lucide-react'
import { formatIDR } from '@/features/hotspot/profiles/data/data'
import { type HotspotProfile } from '@/features/hotspot/profiles/data/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  charSetOptions,
  dataLimitUnitOptions,
  nameLengthOptions,
  serverGenerateOptions,
  userTypeOptions,
} from '../data/data'
import {
  type CharSet,
  type DataLimitUnit,
  type UserType,
  type VoucherGenerateForm,
} from '../data/schema'

type VoucherGenerateFormProps = {
  form: VoucherGenerateForm
  onChange: (form: VoucherGenerateForm) => void
  onGenerate: () => void
  onReset: () => void
  isGenerating?: boolean
  /** Real profiles fetched from the active router */
  profiles?: HotspotProfile[]
  isLoadingProfiles?: boolean
}

export function VoucherGenerateFormPanel({
  form,
  onChange,
  onGenerate,
  onReset,
  isGenerating = false,
  profiles = [],
  isLoadingProfiles = false,
}: VoucherGenerateFormProps) {
  const update = <K extends keyof VoucherGenerateForm>(
    key: K,
    value: VoucherGenerateForm[K]
  ) => {
    onChange({ ...form, [key]: value })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onGenerate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Generate Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <form className='flex flex-col gap-4' onSubmit={handleSubmit}>
          <div className='grid grid-cols-2 gap-3'>
            <Field label='Quantity'>
              <Input
                type='number'
                min={1}
                max={500}
                value={form.qty}
                onChange={(e) =>
                  update('qty', Math.max(1, Math.min(500, +e.target.value || 1)))
                }
              />
            </Field>
            <Field label='Server'>
              <Select
                value={form.server}
                onValueChange={(v) => update('server', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serverGenerateOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label='Profile'>
            {isLoadingProfiles ? (
              <Skeleton className='h-9 w-full' />
            ) : (
              <Select
                value={form.profile}
                onValueChange={(v) => update('profile', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Pilih profile' />
                </SelectTrigger>
                <SelectContent>
                  {profiles.length === 0 ? (
                    <SelectItem value='__none' disabled>
                      Belum ada profile di router ini
                    </SelectItem>
                  ) : (
                    profiles.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        <span className='flex items-center justify-between gap-3 w-full'>
                          <span>{p.name}</span>
                          <span className='text-xs text-muted-foreground tabular-nums'>
                            {p.sellingPrice ? formatIDR(p.sellingPrice) : ''}
                            {p.validity ? ` · ${p.validity}` : ''}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label='User Mode'>
            <Select
              value={form.userType}
              onValueChange={(v) => update('userType', v as UserType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className='grid grid-cols-2 gap-3'>
            <Field label='Name Length'>
              <Select
                value={String(form.nameLength)}
                onValueChange={(v) => update('nameLength', +v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nameLengthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label='Char Set'>
              <Select
                value={form.charSet}
                onValueChange={(v) => update('charSet', v as CharSet)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {charSetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label='Prefix'>
            <Input
              value={form.prefix}
              placeholder='Optional, e.g. wifi-'
              onChange={(e) => update('prefix', e.target.value)}
            />
          </Field>

          <Field label='Time Limit'>
            <Input
              value={form.timeLimit}
              placeholder='e.g. 1h, 30m, or 0 for unlimited'
              onChange={(e) => update('timeLimit', e.target.value)}
            />
          </Field>

          <div className='grid grid-cols-[1fr_90px] gap-3'>
            <Field label='Data Limit'>
              <Input
                type='number'
                min={0}
                value={form.dataLimit}
                onChange={(e) =>
                  update('dataLimit', Math.max(0, +e.target.value || 0))
                }
              />
            </Field>
            <Field label='Unit'>
              <Select
                value={form.dataLimitUnit}
                onValueChange={(v) =>
                  update('dataLimitUnit', v as DataLimitUnit)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dataLimitUnitOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label='Comment'>
            <Input
              value={form.comment}
              placeholder='Optional batch comment'
              onChange={(e) => update('comment', e.target.value)}
            />
          </Field>

          <div className='flex flex-wrap gap-2 pt-2'>
            <Button
              type='submit'
              size='sm'
              className='gap-1.5'
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Plus className='size-4' />
              )}
              {isGenerating ? 'Generating…' : 'Generate'}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={onReset}
              disabled={isGenerating}
            >
              <RotateCcw className='size-4' />
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label className='text-xs font-medium text-muted-foreground'>
        {label}
      </Label>
      {children}
    </div>
  )
}
