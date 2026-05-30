import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { useUpdateMessageTemplate } from '../api/queries'
import { type MessageTemplate } from '../api/schema'
import { useMessageTemplatesDialogStore } from '../store/dialog-store'

export function TemplateEditDrawer() {
  const { mode, target, close } = useMessageTemplatesDialogStore()
  const isOpen = mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && target && (
        <TemplateForm key={target.id} target={target} onClose={close} />
      )}
    </Sheet>
  )
}

function TemplateForm({
  target,
  onClose,
}: {
  target: MessageTemplate
  onClose: () => void
}) {
  const updateMutation = useUpdateMessageTemplate()
  const [name, setName] = useState(target.name)
  const [body, setBody] = useState(target.body)
  const [active, setActive] = useState(target.active)

  // variables stored as a comma/space separated hint string; rendered as
  // tappable chips so operators know which {{placeholders}} are available.
  const vars = target.variables
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !body.trim()) {
      toast.error('Name and body are required')
      return
    }
    updateMutation.mutate(
      { slug: target.slug, payload: { name: name.trim(), body, active } },
      {
        onSuccess: () => {
          toast.success(`Template '${target.slug}' saved`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to save template', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  const isPending = updateMutation.isPending

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'>
      <SheetHeader className='border-b'>
        <SheetTitle>Edit Template</SheetTitle>
        <SheetDescription>
          <span className='font-mono'>{target.slug}</span> — WhatsApp message
          template.
        </SheetDescription>
      </SheetHeader>

      <form
        id='template-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            Name
          </Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            Body
          </Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className='font-mono text-sm'
          />
        </div>

        {vars.length > 0 && (
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs font-medium text-muted-foreground'>
              Available variables
            </Label>
            <div className='flex flex-wrap gap-1.5'>
              {vars.map((v) => (
                <code
                  key={v}
                  className='rounded bg-muted px-1.5 py-0.5 text-xs'
                >
                  {`{{.${v}}}`}
                </code>
              ))}
            </div>
          </div>
        )}

        <div className='flex items-center justify-between rounded-md border px-3 py-2'>
          <div>
            <Label className='text-sm font-medium'>Active</Label>
            <p className='text-xs text-muted-foreground'>
              Inactive templates are skipped when sending.
            </p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
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
          form='template-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          Save Changes
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
