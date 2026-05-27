import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const workspaces = [
  { label: 'workspace root', cwd: rootDir },
  { label: 'backend', cwd: path.join(rootDir, 'backend') },
  { label: 'frontend', cwd: path.join(rootDir, 'frontend') },
]

function runAudit({ cwd, advisory = false }) {
  const args = advisory ? ['audit'] : ['audit', '--omit=dev', '--audit-level=high']

  return spawnSync('npm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
}

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

const advisory = process.argv.includes('--advisory')
const failures = []

for (const workspace of workspaces) {
  printSection(`${workspace.label} (${workspace.cwd})`)
  const result = runAudit({ cwd: workspace.cwd, advisory })

  if (result.stdout?.trim()) console.log(result.stdout.trim())
  if (result.stderr?.trim()) console.error(result.stderr.trim())

  if (result.status !== 0) {
    failures.push(workspace.label)
  }
}

if (failures.length) {
  const mode = advisory ? 'Advisory dependency audit' : 'Production dependency audit'
  console.error(`\n${mode} reported issues in: ${failures.join(', ')}`)
  process.exit(advisory ? 0 : 1)
}

console.log(advisory
  ? '\nAdvisory dependency audit completed.'
  : '\nProduction dependency audit passed (no high/critical production vulnerabilities).')
