export interface ProfileConfig {
  id: string
  deviceId: string
  profile: string
  price: number
  validity: string
  sellingPrice?: number
  comment?: string
}

export interface ProfileConfigInput {
  profile: string
  price: number
  validity: string
  sellingPrice?: number
  comment?: string
}
