/** Canonical Production Dashboard live-strip departments (display + live mapping). */

export const ASSEMBLY_TABLE_COUNT = 15

/**
 * Ordered live strip / department overview for the classic reference dashboard.
 * Keys align with FALLBACK_STAGES / ProductionFlowConfig process keys.
 * `aliases` match batch.currentDepartment / process / location strings (case-insensitive).
 */
export const DASHBOARD_DEPARTMENTS = [
  {
    key: 'melting',
    label: 'Melting',
    aliases: ['melting', 'melt'],
  },
  {
    key: 'casting',
    label: 'Casting',
    aliases: ['casting', 'cast'],
  },
  {
    key: 'rolling',
    label: 'Rolling',
    aliases: ['rolling', 'roll'],
  },
  {
    key: 'bangle_division',
    label: 'Bangle Division',
    aliases: ['bangle_division', 'bangle division', 'bangle_area', 'bangle area', 'bangle', 'bangles'],
  },
  {
    key: 'stamping',
    label: 'Stamping',
    aliases: ['stamping', 'stamp'],
  },
  {
    key: 'polishing',
    label: 'Polishing',
    aliases: ['polishing', 'polish'],
  },
  {
    key: 'quality_control',
    label: 'Quality Control',
    aliases: ['quality_control', 'quality control', 'qc', 'quality', 'quality_checking', 'checking'],
  },
  {
    key: 'packing',
    label: 'Packing',
    aliases: ['packing', 'packaging', 'pack'],
  },
]

/**
 * Extra operational department tokens that must still resolve for historical /
 * live records, but are not primary live-strip cards on this dashboard.
 */
export const EXTENDED_DEPT_ALIASES = [
  {
    key: 'vault_room',
    label: 'Vault Room',
    aliases: ['vault', 'vault_room', 'vault room', 'raw_stock', 'stock'],
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
    aliases: ['assembly', 'assembly_area', 'assembly area'],
    tableCount: ASSEMBLY_TABLE_COUNT,
  },
]

/** All known department definitions (display + extended). */
export const ALL_KNOWN_DEPARTMENTS = [...DASHBOARD_DEPARTMENTS, ...EXTENDED_DEPT_ALIASES]

/** Material flow stages (optional panels; not primary classic layout). */
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

/**
 * Resolve a batch/dept string to a department key.
 * Prefers live-strip departments, then extended operational aliases.
 */
export function matchDashboardDeptKey(raw) {
  const token = normalizeDeptToken(raw)
  if (!token) return null
  for (const dept of ALL_KNOWN_DEPARTMENTS) {
    const keys = [dept.key, dept.label, ...(dept.aliases || [])].map(normalizeDeptToken)
    if (keys.some((k) => k === token || token.includes(k) || k.includes(token))) {
      return dept.key
    }
  }
  return null
}

/** True when key is one of the eight classic live-strip departments. */
export function isLiveStripDeptKey(key) {
  return DASHBOARD_DEPARTMENTS.some((d) => d.key === key)
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
