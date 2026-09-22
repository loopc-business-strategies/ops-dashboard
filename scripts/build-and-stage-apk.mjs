#!/usr/bin/env node
/**
 * Build a release APK and stage a copy for tablet/phone sideload (no ADB).
 *
 * Usage (from repo root):
 *   npm run mg-factory:apk:tablet
 *   npm run mobile:apk:tablet
 *   node scripts/build-and-stage-apk.mjs --app mg-factory
 *   node scripts/build-and-stage-apk.mjs --app mg-factory --stage-only
 *   node scripts/build-and-stage-apk.mjs --app mg-factory --out "D:\share"
 *
 * After it finishes, copy the staged .apk onto the tablet (USB file transfer,
 * Drive, WhatsApp, etc.), open the file, tap Install.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const isWin = process.platform === 'win32'

/** @typedef {'mg-factory' | 'mobile' | 'mg-floor'} AppId */

/** @type {Record<AppId, { label: string, packageDir: string, apkRel: string, winBuildCmd: string | null, npmBuild: string, typecheck: string | null, stagedName: string }>} */
const APPS = {
  'mg-factory': {
    label: 'MG Factory',
    packageDir: 'mg-factory',
    apkRel: path.join('mg-factory', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    winBuildCmd: path.join('scripts', 'build-mg-factory-apk-subst-q.cmd'),
    npmBuild: 'mg-factory:build:android:local:apk',
    typecheck: 'typecheck:mg-factory',
    stagedName: 'mg-factory-release.apk',
  },
  mobile: {
    label: 'Nexa mobile',
    packageDir: 'mobile',
    apkRel: path.join('mobile', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    winBuildCmd: path.join('scripts', 'build-mobile-apk-subst-q.cmd'),
    npmBuild: 'mobile:build:android:local:apk',
    typecheck: 'typecheck:mobile',
    stagedName: 'nexa-mobile-release.apk',
  },
  'mg-floor': {
    label: 'MG Floor',
    packageDir: 'mg-floor',
    apkRel: path.join('mg-floor', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    winBuildCmd: path.join('scripts', 'build-mg-floor-apk-subst-q.cmd'),
    npmBuild: 'mg-floor:build:android:local:apk',
    typecheck: 'typecheck:mg-floor',
    stagedName: 'mg-floor-release.apk',
  },
}

function parseArgs(argv) {
  /** @type {AppId} */
  let app = 'mg-factory'
  let stageOnly = false
  /** @type {string | null} */
  let outDir = null
  let skipTypecheck = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--app' && argv[i + 1]) {
      app = /** @type {AppId} */ (argv[i + 1])
      i += 1
    } else if (arg === '--stage-only') {
      stageOnly = true
    } else if (arg === '--skip-typecheck') {
      skipTypecheck = true
    } else if (arg === '--out' && argv[i + 1]) {
      outDir = argv[i + 1]
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  if (!APPS[app]) {
    console.error(`Unknown --app ${app}. Use: mg-factory | mobile | mg-floor`)
    process.exit(1)
  }

  return { app, stageOnly, outDir, skipTypecheck }
}

function printHelp() {
  console.log(`Build release APK + copy to Desktop/dist for tablet sideload (no ADB).

Usage:
  node scripts/build-and-stage-apk.mjs --app <mg-factory|mobile|mg-floor> [options]

Options:
  --stage-only       Skip build; only copy an existing APK
  --skip-typecheck   Skip npm typecheck before build
  --out <dir>        Extra destination folder (in addition to dist/apk + Desktop)
`)
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string }} [opts]
 */
function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd || repoRoot,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
  })
  const code = result.status === null ? 1 : result.status
  if (result.error) {
    console.error(result.error)
  }
  if (code !== 0) {
    process.exit(code)
  }
}

/**
 * @param {string} filePath
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

/**
 * Resolve APK: repo tree first, then C:\\mgf for factory Windows builds.
 * @param {AppId} appId
 */
function resolveApkSource(appId) {
  const cfg = APPS[appId]
  const candidates = [path.join(repoRoot, cfg.apkRel)]
  if (appId === 'mg-factory') {
    candidates.push(
      path.join('C:\\mgf', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    )
  }
  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate
  }
  return null
}

/**
 * @param {string} src
 * @param {string} dest
 */
function copyApk(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2)
  console.log(`Copied (${mb} MB):\n  ${dest}`)
}

/**
 * @param {AppId} appId
 * @param {boolean} skipTypecheck
 */
function buildApk(appId, skipTypecheck) {
  const cfg = APPS[appId]

  if (!skipTypecheck && cfg.typecheck) {
    console.log(`\n==> Typecheck (${cfg.label})`)
    run('npm', ['run', cfg.typecheck])
  }

  console.log(`\n==> Build release APK (${cfg.label})`)
  const winCmd = cfg.winBuildCmd ? path.join(repoRoot, cfg.winBuildCmd) : null
  if (isWin && winCmd && fileExists(winCmd)) {
    run('cmd.exe', ['/d', '/c', winCmd])
  } else {
    run('npm', ['run', cfg.npmBuild])
  }
}

/**
 * @param {AppId} appId
 * @param {string | null} extraOut
 */
function stageApk(appId, extraOut) {
  const cfg = APPS[appId]
  const src = resolveApkSource(appId)
  if (!src) {
    console.error(`APK not found for ${cfg.label}. Expected:`)
    console.error(`  ${path.join(repoRoot, cfg.apkRel)}`)
    if (appId === 'mg-factory') {
      console.error('  C:\\mgf\\android\\app\\build\\outputs\\apk\\release\\app-release.apk')
    }
    console.error('\nRun without --stage-only to build first.')
    process.exit(1)
  }

  console.log(`\n==> Stage APK for tablet (no ADB)\nSource:\n  ${src}`)

  const dests = [
    path.join(repoRoot, 'dist', 'apk', cfg.stagedName),
    path.join(os.homedir(), 'Desktop', cfg.stagedName),
  ]
  if (extraOut) {
    dests.push(path.join(path.resolve(extraOut), cfg.stagedName))
  }

  for (const dest of dests) {
    try {
      copyApk(src, dest)
    } catch (err) {
      console.warn(`Skip ${dest}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`
Next (on the tablet — no ADB):
  1. USB: phone/tablet File Transfer → copy Desktop\\${cfg.stagedName} to Downloads
     OR upload Desktop\\${cfg.stagedName} to Drive / WhatsApp / email
  2. On device: open the APK → Allow install unknown apps → Install
`)
}

const { app, stageOnly, outDir, skipTypecheck } = parseArgs(process.argv.slice(2))

if (!stageOnly) {
  buildApk(app, skipTypecheck)
}
stageApk(app, outDir)
