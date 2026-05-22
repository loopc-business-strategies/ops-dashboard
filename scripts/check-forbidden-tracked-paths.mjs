import { spawnSync } from 'node:child_process'

function getTrackedFiles() {
  let result = spawnSync('git', ['ls-files'], { encoding: 'utf8' })

  if (result.error?.code === 'EPERM' && process.platform === 'win32') {
    result = spawnSync('git ls-files', { encoding: 'utf8', shell: true })
  }

  // Some WSL/Node combinations report EPERM even when the child process
  // completed successfully. Trust the process status over the wrapper error.
  if (result.error && result.status !== 0) {
    if (result.error.code === 'EPERM') {
      console.warn('Forbidden tracked path check skipped: git could not be spawned in this shell.')
      return null
    }
    throw result.error
  }

  if (result.status !== 0) {
    const message = result.stderr || result.error?.message || 'git ls-files failed.'
    throw new Error(message.trim())
  }

  return result.stdout || ''
}

const trackedFileOutput = getTrackedFiles()
if (trackedFileOutput === null) process.exit(0)

const trackedFiles = trackedFileOutput
  .split(/\r?\n/)
  .filter(Boolean)

const forbiddenPatterns = [
  { label: 'environment files', pattern: /(^|\/)\.env$/ },
  { label: 'local env files', pattern: /(^|\/)\.env(\.[^/]*)?\.local$/ },
  { label: 'backend uploads', pattern: /^backend\/uploads\// },
  { label: 'backend reports', pattern: /^backend\/reports\// },
  { label: 'backend logs', pattern: /^backend\/logs\// },
  { label: 'frontend build output', pattern: /^frontend\/dist\// },
  { label: 'coverage output', pattern: /(^|\/)coverage\// },
]

const violations = trackedFiles
  .map((file) => ({
    file,
    rule: forbiddenPatterns.find((entry) => entry.pattern.test(file)),
  }))
  .filter((entry) => entry.rule)

if (violations.length) {
  console.error('Forbidden generated or sensitive paths are tracked:')
  for (const { file, rule } of violations) {
    console.error(`- ${file} (${rule.label})`)
  }
  console.error('\nRemove these from the git index and keep them ignored.')
  process.exit(1)
}

console.log('Forbidden tracked path check passed.')
