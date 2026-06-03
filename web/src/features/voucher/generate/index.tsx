import { useState } from 'react'
import { ServerOff } from 'lucide-react'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Main } from '@/components/layout/main'
import { VoucherGenerateFormPanel } from './components/voucher-generate-form'
import { VoucherResultTable } from './components/voucher-result-table'
import type { GeneratedVoucher } from './data/schema'

export function VoucherGenerate() {
  const routerId = useActiveRouterId()

  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([])
  const [resultProfile, setResultProfile] = useState<string>('')
  const [resultServer, setResultServer] = useState<string>('')

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
          onSuccess={(vs, profile, server) => {
            setVouchers(vs)
            setResultProfile(profile)
            setResultServer(server)
          }}
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
