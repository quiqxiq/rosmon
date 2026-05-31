import { Link } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  LogIn,
  MapPin,
  Shield,
  Users,
  Wifi,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDR } from '@/lib/format'
import { usePublicPackages } from '../public-register/api/queries'
import { RegisterForm } from '../public-register'

// ─── Packages Section ────────────────────────────────────────────────────────

function PackagesSection() {
  const { data: packages = [], isLoading } = usePublicPackages()

  return (
    <section id='paket' className='bg-muted/30 py-12'>
      <div className='mx-auto max-w-5xl px-4'>
        <div className='mb-8 text-center'>
          <h2 className='text-2xl font-bold sm:text-3xl'>Pilihan Paket Internet</h2>
          <p className='mt-2 text-muted-foreground'>
            Pilih paket yang sesuai kebutuhan Anda
          </p>
        </div>

        {isLoading ? (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-48 w-full rounded-xl' />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <p className='text-center text-muted-foreground'>
            Paket sedang tidak tersedia. Hubungi kami untuk informasi lebih lanjut.
          </p>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {packages.map((pkg, i) => (
              <Card
                key={pkg.id}
                className={`relative transition-shadow hover:shadow-md ${
                  i === 1 ? 'border-primary shadow-sm' : ''
                }`}
              >
                {i === 1 && (
                  <Badge className='absolute -top-3 left-1/2 -translate-x-1/2'>
                    Populer
                  </Badge>
                )}
                <CardHeader className='pb-2 pt-5'>
                  <p className='text-3xl font-bold text-primary'>
                    {pkg.rate_limit || '—'}
                  </p>
                  <p className='font-semibold'>{pkg.name}</p>
                </CardHeader>
                <CardContent>
                  <p className='text-2xl font-bold tabular-nums'>
                    {formatIDR(pkg.price)}
                    <span className='text-base font-normal text-muted-foreground'>
                      /bln
                    </span>
                  </p>
                  {pkg.description && (
                    <p className='mt-2 text-sm text-muted-foreground'>
                      {pkg.description}
                    </p>
                  )}
                  <Separator className='my-3' />
                  <ul className='space-y-1 text-sm'>
                    <li className='flex items-center gap-2'>
                      <span className='text-green-500'>✓</span>
                      {pkg.service_type === 'pppoe' ? 'PPPoE' : 'Hotspot'}
                    </li>
                    <li className='flex items-center gap-2'>
                      <span className='text-green-500'>✓</span>
                      Tanpa batas waktu
                    </li>
                    <li className='flex items-center gap-2'>
                      <span className='text-green-500'>✓</span>
                      Dukungan teknis
                    </li>
                  </ul>
                  <Button asChild className='mt-4 w-full' variant={i === 1 ? 'default' : 'outline'} size='sm'>
                    <a href='#daftar'>Daftar Sekarang</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Features Section ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    title: 'Internet Cepat',
    desc: 'Koneksi stabil dengan kecepatan sesuai paket yang dipilih tanpa throttling.',
  },
  {
    icon: Shield,
    title: 'Jaringan Aman',
    desc: 'Infrastruktur MikroTik dengan firewall terintegrasi untuk keamanan data Anda.',
  },
  {
    icon: Clock,
    title: 'Support Cepat',
    desc: 'Tim teknis siap membantu permasalahan koneksi Anda dengan cepat dan tanggap.',
  },
  {
    icon: CreditCard,
    title: 'Pembayaran Mudah',
    desc: 'Tagihan otomatis setiap bulan dengan kode bayar unik — cukup tunjukkan ke petugas.',
  },
]

function FeaturesSection() {
  return (
    <section id='fitur' className='py-12'>
      <div className='mx-auto max-w-5xl px-4'>
        <div className='mb-8 text-center'>
          <h2 className='text-2xl font-bold sm:text-3xl'>Mengapa Memilih Kami?</h2>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title}>
              <CardContent className='flex gap-4 p-5'>
                <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10'>
                  <Icon className='size-5 text-primary' />
                </div>
                <div>
                  <p className='font-semibold'>{title}</p>
                  <p className='mt-1 text-sm text-muted-foreground'>{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Bagaimana cara mendaftar layanan internet?',
    a: 'Isi formulir pendaftaran di halaman ini. Tim kami akan menghubungi Anda untuk konfirmasi dan jadwal pemasangan.',
  },
  {
    q: 'Berapa lama proses pemasangan setelah pendaftaran?',
    a: 'Proses pemasangan biasanya 1-3 hari kerja setelah pendaftaran disetujui, tergantung ketersediaan teknisi dan area Anda.',
  },
  {
    q: 'Bagaimana cara membayar tagihan bulanan?',
    a: 'Tagihan dihasilkan otomatis setiap bulan. Setiap tagihan memiliki kode unik yang bisa ditunjukkan ke petugas saat membayar tunai — pembayaran langsung tercatat otomatis.',
  },
  {
    q: 'Apa yang terjadi jika tagihan terlambat dibayar?',
    a: 'Layanan akan diisolir setelah melewati tanggal jatuh tempo. Segera lunasi tagihan dan layanan akan dipulihkan secara otomatis.',
  },
  {
    q: 'Bagaimana cara mengakses portal pelanggan?',
    a: 'Setelah pemasangan selesai, admin akan memberikan akses ke portal pelanggan di /portal/login. Gunakan nomor HP dan password yang diberikan admin.',
  },
]

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  return (
    <section id='faq' className='bg-muted/30 py-12'>
      <div className='mx-auto max-w-2xl px-4'>
        <div className='mb-8 text-center'>
          <h2 className='text-2xl font-bold sm:text-3xl'>Pertanyaan Umum</h2>
        </div>
        <div className='space-y-2'>
          {FAQS.map((faq, i) => (
            <div key={i} className='rounded-xl border bg-card'>
              <button
                className='flex w-full items-center justify-between gap-4 px-4 py-4 text-left font-medium'
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    openIdx === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIdx === i && (
                <div className='border-t px-4 pb-4 pt-3 text-sm text-muted-foreground'>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Navbar */}
      <nav className='sticky top-0 z-50 border-b bg-background/95 backdrop-blur'>
        <div className='mx-auto flex h-14 max-w-5xl items-center justify-between px-4'>
          <div className='flex items-center gap-2'>
            <Wifi className='size-5 text-primary' />
            <span className='font-bold'>Rosmon</span>
          </div>
          <div className='hidden items-center gap-6 text-sm sm:flex'>
            <a href='#paket' className='text-muted-foreground hover:text-foreground'>
              Paket
            </a>
            <a href='#fitur' className='text-muted-foreground hover:text-foreground'>
              Keunggulan
            </a>
            <a href='#daftar' className='text-muted-foreground hover:text-foreground'>
              Daftar
            </a>
            <a href='#faq' className='text-muted-foreground hover:text-foreground'>
              FAQ
            </a>
          </div>
          <Button asChild variant='outline' size='sm'>
            <Link to='/portal/login'>
              <LogIn className='size-4' /> Login Pelanggan
            </Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className='py-16 sm:py-24'>
        <div className='mx-auto max-w-3xl px-4 text-center'>
          <Badge variant='outline' className='mb-4'>
            Internet cepat untuk rumah &amp; UMKM
          </Badge>
          <h1 className='text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl'>
            Internet Stabil,{' '}
            <span className='text-primary'>Harga Bersahabat</span>
          </h1>
          <p className='mt-4 text-lg text-muted-foreground'>
            Layanan internet RT/RW Net berbasis MikroTik dengan tagihan otomatis
            dan portal pelanggan yang mudah digunakan.
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button asChild size='lg'>
              <a href='#daftar'>
                Daftar Sekarang <ChevronRight className='size-4' />
              </a>
            </Button>
            <Button asChild variant='outline' size='lg'>
              <a href='#paket'>Lihat Paket</a>
            </Button>
          </div>

          {/* Stats */}
          <div className='mt-12 grid grid-cols-3 gap-4 sm:gap-8'>
            {[
              { icon: Users, value: '500+', label: 'Pelanggan' },
              { icon: Wifi, value: '99.5%', label: 'Uptime' },
              { icon: MapPin, value: '4+', label: 'Area' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className='flex flex-col items-center gap-1'>
                <Icon className='size-5 text-primary' />
                <p className='text-xl font-bold sm:text-2xl'>{value}</p>
                <p className='text-xs text-muted-foreground sm:text-sm'>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PackagesSection />
      <FeaturesSection />

      {/* Registration Section */}
      <section id='daftar' className='py-12'>
        <div className='mx-auto max-w-lg px-4'>
          <div className='mb-8 text-center'>
            <h2 className='text-2xl font-bold sm:text-3xl'>Daftar Sekarang</h2>
            <p className='mt-2 text-muted-foreground'>
              Isi formulir di bawah dan kami akan segera menghubungi Anda
            </p>
          </div>
          <div className='rounded-xl border bg-card p-5 shadow-sm sm:p-6'>
            <RegisterForm />
          </div>
        </div>
      </section>

      <FAQSection />

      {/* Footer */}
      <footer className='border-t py-8'>
        <div className='mx-auto max-w-5xl px-4 text-center'>
          <div className='flex items-center justify-center gap-2'>
            <Wifi className='size-4 text-primary' />
            <span className='font-semibold'>Rosmon</span>
          </div>
          <p className='mt-2 text-sm text-muted-foreground'>
            Layanan internet RT/RW Net terpercaya
          </p>
          <div className='mt-4 flex justify-center gap-4 text-sm text-muted-foreground'>
            <Link to='/portal/login'>Portal Pelanggan</Link>
            <span>·</span>
            <Link to='/sign-in'>Login Admin</Link>
            <span>·</span>
            <Link to='/register'>Form Pendaftaran</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
