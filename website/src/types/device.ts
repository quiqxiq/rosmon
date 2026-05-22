export interface Device {
  id: string
  slug: string
  name: string
  address: string
  username: string
  createdAt: string
  updatedAt: string
}

export interface DeviceInput {
  slug: string
  name: string
  address: string
  username: string
  password: string
}
