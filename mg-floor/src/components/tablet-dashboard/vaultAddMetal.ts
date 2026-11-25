/**
 * Vault Room "Add metal" — group created inventory products for the picker
 * (same rules as web Allocate metalOutProductOptions).
 */

export type VaultMetalProductOption = {
  id: string
  name: string
  metalGroupKey: string
  metalGroup: string
  purity: string
}

const METAL_GROUP_ORDER = ['gold', 'silver', 'copper', 'alloy', 'cadmium', 'other']

function titleCaseMetalGroup(key: string) {
  const k = String(key || 'other').trim().toLowerCase()
  if (!k || k === 'other') return 'Other'
  return k.replace(/\b\w/g, (c) => c.toUpperCase())
}

function metalGroupSortIndex(key: string) {
  const i = METAL_GROUP_ORDER.indexOf(String(key || 'other').toLowerCase())
  return i >= 0 ? i : METAL_GROUP_ORDER.length
}

export function vaultMetalProductOptions(
  products: Array<{
    _id?: string
    id?: string
    name?: string
    category?: string
    purity?: number | string
    isDeleted?: boolean
    deletedAt?: string | null
  }> = [],
): VaultMetalProductOption[] {
  const byKey = new Map<string, VaultMetalProductOption>()
  for (const item of Array.isArray(products) ? products : []) {
    if (!item || item.isDeleted || item.deletedAt) continue
    const raw = String(item.category || '')
    const pairs = Object.fromEntries(
      raw.split(';').map((part) => {
        const i = part.indexOf('=')
        if (i < 0) return [part.trim(), '']
        return [part.slice(0, i).trim(), part.slice(i + 1).trim()]
      }).filter(([k]) => k),
    )
    if (String(pairs.recordType || '').trim().toLowerCase() !== 'product') continue
    const name = String(item.name || '').trim()
    if (!name || /^alloy$/i.test(name)) continue
    const key = name.toLowerCase()
    if (byKey.has(key)) continue
    const groupKey = String(pairs.mainStock || pairs.metalType || pairs.productCategory || 'other')
      .trim()
      .toLowerCase() || 'other'
    const purityRaw = pairs.productPurity || pairs.purity || item.purity || ''
    const purityNum = Number(purityRaw)
    let purityPct = ''
    if (Number.isFinite(purityNum) && purityNum > 0) {
      purityPct = purityNum > 0 && purityNum <= 1.2
        ? String(Math.round(purityNum * 100 * 1000) / 1000)
        : String(purityNum)
    }
    byKey.set(key, {
      id: String(item._id || item.id || key),
      name,
      metalGroupKey: groupKey,
      metalGroup: titleCaseMetalGroup(groupKey),
      purity: purityPct,
    })
  }
  return [...byKey.values()].sort((a, b) => {
    const byGroup = metalGroupSortIndex(a.metalGroupKey) - metalGroupSortIndex(b.metalGroupKey)
    if (byGroup !== 0) return byGroup
    const byLabel = String(a.metalGroup || '').localeCompare(String(b.metalGroup || ''))
    if (byLabel !== 0) return byLabel
    return a.name.localeCompare(b.name)
  })
}

export function groupVaultMetalOptions(options: VaultMetalProductOption[] = []) {
  const byGroup = new Map<string, { key: string; label: string; items: VaultMetalProductOption[] }>()
  for (const row of options) {
    const key = String(row?.metalGroupKey || 'other').toLowerCase()
    const label = row?.metalGroup || titleCaseMetalGroup(key)
    if (!byGroup.has(key)) byGroup.set(key, { key, label, items: [] })
    byGroup.get(key)!.items.push(row)
  }
  return [...byGroup.values()]
    .sort((a, b) => {
      const byOrder = metalGroupSortIndex(a.key) - metalGroupSortIndex(b.key)
      if (byOrder !== 0) return byOrder
      return a.label.localeCompare(b.label)
    })
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
}
