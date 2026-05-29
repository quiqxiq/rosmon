import { Copy, Printer, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useHotspotProfiles } from '@/features/hotspot/profiles/api/queries'
import {
  parseRouterOSNumber,
} from '@/features/hotspot/_shared/format'
import {
  usePrintStore,
  type PrintTemplate,
} from '@/features/voucher/print-render/store/print-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { vouchersToCsv } from '../data/data'
import { type GeneratedVoucher } from '../data/schema'

type VoucherResultTableProps = {
  vouchers: GeneratedVoucher[]
  profile: string
  server?: string
}

export function VoucherResultTable({
  vouchers,
  profile,
  server,
}: VoucherResultTableProps) {
  const count = vouchers.length
  const openPrint = usePrintStore((s) => s.open)
  const routerId = useActiveRouterId() ?? 0
  // Profile pricing/validity is sourced from the live profiles list now
  // — when no router is selected this falls through to undefined and
  // the print metadata uses the same fallback as before.
  const profilesQuery = useHotspotProfiles(routerId)
  const profileItem = profilesQuery.data?.find((p) => p.name === profile)

  const handleCopyAll = () => {
    const csv = vouchersToCsv(vouchers)
    navigator.clipboard.writeText(csv)
    toast.success(`Copied ${count} vouchers to clipboard`)
  }

  const handlePrint = (template: PrintTemplate) => {
    if (vouchers.length === 0) return
    openPrint({
      template,
      vouchers,
      meta: {
        profile,
        server: server ?? 'all',
        validity: profileItem?.validity ?? '—',
        sellingPrice: parseRouterOSNumber(profileItem?.selling_price),
      },
    })
  }

  if (count === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Generated Vouchers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex h-48 items-center justify-center rounded-md border border-dashed'>
            <p className='text-sm text-muted-foreground'>
              Configure the form and click Generate to preview vouchers.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-3 space-y-0'>
        <div>
          <CardTitle className='text-base'>
            Generated · {count} voucher{count > 1 ? 's' : ''}
          </CardTitle>
          <p className='text-xs text-muted-foreground'>Profile: {profile}</p>
        </div>
        <div className='flex flex-wrap items-center gap-1.5'>
          <Button
            size='sm'
            variant='outline'
            className='gap-1.5'
            onClick={handleCopyAll}
          >
            <Copy className='size-4' />
            Copy CSV
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='gap-1.5'
            onClick={() => handlePrint('default')}
          >
            <Printer className='size-4' />
            Default
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='gap-1.5'
            onClick={() => handlePrint('qr')}
          >
            <QrCode className='size-4' />
            QR
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='gap-1.5'
            onClick={() => handlePrint('small')}
          >
            <Printer className='size-4' />
            Small
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className='max-h-[60vh] overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12 text-center'>#</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v, i) => (
                <TableRow key={v.id}>
                  <TableCell className='text-center text-xs text-muted-foreground tabular-nums'>
                    {i + 1}
                  </TableCell>
                  <TableCell className='font-mono text-sm font-semibold'>
                    {v.username}
                  </TableCell>
                  <TableCell className='font-mono text-sm'>
                    {v.password}
                  </TableCell>
                  <TableCell className='text-sm'>{v.profile}</TableCell>
                  <TableCell className='text-xs text-muted-foreground'>
                    {v.comment}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
