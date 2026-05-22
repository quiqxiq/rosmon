export interface VoucherSale {
  id: string
  voucher: string
  profile: string
  price: number
  soldAt: string
  cashier?: string
}

export interface SalesSummary {
  date: string
  totalSold: number
  totalRevenue: number
  byProfile: Array<{ profile: string; count: number; revenue: number }>
}
