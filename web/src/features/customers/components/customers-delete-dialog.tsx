'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { parseAPIError } from '@/lib/api/errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useRemoveCustomer } from '../api/queries'
import { type Customer } from '../data/schema'

type CustomersDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Customer
}

export function CustomersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: CustomersDeleteDialogProps) {
  const [value, setValue] = useState('')
  const removeMutation = useRemoveCustomer()

  const handleDelete = async () => {
    if (value.trim() !== currentRow.full_name) return

    try {
      await removeMutation.mutateAsync(currentRow.id)
      toast.success(`Customer '${currentRow.full_name}' removed`)
      onOpenChange(false)
      setValue('')
    } catch (err) {
      toast.error('Failed to remove customer', {
        description: parseAPIError(err),
      })
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='customers-delete-form'
      disabled={value.trim() !== currentRow.full_name || removeMutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Remove Customer
        </span>
      }
      desc={
        <form
          id='customers-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            Are you sure you want to remove{' '}
            <span className='font-bold'>{currentRow.full_name}</span>?
            <br />
            This action will permanently remove the customer. Active subscriptions must be removed first. This cannot be undone.
          </p>

          <Label className='my-2'>
            Name:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='Enter customer name to confirm deletion.'
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Please be careful, this operation can not be rolled back.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText='Remove'
      destructive
    />
  )
}
