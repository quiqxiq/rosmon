// Sesuai dto.CustomerResponse backend (snake_case 1:1).
export interface Customer {
  id: number
  full_name: string
  phone: string
  address: string
  area: string
  notes: string
  status: 'aktif' | 'nonaktif'
  created_by?: number | null
  created_at: string
  updated_at: string
}

// Sesuai dto.CustomerCreateRequest backend.
export interface CustomerCreateInput {
  full_name: string
  phone: string
  address?: string
  area?: string
  notes?: string
  status?: 'aktif' | 'nonaktif'
}

// Sesuai dto.CustomerUpdateRequest backend (sparse, semua optional).
export interface CustomerUpdateInput {
  full_name?: string
  phone?: string
  address?: string
  area?: string
  notes?: string
  status?: 'aktif' | 'nonaktif'
}

export interface CustomerListFilter {
  status?: 'aktif' | 'nonaktif'
  area?: string
  q?: string
}
