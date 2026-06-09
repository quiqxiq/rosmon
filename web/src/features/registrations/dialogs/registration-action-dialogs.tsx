import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { parseAPIError } from '@/lib/api/errors'
import { useAdminUsers } from '@/features/admin/users/api/queries'
import {
  useApproveRegistration,
  useAssignRegistration,
  useRejectRegistration,
} from '../api/queries'
import { useRegistrationsDialogStore } from '../store/dialog-store'

// datetime-local value ("2026-06-01T09:00") → RFC3339 ISO, or null if empty.
function toISO(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function RegistrationActionDialogs() {
  const { mode } = useRegistrationsDialogStore()
  return (
    <>
      <ApproveDialog open={mode === 'approve'} />
      <RejectDialog open={mode === 'reject'} />
      <AssignDialog open={mode === 'assign'} />
    </>
  )
}

function ApproveDialog({ open }: { open: boolean }) {
  const { target, close } = useRegistrationsDialogStore()
  const mut = useApproveRegistration()
  const [schedule, setSchedule] = useState('')

  const confirm = () => {
    if (!target) return
    mut.mutate(
      { id: target.id, payload: { scheduled_at: toISO(schedule) } },
      {
        onSuccess: () => {
          toast.success(`Approved '${target.full_name}' — customer created`)
          close()
        },
        onError: (err) =>
          toast.error('Approve failed', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Approve registration</DialogTitle>
              <DialogDescription>
                Creates (or links) a customer for '{target.full_name}' and
                sends a confirmation. Set an optional install schedule.
              </DialogDescription>
            </DialogHeader>
            <div className='flex flex-col gap-1.5'>
              <Label className='text-xs font-medium text-muted-foreground'>
                Scheduled at (optional)
              </Label>
              <Input
                type='datetime-local'
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant='outline' size='sm' onClick={close}>
                Cancel
              </Button>
              <Button
                size='sm'
                onClick={confirm}
                disabled={mut.isPending}
                className='gap-1.5'
              >
                {mut.isPending && <Loader2 className='size-4 animate-spin' />}
                Approve
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ open }: { open: boolean }) {
  const { target, close } = useRegistrationsDialogStore()
  const mut = useRejectRegistration()
  const [reason, setReason] = useState('')

  const confirm = () => {
    if (!target) return
    if (!reason.trim()) {
      toast.error('A reason is required')
      return
    }
    mut.mutate(
      { id: target.id, payload: { reason: reason.trim() } },
      {
        onSuccess: () => {
          toast.success(`Rejected '${target.full_name}'`)
          close()
        },
        onError: (err) =>
          toast.error('Reject failed', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Reject registration</DialogTitle>
              <DialogDescription>
                The applicant is notified with the reason below.
              </DialogDescription>
            </DialogHeader>
            <div className='flex flex-col gap-1.5'>
              <Label className='text-xs font-medium text-muted-foreground'>
                Reason
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder='Area belum tercover jaringan…'
              />
            </div>
            <DialogFooter>
              <Button variant='outline' size='sm' onClick={close}>
                Cancel
              </Button>
              <Button
                variant='destructive'
                size='sm'
                onClick={confirm}
                disabled={mut.isPending}
                className='gap-1.5'
              >
                {mut.isPending && <Loader2 className='size-4 animate-spin' />}
                Reject
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AssignDialog({ open }: { open: boolean }) {
  const { target, close } = useRegistrationsDialogStore()
  const mut = useAssignRegistration()
  const usersQuery = useAdminUsers()
  const [assignedTo, setAssignedTo] = useState('')
  const [schedule, setSchedule] = useState('')

  // Technicians = operator or admin accounts.
  const candidates = (usersQuery.data ?? []).filter(
    (u) => u.role === 'operator' || u.role === 'admin',
  )

  const confirm = () => {
    if (!target) return
    const id = Number(assignedTo)
    if (!id) {
      toast.error('Pick a technician')
      return
    }
    mut.mutate(
      {
        id: target.id,
        payload: { assigned_to: id, scheduled_at: toISO(schedule) },
      },
      {
        onSuccess: () => {
          toast.success('Technician assigned')
          close()
        },
        onError: (err) =>
          toast.error('Assign failed', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Assign technician</DialogTitle>
              <DialogDescription>
                Assign an operator to install '{target.full_name}'.
              </DialogDescription>
            </DialogHeader>
            <div className='flex flex-col gap-3'>
              <div className='flex flex-col gap-1.5'>
                <Label className='text-xs font-medium text-muted-foreground'>
                  Technician
                </Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select a user' />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label className='text-xs font-medium text-muted-foreground'>
                  Scheduled at (optional)
                </Label>
                <Input
                  type='datetime-local'
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' size='sm' onClick={close}>
                Cancel
              </Button>
              <Button
                size='sm'
                onClick={confirm}
                disabled={mut.isPending}
                className='gap-1.5'
              >
                {mut.isPending && <Loader2 className='size-4 animate-spin' />}
                Assign
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
