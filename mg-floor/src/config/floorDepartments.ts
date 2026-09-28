/**
 * Floor department keys = Operations → Production workbook departments
 * (backend FLOOR_DEPARTMENTS / User.floorDepartment).
 */
export const FLOOR_DEPARTMENTS = [
  { key: 'vault_room', label: 'Vault Room' },
  { key: 'melting', label: 'Melting' },
  { key: 'rolling', label: 'Rolling' },
  { key: 'bangle_area', label: 'Bangle Area' },
  { key: 'stamping', label: 'Stamping' },
  { key: 'pendent_section', label: 'Pendent' },
  { key: 'welding_area', label: 'Welding' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'qc', label: 'QC' },
  { key: 'finished_goods', label: 'Finished Goods' },
] as const

const LEGACY_ALIASES: Record<string, string> = {
  bangle_division: 'bangle_area',
  quality_control: 'qc',
  packing: 'finished_goods',
}

/** A current department key, or '' when unset or no longer offered (e.g. old casting / polishing). */
export function normalizeFloorDepartment(key: string | null | undefined): string {
  const k = String(key || '').trim().toLowerCase()
  const mapped = LEGACY_ALIASES[k] || k
  return FLOOR_DEPARTMENTS.some((d) => d.key === mapped) ? mapped : ''
}

export function floorDepartmentLabel(key: string | null | undefined): string {
  const k = normalizeFloorDepartment(key)
  return FLOOR_DEPARTMENTS.find((d) => d.key === k)?.label || String(key || '').trim().toLowerCase()
}

/**
 * Operators always work under their admin-assigned floor department; managers (who can approve)
 * may use the department chosen on the tablet, falling back to their own.
 */
export function effectiveFloorDepartment(opts: {
  floorDepartment?: string | null
  selectedDepartment?: string | null
  canChooseDepartment: boolean
}): string {
  const assigned = normalizeFloorDepartment(opts.floorDepartment)
  if (!opts.canChooseDepartment) return assigned
  return normalizeFloorDepartment(opts.selectedDepartment) || assigned
}
