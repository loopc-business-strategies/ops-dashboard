/** MG Floor is permanently locked to the MG tenant. No tenant selector. */
export const MG_TENANT = 'mg' as const

export type MgTenant = typeof MG_TENANT

export function getTenant(): MgTenant {
  return MG_TENANT
}

export function assertMgOnly(company: string | null | undefined): boolean {
  return String(company || '').trim().toLowerCase() === MG_TENANT
}
