import { Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { useCustomers } from './customers-provider'

export function CustomersPrimaryButtons() {
  const { setOpen } = useCustomers()
  const role = useAuthStore((s) => s.auth.user?.role)
  if (role === 'viewer') return null
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add Customer</span> <Plus size={18} />
      </Button>
    </div>
  )
}
