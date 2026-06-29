import { spawnSync } from 'node:child_process'

function runGitLsFiles() {
  const attempts = [
    () => spawnSync('git', ['ls-files'], { encoding: 'utf8' }),
    () => spawnSync('git ls-files', { encoding: 'utf8', shell: true }),
  ]

  for (const attempt of attempts) {
    const result = attempt()
    if (result.status === 0 && typeof result.stdout === 'string') {
      return result.stdout
    }
  }

  console.error('Forbidden tracked path check failed: git is unavailable in this shell.')
  console.error('Install git, ensure it is on PATH, and run from a git checkout.')
  process.exit(1)
}

const trackedFileOutput = runGitLsFiles()

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
  { label: 'mobile android build output', pattern: /^mobile\/android\/(app\/)?build\// },
  { label: 'mobile android gradle cache', pattern: /^mobile\/android\/\.gradle\// },
  { label: 'coverage output', pattern: /(^|\/)coverage\// },
  { label: 'backup artifacts', pattern: /^backup-artifacts\// },
  { label: 'playwright test results', pattern: /(^|\/)test-results\// },
  { label: 'playwright report', pattern: /(^|\/)playwright-report\// },
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
