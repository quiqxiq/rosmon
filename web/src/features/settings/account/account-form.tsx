import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { PasswordInput } from '@/components/password-input'
import { useMe, useUpdateMe } from './api/queries'

const schema = z
  .object({
    email: z.string().email('Email tidak valid').or(z.literal('')),
    current_password: z.string(),
    new_password: z.string(),
    confirm_password: z.string(),
  })
  .refine(
    (v) => {
      if (v.new_password && !v.current_password) return false
      return true
    },
    {
      message: 'Password lama wajib diisi untuk mengganti password',
      path: ['current_password'],
    },
  )
  .refine(
    (v) => {
      if (v.new_password && v.new_password !== v.confirm_password) return false
      return true
    },
    {
      message: 'Konfirmasi password tidak cocok',
      path: ['confirm_password'],
    },
  )
  .refine(
    (v) => {
      if (v.new_password && v.new_password.length < 8) return false
      return true
    },
    {
      message: 'Password minimal 8 karakter',
      path: ['new_password'],
    },
  )

type FormValues = z.infer<typeof schema>

export function AccountForm() {
  const { data: me, isLoading } = useMe()
  const { mutate: updateMe, isPending } = useUpdateMe()
  const [showPasswordSection, setShowPasswordSection] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  useEffect(() => {
    if (me) {
      form.reset({
        email: me.email ?? '',
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
    }
  }, [me, form])

  function onSubmit(values: FormValues) {
    const payload: Parameters<typeof updateMe>[0] = {}

    if (values.email !== (me?.email ?? '')) {
      payload.email = values.email || undefined
    }

    if (values.new_password) {
      payload.current_password = values.current_password
      payload.new_password = values.new_password
    }

    if (!payload.email && !payload.new_password) {
      toast.info('Tidak ada perubahan yang perlu disimpan.')
      return
    }

    updateMe(payload, {
      onSuccess: () => {
        toast.success('Profil berhasil diperbarui.')
        form.reset({
          email: payload.email ?? me?.email ?? '',
          current_password: '',
          new_password: '',
          confirm_password: '',
        })
        setShowPasswordSection(false)
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.'
        if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
          form.setError('current_password', { message: 'Password lama salah.' })
        } else {
          toast.error('Gagal memperbarui profil.', { description: msg })
        }
      },
    })
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <div className='h-10 w-48 animate-pulse rounded bg-muted' />
        <div className='h-10 w-full animate-pulse rounded bg-muted' />
        <div className='h-10 w-full animate-pulse rounded bg-muted' />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>

        {/* Username (read-only) */}
        <div className='flex flex-col gap-1.5'>
          <span className='text-sm font-medium leading-none'>Username</span>
          <div className='flex items-center gap-2'>
            <span className='font-mono text-sm text-muted-foreground'>
              {me?.username}
            </span>
            <Badge variant='secondary' className='text-xs'>
              {me?.role}
            </Badge>
          </div>
          <p className='text-xs text-muted-foreground'>
            Username tidak dapat diubah.
          </p>
        </div>

        <Separator />

        {/* Email */}
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder='email@example.com'
                  autoComplete='email'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Email opsional. Digunakan untuk notifikasi sistem.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* Password change section */}
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium'>Ganti Password</p>
              <p className='text-xs text-muted-foreground'>
                Kosongkan jika tidak ingin mengganti password.
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setShowPasswordSection((v) => !v)
                if (showPasswordSection) {
                  form.setValue('current_password', '')
                  form.setValue('new_password', '')
                  form.setValue('confirm_password', '')
                }
              }}
            >
              {showPasswordSection ? 'Batal' : 'Ubah Password'}
            </Button>
          </div>

          {showPasswordSection && (
            <div className='space-y-4 rounded-lg border p-4'>
              <FormField
                control={form.control}
                name='current_password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Lama</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete='current-password'
                        placeholder='Password saat ini'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='new_password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Baru</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete='new-password'
                        placeholder='Minimal 8 karakter'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='confirm_password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Password Baru</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete='new-password'
                        placeholder='Ulangi password baru'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        <Button type='submit' disabled={isPending}>
          {isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
          Simpan Perubahan
        </Button>
      </form>
    </Form>
  )
}
