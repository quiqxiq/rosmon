// Types mirroring backend DTOs for the customer portal.
// Source: api/dto/customer_portal.go + api/dto/invoice.go

export interface PortalMe {
  id: number
  full_name: string
  phone: string
  address: string
  area: string
  status: string
}

export type SubscriptionStatus =
  | 'pending_install'
  | 'active'
  | 'isolir'
  | 'suspended'
  | 'terminated'

export interface PortalSubscription {
  id: number
  customer_id: number
  service_type: 'pppoe' | 'hotspot'
  mikrotik_username: string
  status: SubscriptionStatus
  sync_status: string
  next_invoice_date: string | null
  billing_day: number
  activated_at: string | null
  device_id?: number
  ppp_profile_id?: number
  hotspot_profile_id?: number
  created_at: string
  updated_at: string
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'

export interface PortalInvoice {
  id: number
  invoice_number: string
  customer_id: number
  subscription_id: number
  amount: number
  period_start: string
  period_end: string
  due_date: string
  status: InvoiceStatus
  issued_at: string | null
  paid_at: string | null
  notes: string
  // Present only for unpaid invoices (omitempty from backend)
  payment_code?: string
  qr_content?: string
  created_at: string
  updated_at: string
}

export type PaymentMethod = 'cash' | 'manual_transfer' | 'xendit' | 'tripay'
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected'

export interface PortalPayment {
  id: number
  invoice_id: number
  customer_id: number
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  confirmed_at: string | null
  // Gateway fields (populated for online payments)
  gateway_name?: string
  invoice_url?: string
  expires_at?: string
  created_at: string
  updated_at?: string
}

export interface CustomerLoginRequest {
  phone: string
  password: string
}

export interface CustomerLoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  customer: PortalMe
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

/** Response dari POST /customer/invoices/:id/pay */
export interface InitiatePaymentResponse {
  payment_id: number
  invoice_url: string
  expires_at: string
}
