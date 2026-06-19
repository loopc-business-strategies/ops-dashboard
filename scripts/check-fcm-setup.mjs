#!/usr/bin/env node
/** Verify local Android FCM file exists before release APK push testing. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'mobile', 'android', 'app', 'google-services.json')
const example = path.join(root, 'mobile', 'android', 'app', 'google-services.json.example')

if (fs.existsSync(target)) {
  console.log('✔ google-services.json present at mobile/android/app/')
  process.exit(0)
}

console.error('✗ google-services.json missing — background push on release APK will not work.')
console.error('  Copy from Firebase Console → Android app com.loopc.mg.ops')
console.error(`  Example structure: ${path.relative(root, example)}`)
console.error('  See docs/MOBILE-ANDROID-PUSH-FCM.md')
process.exit(1)
