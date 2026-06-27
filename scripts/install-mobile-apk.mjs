#!/usr/bin/env node
/**
 * Install Nexa Android release APK on a connected device via ADB.
 * Usage: npm run mobile:install:apk [-- --path <apk>] [-- --serial <device-id>]
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const defaultApkCandidates = [
  path.join(repoRoot, 'dist', 'apk', 'app-release.apk'),
  path.join(
    repoRoot,
    'mobile',
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk',
  ),
]

function parseArgs(argv) {
  let apkPath = null
  let serial = null
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--path' && argv[i + 1]) {
      apkPath = argv[i + 1]
      i += 1
    } else if (arg === '--serial' && argv[i + 1]) {
      serial = argv[i + 1]
      i += 1
    }
  }
  return { apkPath, serial }
}

function adbExecutableName() {
  return process.platform === 'win32' ? 'adb.exe' : 'adb'
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function resolveAdbBin() {
  const name = adbExecutableName()
  const onPath = spawnSync('adb', ['version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (onPath.status === 0) return 'adb'

  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
      : null,
  ].filter(Boolean)

  for (const root of sdkRoots) {
    const candidate = path.join(root, 'platform-tools', name)
    if (fileExists(candidate)) return candidate
  }

  return null
}

function resolveApkPath(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath)
    if (!fileExists(resolved)) {
      console.error(`APK not found: ${resolved}`)
      process.exit(1)
    }
    return resolved
  }

  for (const candidate of defaultApkCandidates) {
    if (fileExists(candidate)) return candidate
  }

  console.error('No APK found. Expected one of:')
  for (const candidate of defaultApkCandidates) {
    console.error(`  ${candidate}`)
  }
  console.error('\nDownload CI build:  npm run mobile:download:apk')
  console.error('Or build locally:    npm run mobile:build:android:local:apk')
  process.exit(1)
}

function runAdb(adbBin, args, { inherit = false } = {}) {
  return spawnSync(adbBin, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
    stdio: inherit ? 'inherit' : 'pipe',
  })
}

function parseDevices(output) {
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, ...rest] = line.split(/\s+/)
      return { id, state: rest.join(' ') }
    })
}

function checkDevices(adbBin, serial) {
  const result = runAdb(adbBin, ['devices'])
  if (result.status !== 0) {
    console.error((result.stderr || result.stdout || '').trim() || 'adb devices failed')
    process.exit(result.status || 1)
  }

  const devices = parseDevices(result.stdout || '')
  const ready = devices.filter((d) => d.state === 'device')
  const unauthorized = devices.filter((d) => d.state === 'unauthorized')
  const offline = devices.filter((d) => d.state === 'offline')

  if (serial) {
    const target = devices.find((d) => d.id === serial)
    if (!target) {
      console.error(`Device not found: ${serial}`)
      console.error('Connected devices:')
      for (const d of devices) console.error(`  ${d.id}\t${d.state}`)
      process.exit(1)
    }
    if (target.state === 'unauthorized') {
      console.error('Device is unauthorized. Accept the USB debugging prompt on the phone, then retry.')
      process.exit(1)
    }
    if (target.state !== 'device') {
      console.error(`Device ${serial} is ${target.state}. Reconnect USB and retry.`)
      process.exit(1)
    }
    return
  }

  if (unauthorized.length > 0) {
    console.error('Device is unauthorized. Accept the USB debugging prompt on the phone, then retry.')
    process.exit(1)
  }

  if (offline.length > 0 && ready.length === 0) {
    console.error('Device is offline. Reconnect USB and retry.')
    process.exit(1)
  }

  if (ready.length === 0) {
    console.error('No Android device connected.')
    console.error('Enable Developer options → USB debugging, connect USB, then run: adb devices')
    process.exit(1)
  }

  if (ready.length > 1) {
    console.error('Multiple devices connected. Pass --serial <device-id>:')
    for (const d of ready) console.error(`  ${d.id}`)
    process.exit(1)
  }
}

const { apkPath: explicitApk, serial } = parseArgs(process.argv.slice(2))
const adbBin = resolveAdbBin()
if (!adbBin) {
  console.error('adb not found. Install Android SDK platform-tools and add to PATH, or set ANDROID_HOME.')
  console.error('https://developer.android.com/tools/releases/platform-tools')
  process.exit(1)
}

const version = runAdb(adbBin, ['version'])
if (version.status !== 0) {
  console.error((version.stderr || version.stdout || '').trim() || 'adb version failed')
  process.exit(version.status || 1)
}

checkDevices(adbBin, serial)

const apkPath = resolveApkPath(explicitApk)
console.log(`Installing:\n  ${apkPath}`)

const installArgs = ['install', '-r']
if (serial) installArgs.push('-s', serial)
installArgs.push(apkPath)

const install = runAdb(adbBin, installArgs, { inherit: true })
if (install.status !== 0) {
  console.error(
    '\nIf you see INSTALL_FAILED_UPDATE_INCOMPATIBLE, uninstall the old app (signing key changed) and retry.',
  )
  process.exit(install.status || 1)
}

console.log('\nAPK installed successfully.')
