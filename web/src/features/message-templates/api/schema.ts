import { z } from 'zod'

// dto.MessageTemplateResponse (api/dto/message_template.go). Slug = immutable
// identifier; only name/body/variables/active are editable.
export const MessageTemplateSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  body: z.string(),
  variables: z.string(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type MessageTemplate = z.infer<typeof MessageTemplateSchema>

// PUT /message-templates/:slug — sparse update (omitted fields preserved).
export type MessageTemplateUpdateInput = {
  name?: string
  body?: string
  variables?: string
  active?: boolean
}
