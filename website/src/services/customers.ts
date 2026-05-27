import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  Customer,
  CustomerCreateInput,
  CustomerListFilter,
  CustomerUpdateInput,
} from '@/types/customer'

const base = '/customers'

export const customersService = {
  async list(filter: CustomerListFilter = {}): Promise<Customer[]> {
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.area) params.set('area', filter.area)
    if (filter.q) params.set('q', filter.q)
    const qs = params.toString()
    const url = qs ? `${base}?${qs}` : base
    const { data } = await http.get<ApiEnvelope<Customer[]>>(url)
    return data.data
  },
  async get(id: number): Promise<Customer> {
    const { data } = await http.get<ApiEnvelope<Customer>>(`${base}/${id}`)
    return data.data
  },
  async create(input: CustomerCreateInput): Promise<Customer> {
    const { data } = await http.post<ApiEnvelope<Customer>>(base, input)
    return data.data
  },
  async update(id: number, input: CustomerUpdateInput): Promise<Customer> {
    const { data } = await http.put<ApiEnvelope<Customer>>(`${base}/${id}`, input)
    return data.data
  },
  async remove(id: number): Promise<void> {
    await http.delete(`${base}/${id}`)
  },
}
