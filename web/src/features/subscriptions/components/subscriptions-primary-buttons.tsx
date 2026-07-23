import { Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { useSubscriptionsContext } from './subscriptions-provider'

export function SubscriptionsPrimaryButtons() {
  const { setOpen } = useSubscriptionsContext()
  const role = useAuthStore((s) => s.auth.user?.role)
  if (role === 'viewer') return null
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>New Subscription</span> <Plus size={18} />
      </Button>
    </div>
  )
}
