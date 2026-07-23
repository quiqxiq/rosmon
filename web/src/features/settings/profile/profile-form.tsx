import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Shield, User } from 'lucide-react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseAPIError } from '@/lib/api/errors'
import { useAuthStore } from '@/stores/auth-store'
import { useCurrentUser } from '@/features/auth/api/queries'
import { useUpdateAdminUser } from '@/features/admin/users/api/queries'

const profileFormSchema = z
  .object({
    username: z
      .string()
      .min(2, 'Username minimal 2 karakter.')
      .max(64, 'Username maksimal 64 karakter.'),
    password: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.length >= 6,
        'Password minimal 6 karakter jika diisi.'
      ),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.password && data.password !== data.confirmPassword) {
        return false
      }
      return true
    },
    {
      message: 'Konfirmasi password tidak cocok dengan password baru.',
      path: ['confirmPassword'],
    }
  )

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm() {
  const storedUser = useAuthStore((s) => s.auth.user)
  const { data: currentUser, isLoading } = useCurrentUser()
  const user = currentUser || storedUser
  const updateMutation = useUpdateAdminUser()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user?.username ?? '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (user?.username) {
      form.setValue('username', user.username)
    }
  }, [user?.username, form])

  const onSubmit = (values: ProfileFormValues) => {
    if (!user?.id) {
      toast.error('Tidak dapat mengidentifikasi ID pengguna saat ini.')
      return
    }

    const payload: { username?: string; password?: string } = {}
    if (values.username.trim() !== user.username) {
      payload.username = values.username.trim()
    }
    if (values.password && values.password.trim().length >= 6) {
      payload.password = values.password.trim()
    }

    if (Object.keys(payload).length === 0) {
      toast.info('Tidak ada perubahan profil yang disimpan.')
      return
    }

    updateMutation.mutate(
      { id: user.id, body: payload },
      {
        onSuccess: () => {
          toast.success('Profil berhasil diperbarui')
          form.setValue('password', '')
          form.setValue('confirmPassword', '')
        },
        onError: (err) => {
          toast.error('Gagal memperbarui profil', {
            description: parseAPIError(err),
          })
        },
      }
    )
  }

  const isPending = updateMutation.isPending

  return (
    <div className='space-y-6 max-w-2xl'>
      <Card>
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <User className='size-5 text-primary' />
                Informasi Akun
              </CardTitle>
              <CardDescription>
                Detail identitas dan hak akses akun terautentikasi backend.
              </CardDescription>
            </div>
            {user?.role && (
              <Badge variant='outline' className='capitalize px-3 py-1 font-semibold'>
                <Shield className='mr-1.5 size-3.5 text-primary' />
                {user.role}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className='grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg mx-6 mb-6 border'>
          <div>
            <span className='text-xs text-muted-foreground block font-medium'>User ID</span>
            <span className='font-mono font-semibold'>{user?.id ?? '-'}</span>
          </div>
          <div>
            <span className='text-xs text-muted-foreground block font-medium'>Username</span>
            <span className='font-semibold'>{user?.username ?? '-'}</span>
          </div>
          <div>
            <span className='text-xs text-muted-foreground block font-medium'>Role Hak Akses</span>
            <span className='capitalize font-medium text-foreground'>{user?.role ?? '-'}</span>
          </div>
          <div>
            <span className='text-xs text-muted-foreground block font-medium'>Status Akun</span>
            <Badge variant='secondary' className='text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'>
              Aktif
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder='username' disabled={isLoading || isPending} {...field} />
                </FormControl>
                <FormDescription>
                  Nama pengguna yang digunakan untuk login ke dalam sistem Rosmon.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password Baru</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder='Kosongkan jika tidak diubah'
                      disabled={isLoading || isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Minimal 6 karakter.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='confirmPassword'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Konfirmasi Password Baru</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder='Ulangi password baru'
                      disabled={isLoading || isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={isLoading || isPending}>
            {isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
            Simpan Perubahan
          </Button>
        </form>
      </Form>
    </div>
  )
}
