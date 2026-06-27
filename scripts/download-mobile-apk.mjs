#!/usr/bin/env node
/**
 * Download the latest successful nexa-android-release-apk artifact from GitHub Actions.
 * Usage: npm run mobile:download:apk
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outDir = path.join(repoRoot, 'dist', 'apk')
const workflowFile = 'mobile-android-bundle.yml'
const artifactName = 'nexa-android-release-apk'

function ghBin() {
  if (process.platform === 'win32') {
    const candidate = 'C:\\Program Files\\GitHub CLI\\gh.exe'
    if (fs.existsSync(candidate)) return candidate
  }
  return 'gh'
}

function runGh(args, { json = false } = {}) {
  const result = spawnSync(ghBin(), args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim()
    console.error(err || `gh ${args.join(' ')} failed`)
    process.exit(result.status || 1)
  }
  return json ? JSON.parse(result.stdout) : result.stdout.trim()
}

const auth = spawnSync(ghBin(), ['auth', 'status'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
if (auth.status !== 0 && !process.env.GH_TOKEN) {
  console.error('GitHub CLI not authenticated. Run: gh auth login')
  process.exit(1)
}

const runs = runGh(
  [
    'run',
    'list',
    '--workflow',
    workflowFile,
    '--branch',
    'main',
    '--limit',
    '20',
    '--json',
    'databaseId,status,conclusion,displayTitle,createdAt',
  ],
  { json: true },
)

const success = runs.find((run) => run.status === 'completed' && run.conclusion === 'success')
if (!success) {
  const inProgress = runs.find((run) => run.status === 'in_progress' || run.status === 'queued')
  if (inProgress) {
    console.error(
      `No successful APK build yet. Run ${inProgress.databaseId} is still ${inProgress.status}.`,
    )
    console.error(`Watch: gh run watch ${inProgress.databaseId}`)
    console.error('Then re-run: npm run mobile:download:apk')
  } else {
    const failed = runs.find((run) => run.status === 'completed')
    console.error('No successful Android bundle run found on main.')
    if (failed) {
      console.error(`Latest run ${failed.databaseId} ended with: ${failed.conclusion}`)
    }
    console.error('Trigger a build: npm run mobile:release:android')
  }
  process.exit(1)
}

if (fs.existsSync(outDir)) {
  for (const entry of fs.readdirSync(outDir)) {
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true })
  }
} else {
  fs.mkdirSync(outDir, { recursive: true })
}

console.log(`Downloading ${artifactName} from run ${success.databaseId} (${success.displayTitle})`)
const download = spawnSync(
  ghBin(),
  ['run', 'download', String(success.databaseId), '-n', artifactName, '-D', outDir],
  { stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
)
if (download.status !== 0) process.exit(download.status || 1)

const apkPath = path.join(outDir, 'app-release.apk')
if (!fs.existsSync(apkPath)) {
  const files = fs.readdirSync(outDir, { recursive: true })
  const apk = files.find((f) => String(f).endsWith('.apk'))
  if (apk) {
    console.log(`\nAPK downloaded:\n  ${path.join(outDir, apk)}`)
  } else {
    console.error(`Download finished but no .apk found under ${outDir}`)
    process.exit(1)
  }
} else {
  console.log(`\nAPK downloaded:\n  ${apkPath}`)
}
