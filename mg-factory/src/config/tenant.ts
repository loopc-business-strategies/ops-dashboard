/** MG Factory is permanently locked to the MG tenant. */
export const MG_TENANT = 'mg' as const

export type MgTenant = typeof MG_TENANT

export function getTenant(): MgTenant {
  return MG_TENANT
}
