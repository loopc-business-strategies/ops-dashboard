import { DOMAIN_TAGS } from '../lib/loadContext.mjs'

export async function phase01InventoryDb(db, findings) {
  const phase = '01-inventory-db'
  const cols = await db.listCollections().toArray()
  const inventory = []
  let totalDocs = 0

  for (const col of cols.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
    const name = col.name
    if (name.startsWith('system.')) continue
    const collection = db.collection(name)
    const count = await collection.countDocuments({})
    totalDocs += count
    let indexes = []
    try {
      indexes = await collection.indexes()
    } catch {
      indexes = []
    }
    inventory.push({
      name,
      count,
      domains: DOMAIN_TAGS[name] || ['Other'],
      indexCount: indexes.length,
      indexes: indexes.map((i) => i.name),
    })
  }

  findings.add({
    domain: 'reports',
    phase,
    severity: 'INFORMATIONAL',
    code: 'DB_INVENTORY',
    message: `Inspected ${inventory.length} collections, ${totalDocs} total documents`,
    entity: { collections: inventory.length, documents: totalDocs },
  })

  return { collections: inventory, collectionCount: inventory.length, documentCount: totalDocs }
}
