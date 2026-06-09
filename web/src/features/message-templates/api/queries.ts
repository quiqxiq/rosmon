import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { MessageTemplateUpdateInput } from './schema'

export function useMessageTemplates() {
  return useQuery({
    queryKey: qk.messageTemplates(),
    queryFn: svc.listMessageTemplates,
  })
}

export function useUpdateMessageTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      slug,
      payload,
    }: {
      slug: string
      payload: MessageTemplateUpdateInput
    }) => svc.updateMessageTemplate(slug, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-templates'] }),
  })
}
