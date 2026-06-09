import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { MessageTemplate, MessageTemplateUpdateInput } from './schema'

const base = '/message-templates'

// GET /message-templates — admin only. Returns all seeded templates.
export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const res = await apiClient.get<Envelope<MessageTemplate[]>>(base)
  return unwrap(res.data)
}

// PUT /message-templates/:slug — sparse update.
export async function updateMessageTemplate(
  slug: string,
  payload: MessageTemplateUpdateInput,
): Promise<MessageTemplate> {
  const res = await apiClient.put<Envelope<MessageTemplate>>(
    `${base}/${slug}`,
    payload,
  )
  return unwrap(res.data)
}
