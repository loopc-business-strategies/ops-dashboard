#!/usr/bin/env node
/**
 * mongodump all tenant databases and upload gzip archives to S3-compatible storage.
 * Requires: mongodump + aws CLI on PATH (or dry-run mode).
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

dns.setServers(
  (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
})

const TENANTS = [
  { key: 'mg', uriKey: 'MONGO_URI_MG' },
  { key: 'cg', uriKey: 'MONGO_URI_CG' },
  { key: 'loopc', uriKey: 'MONGO_URI_LOOPC' },
]

const dryRun = process.argv.includes('--dry-run')
const retainDays = Number(process.env.BACKUP_RETAIN_DAYS || 7)

function requireEnv(key) {
  const value = String(process.env[key] || '').trim()
  if (!value && !dryRun) throw new Error(`${key} is not set`)
  return value
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').slice(0, 400)}`)
  }
  return result
}

function s3UriFor(tenantKey, dateStamp) {
  const bucket = requireEnv('BACKUP_S3_BUCKET')
  const prefix = String(process.env.BACKUP_S3_PREFIX || 'ops-dashboard').replace(/\/$/, '')
  return `s3://${bucket}/${prefix}/${tenantKey}/${dateStamp}/archive.gz`
}

function uploadToS3(localPath, s3Uri) {
  const endpoint = String(process.env.BACKUP_S3_ENDPOINT || '').trim()
  const region = String(process.env.BACKUP_S3_REGION || 'auto').trim()
  const args = ['s3', 'cp', localPath, s3Uri, '--only-show-errors']
  if (endpoint) {
    args.push('--endpoint-url', endpoint)
  }
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: requireEnv('BACKUP_S3_ACCESS_KEY'),
    AWS_SECRET_ACCESS_KEY: requireEnv('BACKUP_S3_SECRET_KEY'),
    AWS_DEFAULT_REGION: region,
  }
  run('aws', args, { env })
}

function pruneOldBackups(tenantKey) {
  const bucket = requireEnv('BACKUP_S3_BUCKET')
  const prefix = String(process.env.BACKUP_S3_PREFIX || 'ops-dashboard').replace(/\/$/, '')
  const listPrefix = `${prefix}/${tenantKey}/`
  const endpoint = String(process.env.BACKUP_S3_ENDPOINT || '').trim()
  const region = String(process.env.BACKUP_S3_REGION || 'auto').trim()

  const listArgs = ['s3', 'ls', `s3://${bucket}/${listPrefix}`, '--recursive']
  if (endpoint) listArgs.push('--endpoint-url', endpoint)

  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: requireEnv('BACKUP_S3_ACCESS_KEY'),
    AWS_SECRET_ACCESS_KEY: requireEnv('BACKUP_S3_SECRET_KEY'),
    AWS_DEFAULT_REGION: region,
  }

  const result = spawnSync('aws', listArgs, { encoding: 'utf8', env })
  if (result.status !== 0) return

  const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000
  const lines = (result.stdout || '').split(/\r?\n/).filter(Boolean)
  for (const line of lines) {
    const match = line.match(/\s(\d{4}-\d{2}-\d{2})\//)
    if (!match) continue
    const folderDate = new Date(match[1]).getTime()
    if (Number.isFinite(folderDate) && folderDate < cutoff) {
      const key = line.split(/\s+/).pop()
      if (!key) continue
      const rmArgs = ['s3', 'rm', `s3://${bucket}/${key}`, '--recursive', '--only-show-errors']
      if (endpoint) rmArgs.push('--endpoint-url', endpoint)
      spawnSync('aws', rmArgs, { env })
    }
  }
}

async function main() {
  console.log(`MongoDB tenant backup${dryRun ? ' (dry-run)' : ''}\n`)

  if (dryRun) {
    for (const { key, uriKey } of TENANTS) {
      const set = Boolean(String(process.env[uriKey] || '').trim())
      console.log(`  ${key}: ${uriKey} ${set ? 'set' : 'missing'}`)
    }
    console.log(`  BACKUP_S3_BUCKET: ${process.env.BACKUP_S3_BUCKET ? 'set' : 'missing'}`)
    console.log(`  BACKUP_S3_ACCESS_KEY: ${process.env.BACKUP_S3_ACCESS_KEY ? 'set' : 'missing'}`)
    console.log('\nDry-run OK — set secrets and run without --dry-run to upload dumps.')
    return
  }

  run('mongodump', ['--version'])
  run('aws', ['--version'])

  const dateStamp = new Date().toISOString().slice(0, 10)
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-mongodump-'))

  try {
    for (const { key, uriKey } of TENANTS) {
      const uri = requireEnv(uriKey)
      const archivePath = path.join(tmpRoot, `${key}-${dateStamp}.archive.gz`)
      process.stdout.write(`  ${key} mongodump... `)
      run('mongodump', ['--uri', uri, '--gzip', `--archive=${archivePath}`])
      const sizeMb = (fs.statSync(archivePath).size / (1024 * 1024)).toFixed(2)
      console.log(`OK (${sizeMb} MB)`)

      const s3Uri = s3UriFor(key, dateStamp)
      process.stdout.write(`  ${key} upload ${s3Uri}... `)
      uploadToS3(archivePath, s3Uri)
      console.log('OK')

      pruneOldBackups(key)
    }
    console.log('\nAll tenant backups uploaded.')
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`)
  process.exit(1)
})
