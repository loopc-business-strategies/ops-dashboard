#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Upload backend/.env Mongo URIs to GitHub Actions secrets so the
 * provision-smoke-credentials workflow can reach tenant databases.
 */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const envPath = path.join(rootDir, 'backend', '.env')
const REPO = process.env.GITHUB_REPOSITORY || 'loopc-business-strategies/ops-dashboard'

function parseEnvFile(filePath) {
  const values = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    values[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return values
}

function runGh(args, input) {
  const result = spawnSync('gh', args, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error([result.stderr, result.stdout].filter(Boolean).join('\n').trim() || 'gh command failed')
  }
}

function main() {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}`)
  }
  if (!process.env.GH_TOKEN && spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', shell: true }).status !== 0) {
    throw new Error('GitHub CLI is not authenticated. Run gh auth login or set GH_TOKEN.')
  }

  const env = parseEnvFile(envPath)
  const keys = ['MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC']

  for (const key of keys) {
    const value = String(env[key] || '').trim()
    if (!value) throw new Error(`Missing ${key} in backend/.env`)
    runGh(['secret', 'set', key, '-R', REPO], `${value}\n`)
    console.log(`Set GitHub secret ${key}`)
  }

  console.log('Mongo URI secrets uploaded. Run: gh workflow run provision-smoke-credentials.yml')
}

main()
