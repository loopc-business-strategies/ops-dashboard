require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const SOURCE_URI = process.env.MONGO_URI_LOOPC || process.env.MONGO_URI
const TARGET_URI = process.env.MONGO_URI_MG
const BATCH_SIZE = 500

async function copyCollectionData(sourceDb, targetDb, collectionName) {
  const sourceCollection = sourceDb.collection(collectionName)
  const targetCollection = targetDb.collection(collectionName)

  let inserted = 0
  let batch = []

  const cursor = sourceCollection.find({})
  try {
    for await (const doc of cursor) {
      const clone = { ...doc }
      delete clone.__v
      batch.push(clone)

      if (batch.length >= BATCH_SIZE) {
        await targetCollection.insertMany(batch, { ordered: false })
        inserted += batch.length
        batch = []
      }
    }

    if (batch.length) {
      await targetCollection.insertMany(batch, { ordered: false })
      inserted += batch.length
    }
  } finally {
    await cursor.close()
  }

  return inserted
}

async function recreateIndexes(sourceDb, targetDb, collectionName) {
  const sourceIndexes = await sourceDb.collection(collectionName).indexes()
  for (const index of sourceIndexes) {
    if (index.name === '_id_') continue
    const { key, name, ...options } = index
    await targetDb.collection(collectionName).createIndex(key, { name, ...options })
  }
}

async function main() {
  if (!SOURCE_URI || !TARGET_URI) {
    throw new Error('MONGO_URI_LOOPC (source) and MONGO_URI_MG (target) are required in backend/.env')
  }

  const sourceConn = await mongoose.createConnection(SOURCE_URI, { autoIndex: false }).asPromise()
  const targetConn = await mongoose.createConnection(TARGET_URI, { autoIndex: false }).asPromise()

  try {
    const sourceDb = sourceConn.db
    const targetDb = targetConn.db

    const sourceCollections = await sourceDb.listCollections({}, { nameOnly: true }).toArray()
    const sourceNames = sourceCollections
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'))

    const targetCollections = await targetDb.listCollections({}, { nameOnly: true }).toArray()
    const targetNames = targetCollections
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'))

    for (const name of targetNames) {
      await targetDb.collection(name).drop()
      console.log(`Dropped target collection: ${name}`)
    }

    const summary = []
    for (const name of sourceNames) {
      await targetDb.createCollection(name)
      const inserted = await copyCollectionData(sourceDb, targetDb, name)
      await recreateIndexes(sourceDb, targetDb, name)
      summary.push({ name, inserted })
      console.log(`Copied ${name}: inserted=${inserted}`)
    }

    console.log('Copy completed (FULL clone mode).')
    console.log(`Source DB: ${sourceConn.name}`)
    console.log(`Target DB: ${targetConn.name}`)
    console.log(`Collections copied: ${summary.length}`)
  } finally {
    await sourceConn.close()
    await targetConn.close()
  }
}

main().catch((err) => {
  console.error('Copy failed:', err.message)
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })
