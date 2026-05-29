import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { parseAPIError } from '@/lib/api/errors'
import { useCreateCustomer, useUpdateCustomer } from '../api/queries'
import {
  type Customer,
  type CustomerCreateInput,
  type CustomerStatus,
} from '../api/schema'
import { useCustomersDialogStore } from '../store/customers-dialog-store'

type Draft = {
  full_name: string
  phone: string
  address: string
  area: string
  notes: string
  status: CustomerStatus
}

function emptyDraft(): Draft {
  return {
    full_name: '',
    phone: '',
    address: '',
    area: '',
    notes: '',
    status: 'aktif',
  }
}

function draftFromTarget(c: Customer): Draft {
  return {
    full_name: c.full_name,
    phone: c.phone,
    address: c.address ?? '',
    area: c.area ?? '',
    notes: c.notes ?? '',
    status: (c.status as CustomerStatus) ?? 'aktif',
  }
}

export function CustomerMutateDrawer() {
  const { mode, target, close } = useCustomersDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <CustomerForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

function CustomerForm({
  mode,
  target,
  onClose,
}: {
  mode: 'add' | 'edit'
  target: Customer | null
  onClose: () => void
}) {
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const [draft, setDraft] = useState<Draft>(() =>
    mode === 'edit' && target ? draftFromTarget(target) : emptyDraft(),
  )

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.full_name.trim() || !draft.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    const payload: CustomerCreateInput = {
      full_name: draft.full_name.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      area: draft.area.trim(),
      notes: draft.notes.trim(),
      status: draft.status,
    }

    if (mode === 'add') {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Customer '${draft.full_name}' created`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to create customer', {
            description: parseAPIError(err),
          }),
      })
    } else if (target) {
      updateMutation.mutate(
        { id: target.id, payload },
        {
          onSuccess: () => {
            toast.success(`Customer '${draft.full_name}' updated`)
            onClose()
          },
          onError: (err) =>
            toast.error('Failed to update customer', {
              description: parseAPIError(err),
            }),
        },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle>
          {mode === 'add' ? 'Add Customer' : 'Edit Customer'}
        </SheetTitle>
        <SheetDescription>Subscriber contact and billing record.</SheetDescription>
      </SheetHeader>

      <form
        id='customer-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <Field label='Full Name'>
          <Input
            value={draft.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            placeholder='Budi Santoso'
          />
        </Field>
        <Field label='Phone'>
          <Input
            value={draft.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder='0812xxxxxxx'
          />
        </Field>
        <Field label='Area'>
          <Input
            value={draft.area}
            onChange={(e) => update('area', e.target.value)}
            placeholder='Blok A'
          />
        </Field>
        <Field label='Address'>
          <Textarea
            value={draft.address}
            onChange={(e) => update('address', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label='Notes'>
          <Textarea
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label='Status'>
          <Select
            value={draft.status}
            onValueChange={(v) => update('status', v as CustomerStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='aktif'>Aktif</SelectItem>
              <SelectItem value='nonaktif'>Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </form>

      <SheetFooter className='border-t'>
        <SheetClose asChild>
          <Button variant='outline' size='sm' disabled={isPending}>
            Cancel
          </Button>
        </SheetClose>
        <Button
          type='submit'
          size='sm'
          form='customer-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? 'Create' : 'Save Changes'}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label className='text-xs font-medium text-muted-foreground'>
        {label}
      </Label>
      {children}
    </div>
  )
}
