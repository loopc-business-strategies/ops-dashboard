import { DASHBOARD_DEPARTMENTS, normalizeDeptToken } from '../../../production-dashboard/departmentConfig'

/**
 * LoopC Operations → Production sheet departments.
 * Extends dashboard depts with QC + Finished Goods.
 * Assembly aliases drop packing/packaging so those map to Finished Goods.
 */
export const LOOPC_PRODUCTION_DEPARTMENTS = [
  ...DASHBOARD_DEPARTMENTS.map((dept) => {
    if (dept.key !== 'assembly') return { ...dept }
    return {
      ...dept,
      aliases: (dept.aliases || []).filter(
        (a) => !['packing', 'packaging'].includes(normalizeDeptToken(a)),
      ),
    }
  }),
  {
    key: 'qc',
    label: 'QC',
    subtitle: 'Quality Control',
    aliases: ['qc', 'quality', 'quality_control', 'quality control'],
  },
  {
    key: 'finished_goods',
    label: 'Finished Goods',
    subtitle: 'Packing & Finished Stock',
    aliases: ['packing', 'finished', 'finished_goods', 'finished goods', 'fg'],
  },
]

export function matchLoopcDeptKey(raw, status) {
  const token = normalizeDeptToken(raw)
  if (!token && status === 'QC') return 'qc'

  for (const dept of LOOPC_PRODUCTION_DEPARTMENTS) {
    const keys = [dept.key, dept.label, ...(dept.aliases || [])].map(normalizeDeptToken)
    if (token && keys.some((k) => k === token || token.includes(k) || k.includes(token))) {
      return dept.key
    }
  }

  if (status === 'QC') return 'qc'
  return null
}

export const DEPT_HEADER_ICON = {
  vault_room: '◆',
  melting: '▲',
  rolling: '▣',
  bangle_area: '◎',
  stamping: '✦',
  pendent_section: '◇',
  welding_area: '⬡',
  assembly: '▦',
  qc: '✓',
  finished_goods: '▣',
}
