import { createFileRoute } from '@tanstack/react-router'
import { MessageTemplates } from '@/features/message-templates'

export const Route = createFileRoute('/_authenticated/admin/message-templates/')(
  {
    component: MessageTemplates,
  },
)
