import { Wifi } from 'lucide-react'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-6 flex flex-col items-center justify-center gap-3'>
          <div className='flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-2 text-white shadow-lg'>
            <Wifi className='size-7' />
          </div>
          <div className='text-center'>
            <h1 className='text-xl font-extrabold tracking-tight'>Rosmon</h1>
            <p className='text-xs text-muted-foreground'>
              RouterOS Monitoring &amp; Management
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
