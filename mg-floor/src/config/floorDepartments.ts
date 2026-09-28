/** Production flow stage keys (backend FLOOR_DEPARTMENTS / User.floorDepartment). */
export const FLOOR_DEPARTMENTS = [
  { key: 'melting', label: 'Melting' },
  { key: 'casting', label: 'Casting' },
  { key: 'rolling', label: 'Rolling' },
  { key: 'bangle_division', label: 'Bangle' },
  { key: 'stamping', label: 'Stamping' },
  { key: 'polishing', label: 'Polishing' },
  { key: 'quality_control', label: 'Quality Control' },
  { key: 'packing', label: 'Packaging' },
] as const

export function floorDepartmentLabel(key: string | null | undefined): string {
  const k = String(key || '').trim().toLowerCase()
  return FLOOR_DEPARTMENTS.find((d) => d.key === k)?.label || k
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
  const assigned = String(opts.floorDepartment || '').trim().toLowerCase()
  if (!opts.canChooseDepartment) return assigned
  return String(opts.selectedDepartment || '').trim().toLowerCase() || assigned
}
