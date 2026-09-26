/** Shared load of ERP collections for MG audit (read-only). */

const NOT_DELETED = { isDeleted: { $ne: true } }

const DOMAIN_TAGS = {
  transactions: ['Accounting', 'ERP', 'Sales', 'Purchase'],
  ledgers: ['Accounting', 'ERP', 'Reports'],
  chartofaccounts: ['Accounting', 'ERP', 'Reports'],
  accountmappings: ['Accounting', 'ERP'],
  accountingperiods: ['Accounting'],
  accountingcontrols: ['Accounting'],
  inventoryitems: ['Inventory', 'Metal', 'ERP'],
  stockmovements: ['Inventory', 'Metal', 'ERP'],
  productionstocklots: ['Inventory', 'Metal', 'Production'],
  metalrates: ['Metal'],
  directdeals: ['Metal', 'Accounting'],
  metalmovements: ['Metal', 'Production'],
  customers: ['Customers', 'Sales'],
  vendors: ['Vendors', 'Purchase'],
  currencies: ['FX', 'Accounting'],
  financetaxes: ['VAT'],
}

export async function loadAuditContext(db) {
  const [
    transactions,
    ledgers,
    accounts,
    mappings,
    periods,
    inventoryItems,
    stockMovements,
    productionLots,
    customers,
    vendors,
    currencies,
    directDeals,
    metalMovements,
  ] = await Promise.all([
    db.collection('transactions').find(NOT_DELETED).toArray(),
    db.collection('ledgers').find(NOT_DELETED).toArray(),
    db.collection('chartofaccounts').find({}).toArray(),
    db.collection('accountmappings').find({}).toArray(),
    db.collection('accountingperiods').find({}).toArray().catch(() => []),
    db.collection('inventoryitems').find(NOT_DELETED).toArray(),
    db.collection('stockmovements').find(NOT_DELETED).toArray(),
    db.collection('productionstocklots').find(NOT_DELETED).toArray().catch(() => []),
    db.collection('customers').find(NOT_DELETED).toArray().catch(() => []),
    db.collection('vendors').find(NOT_DELETED).toArray().catch(() => []),
    db.collection('currencies').find({}).toArray().catch(() => []),
    db.collection('directdeals').find({}).toArray().catch(() => []),
    db.collection('metalmovements').find({}).toArray().catch(() => []),
  ])

  const mappingsActive = (mappings || []).filter((m) => m.isDeleted !== true)
  const accountById = new Map(accounts.map((a) => [String(a._id), a]))
  const accountByCode = new Map(accounts.map((a) => [String(a.accountCode || '').trim(), a]))
  const txById = new Map(transactions.map((t) => [String(t._id), t]))
  const itemById = new Map(inventoryItems.map((i) => [String(i._id), i]))

  const ledgersByRef = new Map()
  for (const row of ledgers) {
    if (!row.referenceId) continue
    const key = String(row.referenceId)
    if (!ledgersByRef.has(key)) ledgersByRef.set(key, [])
    ledgersByRef.get(key).push(row)
  }

  const movesByItem = new Map()
  for (const m of stockMovements) {
    const key = String(m.itemId || '')
    if (!movesByItem.has(key)) movesByItem.set(key, [])
    movesByItem.get(key).push(m)
  }

  const postedTx = transactions.filter((t) => String(t.status || '').toLowerCase() === 'posted')

  return {
    NOT_DELETED,
    DOMAIN_TAGS,
    transactions,
    ledgers,
    accounts,
    mappings: mappingsActive,
    periods,
    inventoryItems,
    stockMovements,
    productionLots: productionLots || [],
    customers: customers || [],
    vendors: vendors || [],
    currencies: currencies || [],
    directDeals: (directDeals || []).filter((d) => d.isDeleted !== true),
    metalMovements: (metalMovements || []).filter((m) => m.isDeleted !== true),
    accountById,
    accountByCode,
    txById,
    itemById,
    ledgersByRef,
    movesByItem,
    postedTx,
  }
}

export { DOMAIN_TAGS, NOT_DELETED }
