import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { parseAPIError } from '@/lib/api/errors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'

type PasswordRevealDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Mengambil password plaintext. Dipanggil hanya saat dialog terbuka. */
  reveal: () => Promise<string>
  /** Opsional: generate password baru, return plaintext baru. */
  reset?: () => Promise<string>
  resetLabel?: string
}

/**
 * Dialog reveal password untuk admin/operator: mengambil plaintext lewat endpoint
 * reveal ber-RequireRole (lazy via useQuery, hanya saat terbuka), menampilkannya
 * di PasswordInput (toggle mata) dengan tombol salin, dan opsional tombol reset
 * (generate baru).
 */
export function PasswordRevealDialog({
  open,
  onOpenChange,
  title,
  description,
  reveal,
  reset,
  resetLabel = 'Reset (generate baru)',
}: PasswordRevealDialogProps) {
  const qc = useQueryClient()
  const queryKey = ['password-reveal', title] as const
  const [resetting, setResetting] = useState(false)

  const query = useQuery({
    queryKey,
    queryFn: reveal,
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const value = query.data ?? ''
  const loading = query.isFetching

  const handleCopy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Password disalin')
    } catch {
      toast.error('Gagal menyalin')
    }
  }

  const handleReset = async () => {
    if (!reset) return
    setResetting(true)
    try {
      const pw = await reset()
      qc.setQueryData(queryKey, pw)
      toast.success('Password baru dibuat')
    } catch (err) {
      toast.error('Gagal reset password', { description: parseAPIError(err) })
    } finally {
      setResetting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className='space-y-2'>
          <Label>Password</Label>
          <div className='flex items-center gap-2'>
            <PasswordInput
              readOnly
              value={loading ? 'Memuat…' : value}
              className='flex-1'
            />
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={handleCopy}
              disabled={loading || !value}
              title='Salin'
            >
              <Copy size={16} />
            </Button>
          </div>
          {query.isError && (
            <p className='text-sm text-destructive'>
              {parseAPIError(query.error)}
            </p>
          )}
          {!loading && !query.isError && !value && (
            <p className='text-sm text-muted-foreground'>
              Belum ada password yang di-set.
            </p>
          )}
        </div>

        <DialogFooter className='gap-2'>
          {reset && (
            <Button
              type='button'
              variant='secondary'
              onClick={handleReset}
              disabled={resetting}
            >
              <RefreshCw size={16} className='me-1' />
              {resetLabel}
            </Button>
          )}
          <Button type='button' onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
