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

// ─── Core form — embeddable, no wrapper/bg ────────────────────────────────────

export function RegisterForm({ onSuccess }: { onSuccess?: (id: number) => void }) {
  const packagesQuery = usePublicPackages()
  const submitMut = useSubmitRegistration()

  const packages = packagesQuery.data ?? []

  // Hanya paket PPPoE yang relevan di form ini — Hotspot tidak butuh paket
  const pppoePackages = useMemo(
    () => packages.filter((p) => p.service_type === 'pppoe'),
    [packages],
  )

  const [service, setService] = useState<ServiceType>('pppoe')
  const [packageId, setPackageId] = useState<number | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [notes, setNotes] = useState('')
  const [doneId, setDoneId] = useState<number | null>(null)

  const selectedPkg = packages.find((p) => p.id === packageId) ?? null

  const selectService = (s: ServiceType) => {
    setService(s)
    setPackageId(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      toast.error('Nama, nomor HP, dan alamat wajib diisi')
      return
    }
    // PPPoE: wajib pilih paket jika ada; Hotspot: tidak perlu paket
    if (service === 'pppoe' && pppoePackages.length > 0 && !selectedPkg) {
      toast.error('Silakan pilih paket PPPoE terlebih dahulu')
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
        ...(service === 'pppoe' && selectedPkg
          ? { ppp_profile_id: selectedPkg.id, device_id: selectedPkg.device_id }
          : {}),
      },
      {
        onSuccess: (res) => {
          setDoneId(res.id)
          onSuccess?.(res.id)
        },
        onError: (err) =>
          toast.error('Gagal mengirim pendaftaran', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  if (doneId !== null) {
    return <SuccessPanel id={doneId} />
  }

  return (
    <form onSubmit={submit} className='flex flex-col gap-5'>
      {/* Service type — selalu tampil */}
      <div className='flex flex-col gap-1.5'>
        <Label className='text-sm font-medium'>Jenis layanan</Label>
        <div className='grid grid-cols-2 gap-2'>
          <ServiceButton
            active={service === 'pppoe'}
            onClick={() => selectService('pppoe')}
            label='PPPoE'
            desc='Internet rumahan dengan paket bulanan'
          />
          <ServiceButton
            active={service === 'hotspot'}
            onClick={() => selectService('hotspot')}
            label='Hotspot'
            desc='Pemasangan akses point / RT-RW'
          />
        </div>
      </div>

      {/* Pilih paket — hanya untuk PPPoE */}
      {service === 'pppoe' && (
        <div className='flex flex-col gap-1.5'>
          <Label className='text-sm font-medium'>
            Pilih paket{pppoePackages.length > 0 && <span className='text-destructive'> *</span>}
          </Label>
          {packagesQuery.isLoading ? (
            <div className='flex items-center gap-2 py-2 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Memuat paket…
            </div>
          ) : pppoePackages.length === 0 ? (
            <p className='rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground'>
              Paket PPPoE belum tersedia saat ini. Admin akan menghubungi Anda untuk
              menentukan paket setelah pendaftaran.
            </p>
          ) : (
            <div className='grid gap-2 sm:grid-cols-2'>
              {pppoePackages.map((p) => (
                <PackageCard
                  key={p.id}
                  pkg={p}
                  selected={packageId === p.id}
                  onSelect={() => setPackageId(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Hotspot */}
      {service === 'hotspot' && (
        <div className='rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
          Pendaftaran pemasangan Hotspot tidak memerlukan pilihan paket. Isi data
          kontak di bawah — admin akan menghubungi Anda untuk konfirmasi lokasi
          dan konfigurasi.
        </div>
      )}

      {/* Data kontak */}
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
            type='tel'
          />
        </LField>
      </div>
      <LField label='Alamat pemasangan *'>
        <Textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className='resize-none'
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

      <Button type='submit' className='gap-1.5' disabled={submitMut.isPending}>
        {submitMut.isPending && <Loader2 className='size-4 animate-spin' />}
        Kirim Pendaftaran
      </Button>
    </form>
  )
}

// ─── Standalone full-page wrapper — dipakai oleh /register route ──────────────

export function PublicRegister() {
  const [doneId, setDoneId] = useState<number | null>(null)
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
          ) : (
            <RegisterForm onSuccess={setDoneId} />
          )}
        </div>

        <p className='mt-4 text-center text-xs text-muted-foreground'>
          Sudah jadi pelanggan? Hubungi admin untuk bantuan.
        </p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
