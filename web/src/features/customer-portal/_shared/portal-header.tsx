import { useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PortalHeaderProps {
  title: string
  showBack?: boolean
  className?: string
  right?: React.ReactNode
}

export function PortalHeader({ title, showBack = false, className, right }: PortalHeaderProps) {
  const router = useRouter()

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur',
        className,
      )}
    >
      {showBack && (
        <Button
          variant='ghost'
          size='icon'
          className='-ml-2 mr-1 size-9'
          onClick={() => router.history.back()}
        >
          <ChevronLeft className='size-5' />
          <span className='sr-only'>Kembali</span>
        </Button>
      )}
      <h1 className='flex-1 text-base font-semibold'>{title}</h1>
      {right && <div className='ml-2'>{right}</div>}
    </header>
  )
}
