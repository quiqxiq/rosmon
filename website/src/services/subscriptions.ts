import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  Subscription,
  SubscriptionCreateInput,
  SubscriptionListFilter,
  SubscriptionStatusPatchInput,
  SubscriptionUpdateInput,
  SubscriptionWriteResponse,
} from '@/types/subscription'

const base = '/subscriptions'

function normalizeWrite(raw: unknown): SubscriptionWriteResponse {
  // Backend response: { subscription: {...}, warning?: "..." } atau plain Subscription
  // (kompatibilitas dengan endpoint yang tidak melibatkan MikroTik sync).
  const r = raw as Partial<SubscriptionWriteResponse> & Partial<Subscription>
  if (r && 'subscription' in r && r.subscription) {
    return { subscription: r.subscription, warning: r.warning }
  }
  return { subscription: r as Subscription }
}

export const subscriptionsService = {
  async list(filter: SubscriptionListFilter = {}): Promise<Subscription[]> {
    const params = new URLSearchParams()
    if (filter.customer_id) params.set('customer_id', String(filter.customer_id))
    if (filter.device_id) params.set('device_id', String(filter.device_id))
    if (filter.status) params.set('status', filter.status)
    if (filter.service_type) params.set('service_type', filter.service_type)
    const qs = params.toString()
    const url = qs ? `${base}?${qs}` : base
    const { data } = await http.get<ApiEnvelope<Subscription[]>>(url)
    return data.data
  },
  async get(id: number): Promise<Subscription> {
    const { data } = await http.get<ApiEnvelope<Subscription>>(`${base}/${id}`)
    return data.data
  },
  async create(input: SubscriptionCreateInput): Promise<SubscriptionWriteResponse> {
    const { data } = await http.post<ApiEnvelope<unknown>>(base, input)
    return normalizeWrite(data.data)
  },
  async update(id: number, input: SubscriptionUpdateInput): Promise<SubscriptionWriteResponse> {
    const { data } = await http.put<ApiEnvelope<unknown>>(`${base}/${id}`, input)
    return normalizeWrite(data.data)
  },
  async patchStatus(
    id: number,
    input: SubscriptionStatusPatchInput,
  ): Promise<SubscriptionWriteResponse> {
    const { data } = await http.patch<ApiEnvelope<unknown>>(`${base}/${id}/status`, input)
    return normalizeWrite(data.data)
  },
  async reconcile(id: number): Promise<SubscriptionWriteResponse> {
    const { data } = await http.post<ApiEnvelope<unknown>>(`${base}/${id}/reconcile`)
    return normalizeWrite(data.data)
  },
  async remove(id: number): Promise<SubscriptionWriteResponse | null> {
    const { data, status } = await http.delete<ApiEnvelope<unknown>>(`${base}/${id}`)
    if (status === 204) return null
    return normalizeWrite(data?.data)
  },
}
