#!/usr/bin/env node
/**
 * Trigger mobile GitHub Actions workflows (requires gh auth or GH_TOKEN).
 * Usage:
 *   npm run mobile:release:android
 *   npm run mobile:release:ios
 */
import { spawnSync } from 'node:child_process'

const target = process.argv[2] || 'android'

const workflows = {
  android: {
    file: 'mobile-android-bundle.yml',
    name: 'Mobile Android bundle (local Gradle)',
  },
  ios: {
    file: 'mobile-ios-testflight.yml',
    name: 'Mobile iOS (GitHub macOS)',
    inputs: ['upload_testflight=true'],
  },
}

const spec = workflows[target]
if (!spec) {
  console.error(`Unknown target "${target}". Use: android | ios`)
  process.exit(1)
}

function runGh(args) {
  return spawnSync('gh', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
}

const auth = spawnSync('gh', ['auth', 'status'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
if (auth.status !== 0 && !process.env.GH_TOKEN) {
  console.error('GitHub CLI not authenticated. Run: gh auth login')
  console.error('Or set GH_TOKEN with workflow scope.')
  process.exit(1)
}

console.log(`Dispatching: ${spec.name}`)
const args = ['workflow', 'run', spec.file, '--ref', 'main']
if (spec.inputs) {
  for (const pair of spec.inputs) {
    const [key, value] = pair.split('=')
    args.push('-f', `${key}=${value}`)
  }
}

const result = runGh(args)
if (result.status !== 0) process.exit(result.status || 1)

console.log('\nWorkflow dispatched. Watch: GitHub → Actions')
console.log('Audit secrets first: npm run check:mobile-release-secrets')
