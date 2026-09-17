/** Canonical Production Dashboard departments (display + live mapping). */

export const ASSEMBLY_TABLE_COUNT = 15

/**
 * Ordered department strip for the dashboard.
 * `aliases` match batch.currentDepartment / process / location strings (case-insensitive).
 */
export const DASHBOARD_DEPARTMENTS = [
  {
    key: 'vault_room',
    label: 'Vault Room',
    aliases: ['vault', 'vault_room', 'vault room', 'raw_stock', 'stock'],
  },
  {
    key: 'melting',
    label: 'Melting',
    aliases: ['melting', 'melt'],
  },
  {
    key: 'rolling',
    label: 'Rolling',
    aliases: ['rolling', 'roll'],
  },
  {
    key: 'bangle_area',
    label: 'Bangle Area',
    aliases: ['bangle_area', 'bangle area', 'bangle_division', 'bangle', 'bangles'],
  },
  {
    key: 'stamping',
    label: 'Stamping',
    aliases: ['stamping', 'stamp'],
  },
  {
    key: 'pendent_section',
    label: 'Pendent Section',
    aliases: ['pendent_section', 'pendent', 'pendant', 'pendant_section', 'pendants'],
  },
  {
    key: 'welding_area',
    label: 'Welding Area',
    aliases: ['welding_area', 'welding', 'weld'],
  },
  {
    key: 'assembly',
    label: 'Assembly Area',
    aliases: ['assembly', 'assembly_area', 'assembly area', 'packing', 'packaging'],
    tableCount: ASSEMBLY_TABLE_COUNT,
  },
]

/** Material flow stages shown under department strip (labels only; weights from live data). */
export const MATERIAL_FLOW_STEPS = [
  { key: 'vault', label: 'Vault / Raw' },
  { key: 'melting', label: 'Melting' },
  { key: 'rolling', label: 'Rolling' },
  { key: 'production', label: 'Production' },
  { key: 'qc', label: 'QC' },
  { key: 'finished', label: 'Finished Goods' },
]

export function normalizeDeptToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Resolve a batch/dept string to a dashboard department key, or null. */
export function matchDashboardDeptKey(raw) {
  const token = normalizeDeptToken(raw)
  if (!token) return null
  for (const dept of DASHBOARD_DEPARTMENTS) {
    const keys = [dept.key, dept.label, ...(dept.aliases || [])].map(normalizeDeptToken)
    if (keys.some((k) => k === token || token.includes(k) || k.includes(token))) {
      return dept.key
    }
  }
  return null
}

/** Parse assembly table index 1–15 from machine/location/holder text. */
export function parseAssemblyTableIndex(raw, max = ASSEMBLY_TABLE_COUNT) {
  const s = String(raw || '')
  const m = s.match(/(?:table|tbl|t)\s*[#:-]?\s*(\d{1,2})/i)
    || s.match(/\b(\d{1,2})\s*$/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 1 || n > max) return null
  return n
}
