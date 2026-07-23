import { useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Logo } from '@/assets/logo'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  useEffect(() => {
    document.title = 'Rosmon Dashboard'
  }, [])

  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader className='flex flex-col items-center gap-2 text-center pb-2'>
          <Logo className='size-10 text-primary' />
          <CardTitle className='text-lg tracking-tight'>
            Sign in to Rosmon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

