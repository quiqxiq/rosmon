import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatIDR } from '@/lib/format'
import { parseAPIError } from '@/lib/api/errors'
import { usePublicPackages, useSubmitRegistration } from './api/queries'
import { type PublicPackage, type ServiceType } from './api/schema'

export function PublicRegister() {
  const packagesQuery = usePublicPackages()
  const submitMut = useSubmitRegistration()

  const packages = packagesQuery.data ?? []
  const hasPppoe = packages.some((p) => p.service_type === 'pppoe')
  const hasHotspot = packages.some((p) => p.service_type === 'hotspot')

  const [service, setService] = useState<ServiceType>('pppoe')
  const [packageId, setPackageId] = useState<number | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [notes, setNotes] = useState('')
  const [doneId, setDoneId] = useState<number | null>(null)

  const visible = useMemo(
    () =>
      (packagesQuery.data ?? []).filter((p) => p.service_type === service),
    [packagesQuery.data, service],
  )

  const selectService = (s: ServiceType) => {
    setService(s)
    setPackageId(null)
  }

  const selectedPkg = packages.find((p) => p.id === packageId) ?? null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      toast.error('Nama, nomor HP, dan alamat wajib diisi')
      return
    }
    if (!selectedPkg) {
      toast.error('Silakan pilih paket terlebih dahulu')
      return
    }
    submitMut.mutate(
      {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        area: area.trim() || undefined,
        notes: notes.trim() || undefined,
        service_type: service,
        device_id: selectedPkg.device_id,
        ...(service === 'pppoe'
          ? { ppp_profile_id: selectedPkg.id }
          : { hotspot_profile_id: selectedPkg.id }),
      },
      {
        onSuccess: (res) => setDoneId(res.id),
        onError: (err) =>
          toast.error('Gagal mengirim pendaftaran', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <div className='flex min-h-svh flex-col items-center bg-muted/40 px-4 py-10'>
      <div className='w-full max-w-2xl'>
        <header className='mb-6 text-center'>
          <div className='mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
            <Wifi className='size-6' />
          </div>
          <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
            Daftar Pemasangan Internet
          </h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Isi formulir di bawah. Tim kami akan menghubungi Anda untuk
            penjadwalan pemasangan.
          </p>
        </header>

        <div className='rounded-xl border bg-card p-5 shadow-sm sm:p-6'>
          {doneId !== null ? (
            <SuccessPanel id={doneId} />
          ) : packagesQuery.isLoading ? (
            <div className='flex justify-center py-10'>
              <Loader2 className='size-6 animate-spin text-muted-foreground' />
            </div>
          ) : packages.length === 0 ? (
            <p className='py-10 text-center text-sm text-muted-foreground'>
              Belum ada paket yang tersedia. Silakan hubungi kami langsung.
            </p>
          ) : (
            <form onSubmit={submit} className='flex flex-col gap-5'>
              {/* Service type */}
              {hasPppoe && hasHotspot && (
                <div className='flex flex-col gap-1.5'>
                  <Label className='text-sm font-medium'>Jenis layanan</Label>
                  <div className='grid grid-cols-2 gap-2'>
                    <ServiceButton
                      active={service === 'pppoe'}
                      onClick={() => selectService('pppoe')}
                      label='PPPoE'
                      desc='Internet rumahan'
                    />
                    <ServiceButton
                      active={service === 'hotspot'}
                      onClick={() => selectService('hotspot')}
                      label='Hotspot'
                      desc='Voucher / berbagi'
                    />
                  </div>
                </div>
              )}

              {/* Packages */}
              <div className='flex flex-col gap-1.5'>
                <Label className='text-sm font-medium'>Pilih paket</Label>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {visible.map((p) => (
                    <PackageCard
                      key={p.id}
                      pkg={p}
                      selected={packageId === p.id}
                      onSelect={() => setPackageId(p.id)}
                    />
                  ))}
                  {visible.length === 0 && (
                    <p className='text-sm text-muted-foreground'>
                      Tidak ada paket untuk layanan ini.
                    </p>
                  )}
                </div>
              </div>

              {/* Contact details */}
              <div className='grid gap-4 sm:grid-cols-2'>
                <LField label='Nama lengkap *'>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder='Budi Santoso'
                  />
                </LField>
                <LField label='Nomor HP / WhatsApp *'>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder='08123456789'
                  />
                </LField>
              </div>
              <LField label='Alamat pemasangan *'>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder='Jl. Mawar No. 1, RT01/RW02'
                />
              </LField>
              <div className='grid gap-4 sm:grid-cols-2'>
                <LField label='Area / Blok (opsional)'>
                  <Input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder='Blok A'
                  />
                </LField>
                <LField label='Catatan (opsional)'>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder='Patokan rumah, dll.'
                  />
                </LField>
              </div>

              <Button
                type='submit'
                className='gap-1.5'
                disabled={submitMut.isPending}
              >
                {submitMut.isPending && (
                  <Loader2 className='size-4 animate-spin' />
                )}
                Kirim Pendaftaran
              </Button>
            </form>
          )}
        </div>

        <p className='mt-4 text-center text-xs text-muted-foreground'>
          Sudah jadi pelanggan? Hubungi admin untuk bantuan.
        </p>
      </div>
    </div>
  )
}

function ServiceButton({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean
  onClick: () => void
  label: string
  desc: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:bg-accent',
      )}
    >
      <div className='text-sm font-semibold'>{label}</div>
      <div className='text-xs text-muted-foreground'>{desc}</div>
    </button>
  )
}

function PackageCard({
  pkg,
  selected,
  onSelect,
}: {
  pkg: PublicPackage
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:bg-accent',
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='text-sm font-semibold'>{pkg.name}</span>
        {selected && <CheckCircle2 className='size-4 text-primary' />}
      </div>
      <span className='text-sm font-bold text-primary'>
        {formatIDR(pkg.price)}
        <span className='text-xs font-normal text-muted-foreground'>/bln</span>
      </span>
      {pkg.rate_limit && (
        <span className='text-xs text-muted-foreground'>{pkg.rate_limit}</span>
      )}
      {pkg.description && (
        <span className='line-clamp-2 text-xs text-muted-foreground'>
          {pkg.description}
        </span>
      )}
    </button>
  )
}

function SuccessPanel({ id }: { id: number }) {
  return (
    <div className='flex flex-col items-center gap-3 py-8 text-center'>
      <CheckCircle2 className='size-12 text-emerald-500' />
      <h2 className='text-lg font-semibold'>Pendaftaran diterima!</h2>
      <p className='max-w-sm text-sm text-muted-foreground'>
        Terima kasih. Pengajuan Anda (No. #{id}) sedang ditinjau admin. Kami
        akan menghubungi Anda via WhatsApp untuk penjadwalan pemasangan.
      </p>
    </div>
  )
}

function LField({
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
