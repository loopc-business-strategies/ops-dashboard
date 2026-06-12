/**
 * Run Gradle from mobile/android (no EAS). Usage:
 *   node scripts/gradle-android.mjs bundleRelease
 *   node scripts/gradle-android.mjs assembleRelease
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const androidDir = path.resolve(__dirname, '..', 'android')
const task = process.argv[2] || 'bundleRelease'

const isWin = process.platform === 'win32'
const cmd = isWin ? 'gradlew.bat' : './gradlew'
const result = spawnSync(cmd, [task], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
})

const code = result.status === null ? 1 : result.status
if (code !== 0) {
  console.error(`Gradle exited with code ${code} (task: ${task})`)
}
process.exit(code)
