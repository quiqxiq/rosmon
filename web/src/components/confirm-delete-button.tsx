import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ConfirmDeleteButtonProps = {
  title: string
  description: string
  onConfirm: () => Promise<void> | void
  trigger?: ReactNode
  pending?: boolean
  confirmText?: string
}

// Small icon button that pops an AlertDialog to confirm a destructive
// action. Used for the many "delete one row" affordances across the
// network / system tables where a full dialog file is overkill.
export function ConfirmDeleteButton({
  title,
  description,
  onConfirm,
  trigger,
  pending = false,
  confirmText = 'Remove',
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    await onConfirm()
    setOpen(false)
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button
          variant='ghost'
          size='icon'
          className='size-8 text-muted-foreground hover:text-destructive'
          onClick={() => setOpen(true)}
          aria-label={confirmText}
        >
          <Trash2 className='size-4' />
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={pending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
