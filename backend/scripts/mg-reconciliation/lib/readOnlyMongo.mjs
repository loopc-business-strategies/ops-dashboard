/**
 * Write-blocking Mongo DB/Collection proxy for MG reconciliation audits.
 * Allowed: find, findOne, aggregate, countDocuments, distinct, listCollections, indexes, stats.
 */
import mongoose from 'mongoose'
import dns from 'dns'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const require = createRequire(import.meta.url)

const WRITE_METHODS = new Set([
  'insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'bulkWrite', 'drop', 'dropDatabase', 'rename', 'renameCollection',
  'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes',
  'findAndModify', 'remove', 'save', 'update',
])

const ALLOWED_COLLECTION = new Set([
  'find', 'findOne', 'aggregate', 'countDocuments', 'distinct',
  'indexes', 'listIndexes', 'estimatedDocumentCount',
  'stats', // may not exist on Collection in all drivers; guarded below
])

function blockWrite(methodName) {
  throw new Error(
    `[MG-RECONCILIATION READ-ONLY] Blocked database write: ${methodName}. `
    + 'This audit must never modify the database.',
  )
}

function wrapCollection(collection) {
  return new Proxy(collection, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver)
      const name = String(prop)
      if (WRITE_METHODS.has(name)) {
        return () => blockWrite(name)
      }
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        if (!ALLOWED_COLLECTION.has(name) && !['constructor', 'toString', 'valueOf'].includes(name)) {
          // Allow cursor-related helpers used after find(); block unknown mutators by name heuristic
          if (/^(insert|update|delete|drop|replace|bulk|create|rename)/i.test(name)) {
            return () => blockWrite(name)
          }
        }
        return value.bind(target)
      }
      return value
    },
  })
}

function wrapDb(db) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver)
      const name = String(prop)
      if (WRITE_METHODS.has(name)) {
        return () => blockWrite(name)
      }
      if (name === 'collection') {
        return (collName, options) => wrapCollection(target.collection(collName, options))
      }
      if (name === 'listCollections') {
        return (...args) => target.listCollections(...args)
      }
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') return value.bind(target)
      return value
    },
  })
}

/**
 * Connect to MG tenant URI. Returns { conn, db, dbName, close }.
 * Never logs the URI or password.
 */
export async function connectMgReadOnly() {
  const uri = process.env.MONGO_URI_MG
  if (!uri) {
    throw new Error('Missing MONGO_URI_MG — set tenant Mongo URI for mg (database path should be ops_mg).')
  }

  dns.setServers(
    (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 120000,
  }).asPromise()

  const client = conn.getClient()
  let rawDb = client.db()
  let dbName = rawDb.databaseName
  const preferred = String(process.env.MG_RECON_DB || '').trim()

  // Optional override: MG_RECON_DB=ops_mg (or other) on the same cluster.
  // Default = URI path DB (what the running MG tenant API uses).
  if (preferred && preferred !== dbName) {
    rawDb = client.db(preferred)
    dbName = preferred
  }

  const db = wrapDb(rawDb)

  return {
    conn,
    db,
    dbName,
    uriDefaultDb: client.db().databaseName,
    readOnly: true,
    async close() {
      await conn.close()
    },
  }
}

export { WRITE_METHODS, wrapDb, wrapCollection }
