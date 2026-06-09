import { z } from 'zod'

export type ServiceType = 'pppoe' | 'hotspot'

// dto.PublicPackageResponse (api/dto/package.go) — GET /public/packages.
export const PublicPackageSchema = z.object({
  id: z.number(),
  service_type: z.enum(['pppoe', 'hotspot']),
  name: z.string(),
  price: z.number(),
  rate_limit: z.string().optional().default(''),
  description: z.string().optional().default(''),
  device_id: z.number(),
})
export type PublicPackage = z.infer<typeof PublicPackageSchema>

// dto.RegistrationCreateRequest — POST /public/registrations.
export type RegistrationSubmitInput = {
  full_name: string
  phone: string
  address: string
  area?: string
  notes?: string
  service_type: ServiceType
  ppp_profile_id?: number
  hotspot_profile_id?: number
  device_id?: number
}

export type RegistrationSubmitResult = {
  id: number
  full_name: string
  status: string
}
