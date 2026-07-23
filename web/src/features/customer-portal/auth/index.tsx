import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2, LogIn, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortalAuthStore } from '@/stores/portal-auth-store'
import { useCustomerLogin } from './api/queries'

export function PortalLoginPage() {
  useEffect(() => {
    document.title = 'Rosmon Portal'
  }, [])

  const navigate = useNavigate()
  const { setToken } = usePortalAuthStore()
  const loginMutation = useCustomerLogin()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    loginMutation.mutate(
      { phone, password },
      {
        onSuccess: (data) => {
          setToken(data.access_token)
          toast.success(`Selamat datang, ${data.customer.full_name}!`)
          navigate({ to: '/portal' })
        },
        onError: () => {
          setError('Nomor HP atau password salah.')
        },
      },
    )
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10'>
      <div className='w-full max-w-sm space-y-8'>
        {/* Logo / Brand */}
        <div className='space-y-1 text-center'>
          <div className='text-3xl font-bold tracking-tight'>Rosmon</div>
          <p className='text-sm text-muted-foreground'>Portal Pelanggan</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='phone'>Nomor HP</Label>
            <div className='relative'>
              <Phone className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                id='phone'
                type='tel'
                inputMode='numeric'
                placeholder='08xx-xxxx-xxxx'
                className='pl-9'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete='tel'
                required
              />
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='password'>Password</Label>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='••••••••'
                className='pr-10'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete='current-password'
                required
              />
              <button
                type='button'
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
              </button>
            </div>
          </div>

          {error && (
            <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {error}
            </p>
          )}

          <Button
            type='submit'
            className='w-full'
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <LogIn />
            )}
            Masuk
          </Button>
        </form>

        <p className='text-center text-xs text-muted-foreground'>
          Lupa password? Hubungi admin Anda untuk reset password.
        </p>
      </div>
    </div>
  )
}
