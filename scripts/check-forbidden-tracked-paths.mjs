import { spawnSync } from 'node:child_process'

function getTrackedFiles() {
  const result = spawnSync('git', ['ls-files'], { encoding: 'utf8' })

  // Some WSL/Node combinations report EPERM even when the child process
  // completed successfully. Trust the process status over the wrapper error.
  if (result.error && result.status !== 0) {
    throw result.error
  }

  if (result.status !== 0) {
    const message = result.stderr || result.error?.message || 'git ls-files failed.'
    throw new Error(message.trim())
  }

  return result.stdout || ''
}

const trackedFiles = getTrackedFiles()
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
