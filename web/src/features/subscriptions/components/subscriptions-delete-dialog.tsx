'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { parseAPIError } from '@/lib/api/errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useRemoveSubscription } from '../api/queries'
import { type Subscription } from '../data/schema'

type SubscriptionsDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Subscription
}

export function SubscriptionsDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: SubscriptionsDeleteDialogProps) {
  const [value, setValue] = useState('')
  const removeMutation = useRemoveSubscription()

  const handleDelete = () => {
    if (value.trim() !== currentRow.mikrotik_username) return

    removeMutation.mutate(currentRow.id, {
      onSuccess: () => {
        toast.success(`Subscription removed`)
        onOpenChange(false)
        setValue('')
      },
      onError: (err) => {
        toast.error('Failed to remove', {
          description: parseAPIError(err),
        })
      },
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='subscriptions-delete-form'
      disabled={value.trim() !== currentRow.mikrotik_username || removeMutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Remove Subscription
        </span>
      }
      desc={
        <form
          id='subscriptions-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            Are you sure you want to remove the subscription for{' '}
            <span className='font-bold'>{currentRow.mikrotik_username}</span>?
            <br />
            This will permanently delete it. This cannot be undone.
          </p>

          <Label className='my-2'>
            Username:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='Enter Mikrotik username to confirm deletion.'
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
