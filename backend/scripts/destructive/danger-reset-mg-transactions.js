#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename, allowDryRunNoApply: true })
/*
 * Guarded MG transaction/ledger reset.
 *
 * Default mode is dry-run. This script never touches chart of accounts or users.
 * It can only delete transactions and ledgers when every destructive guard is
 * explicitly provided.
 */

require('dotenv').config()
const mongoose = require('mongoose')

const CONFIRM_TOKEN = 'DELETE_MG_TRANSACTIONS_AND_LEDGERS'

function hasArg(name) {
  return process.argv.includes(name)
}

function getArgValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

async function main() {
  const mongoUri = String(process.env.MONGO_URI_MG || '').trim()
  if (!mongoUri) {
    throw new Error('Missing MONGO_URI_MG. Refusing to use any fallback database URI.')
  }

  const apply = hasArg('--apply')
  const confirm = getArgValue('--confirm=')
  const allowReset = String(process.env.ALLOW_MG_DESTRUCTIVE_RESET || '').toLowerCase() === 'true'

  console.log('MG transaction/ledger reset guard')
  console.log(`Mode: ${apply ? 'apply requested' : 'dry-run'}`)
  console.log('Scope: transactions and ledgers only. Users and chart of accounts are not touched.')

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })

  const db = mongoose.connection.db
  const [transactionCount, ledgerCount, accountCount, userCount] = await Promise.all([
    db.collection('transactions').countDocuments({}),
    db.collection('ledgers').countDocuments({}),
    db.collection('chartofaccounts').countDocuments({}),
    db.collection('users').countDocuments({}),
  ])

  console.log('Dry-run counts:')
  console.log(`  transactions: ${transactionCount}`)
  console.log(`  ledgers: ${ledgerCount}`)
  console.log(`  chartofaccounts: ${accountCount} (not touched)`)
  console.log(`  users: ${userCount} (not touched)`)

  if (!apply) {
    console.log('')
    console.log('Dry-run only. No data was changed.')
    console.log(`To execute, set ALLOW_MG_DESTRUCTIVE_RESET=true and pass --apply --confirm=${CONFIRM_TOKEN}`)
    return
  }

  if (!allowReset) {
    throw new Error('Refusing apply mode. Set ALLOW_MG_DESTRUCTIVE_RESET=true to continue.')
  }

  if (confirm !== CONFIRM_TOKEN) {
    throw new Error(`Refusing apply mode. Expected --confirm=${CONFIRM_TOKEN}`)
  }

  const [txResult, ledgerResult] = await Promise.all([
    db.collection('transactions').deleteMany({}),
    db.collection('ledgers').deleteMany({}),
  ])

  console.log('Destructive reset completed:')
  console.log(`  deleted transactions: ${txResult.deletedCount || 0}`)
  console.log(`  deleted ledgers: ${ledgerResult.deletedCount || 0}`)
  console.log('  chartofaccounts: not touched')
  console.log('  users: not touched')
}

main()
  .catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {})
  })
