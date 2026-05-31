import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Eye, EyeOff, Key, LogOut, Moon, Sun, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/context/theme-provider'
import { usePortalMe } from '../home/api/queries'
import { PortalHeader } from '../_shared/portal-header'
import { usePortalAuthStore } from '@/stores/portal-auth-store'
import { useChangePortalPassword } from './api/queries'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-0.5 py-2'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <span className='text-sm font-medium'>{value || '—'}</span>
    </div>
  )
}

export function PortalProfile() {
  const { theme, setTheme } = useTheme()
  const { reset } = usePortalAuthStore()
  const { data: me, isLoading } = usePortalMe()
  const changePwMutation = useChangePortalPassword()

  const [showPasswordSheet, setShowPasswordSheet] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwError, setPwError] = useState('')

  function handleLogout() {
    reset()
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 8) {
      setPwError('Password baru minimal 8 karakter.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Konfirmasi password tidak cocok.')
      return
    }
    changePwMutation.mutate(
      { old_password: oldPw, new_password: newPw },
      {
        onSuccess: () => {
          toast.success('Password berhasil diperbarui')
          setShowPasswordSheet(false)
          setOldPw('')
          setNewPw('')
          setConfirmPw('')
        },
        onError: () => {
          setPwError('Password lama salah atau terjadi kesalahan.')
        },
      },
    )
  }

  const initials = me?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div>
      <PortalHeader title='Akun' />

      <div className='space-y-4 p-4'>
        {/* Avatar + Name */}
        <div className='flex flex-col items-center gap-2 py-4'>
          <div className='flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground'>
            {initials}
          </div>
          {isLoading ? (
            <>
              <Skeleton className='h-5 w-36' />
              <Skeleton className='h-4 w-28' />
            </>
          ) : (
            <>
              <p className='text-lg font-semibold'>{me?.full_name}</p>
              <p className='text-sm text-muted-foreground'>{me?.phone}</p>
            </>
          )}
        </div>

        {/* Personal Data */}
        <div className='rounded-xl border bg-card'>
          <div className='flex items-center gap-2 border-b px-4 py-3'>
            <User className='size-4 text-muted-foreground' />
            <span className='text-sm font-semibold'>Data Pribadi</span>
          </div>
          {isLoading ? (
            <div className='space-y-2 p-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : (
            <div className='divide-y px-4'>
              <InfoRow label='Nama Lengkap' value={me?.full_name ?? ''} />
              <InfoRow label='Nomor HP' value={me?.phone ?? ''} />
              <InfoRow label='Alamat' value={me?.address ?? ''} />
              <InfoRow label='Area' value={me?.area ?? ''} />
            </div>
          )}
        </div>

        {/* Settings */}
        <div className='rounded-xl border bg-card divide-y overflow-hidden'>
          {/* Change Password */}
          <button
            className='flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent'
            onClick={() => setShowPasswordSheet(true)}
          >
            <Key className='size-4 text-muted-foreground' />
            <span className='flex-1 text-sm font-medium'>Ganti Password</span>
          </button>

          {/* Dark Mode Toggle */}
          <div className='flex items-center gap-3 px-4 py-3.5'>
            {theme === 'dark' ? (
              <Moon className='size-4 text-muted-foreground' />
            ) : (
              <Sun className='size-4 text-muted-foreground' />
            )}
            <span className='flex-1 text-sm font-medium'>Mode Gelap</span>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
            />
          </div>
        </div>

        <Separator />

        {/* Logout */}
        <Button asChild variant='destructive' className='w-full'>
          <Link to='/portal/login' onClick={handleLogout}>
            <LogOut className='size-4' />
            Keluar
          </Link>
        </Button>
      </div>

      {/* Change Password Sheet */}
      <Sheet open={showPasswordSheet} onOpenChange={setShowPasswordSheet}>
        <SheetContent side='bottom' className='rounded-t-2xl'>
          <SheetHeader className='mb-4'>
            <SheetTitle>Ganti Password</SheetTitle>
          </SheetHeader>
          <form onSubmit={handlePasswordSubmit} className='space-y-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='old-pw'>Password Lama</Label>
              <div className='relative'>
                <Input
                  id='old-pw'
                  type={showOld ? 'text' : 'password'}
                  placeholder='••••••••'
                  className='pr-10'
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  required
                />
                <button
                  type='button'
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                  onClick={() => setShowOld((v) => !v)}
                  tabIndex={-1}
                >
                  {showOld ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                </button>
              </div>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='new-pw'>Password Baru (min. 8 karakter)</Label>
              <div className='relative'>
                <Input
                  id='new-pw'
                  type={showNew ? 'text' : 'password'}
                  placeholder='••••••••'
                  className='pr-10'
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                />
                <button
                  type='button'
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                  onClick={() => setShowNew((v) => !v)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                </button>
              </div>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='confirm-pw'>Konfirmasi Password Baru</Label>
              <Input
                id='confirm-pw'
                type='password'
                placeholder='••••••••'
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </div>

            {pwError && (
              <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                {pwError}
              </p>
            )}

            <Button
              type='submit'
              className='w-full'
              disabled={changePwMutation.isPending}
            >
              {changePwMutation.isPending ? 'Menyimpan…' : 'Simpan Password'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
