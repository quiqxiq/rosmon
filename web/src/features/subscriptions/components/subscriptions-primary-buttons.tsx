import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSubscriptionsContext } from './subscriptions-provider'

export function SubscriptionsPrimaryButtons() {
  const { setOpen } = useSubscriptionsContext()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>New Subscription</span> <Plus size={18} />
      </Button>
    </div>
  )
}
