import { useState } from 'react'
import { ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useGenerateVoucher } from '@/features/voucher/generate/api/queries'
import { type VoucherGenerateParams } from '@/features/voucher/generate/api/schema'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Main } from '@/components/layout/main'
import { VoucherGenerateFormPanel } from './components/voucher-generate-form'
import { VoucherResultTable } from './components/voucher-result-table'
import { dataLimitToBytes, defaultGenerateForm } from './data/data'
import {
  type GeneratedVoucher,
  type VoucherGenerateForm,
} from './data/schema'

// Map the camelCase UI form to the snake_case backend params. Stays inline
// here (not in api/) because the form's `dataLimit + dataLimitUnit` split
// is purely a UI concern — backend only knows total bytes.
function formToBackendParams(form: VoucherGenerateForm): VoucherGenerateParams {
  return {
    qty: form.qty,
    server: form.server === 'all' ? undefined : form.server,
    user_type: form.userType,
    name_length: form.nameLength,
    prefix: form.prefix || undefined,
    char_set: form.charSet,
    profile: form.profile,
    time_limit: form.timeLimit || undefined,
    data_limit: dataLimitToBytes(form.dataLimit, form.dataLimitUnit),
    comment: form.comment || undefined,
  }
}

export function VoucherGenerate() {
  const routerId = useActiveRouterId()
  const generateMutation = useGenerateVoucher(routerId ?? 0)

  const [form, setForm] = useState<VoucherGenerateForm>(defaultGenerateForm)
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([])
  const [resultProfile, setResultProfile] = useState<string>('')
  const [resultServer, setResultServer] = useState<string>('')

  const handleGenerate = () => {
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }
    if (!form.profile) {
      toast.error('Profile is required')
      return
    }
    generateMutation.mutate(formToBackendParams(form), {
      onSuccess: (data) => {
        // Backend returns `{ username, password }`. The result table needs
        // `id`, `profile`, `comment` for display — synthesize from context.
        const enriched: GeneratedVoucher[] = data.vouchers.map((v, i) => ({
          id: `${data.gencode}-${i + 1}`,
          username: v.username,
          password: v.password,
          profile: data.profile,
          comment: form.comment || '',
        }))
        setVouchers(enriched)
        setResultProfile(data.profile)
        setResultServer(form.server)
        toast.success(
          `Generated ${data.count} voucher${data.count > 1 ? 's' : ''}`,
          {
            description: `Profile: ${data.profile} · Gencode: ${data.gencode}`,
          },
        )
      },
      onError: (err) => {
        toast.error('Failed to generate vouchers', {
          description: err.message,
        })
      },
    })
  }

  const handleReset = () => {
    setForm(defaultGenerateForm)
    setVouchers([])
    setResultProfile('')
    setResultServer('')
  }

  // No-router-selected state — covers both "user just landed" and
  // "selected router got deleted by an admin while this tab was open".
  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to start generating
          vouchers. Each voucher is created on the active router only.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Generate Vouchers
        </h2>
        <p className='text-sm text-muted-foreground sm:text-base'>
          Create batches of hotspot voucher users
        </p>
      </div>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]'>
        <VoucherGenerateFormPanel
          form={form}
          onChange={setForm}
          onGenerate={handleGenerate}
          onReset={handleReset}
          isGenerating={generateMutation.isPending}
        />
        <VoucherResultTable
          vouchers={vouchers}
          profile={resultProfile}
          server={resultServer}
        />
      </div>
    </Main>
  )
}
