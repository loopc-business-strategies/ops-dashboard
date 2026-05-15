import { execFileSync } from 'node:child_process'

const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
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
