import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const workspaces = [
  { label: 'workspace root', cwd: rootDir },
  { label: 'backend', cwd: path.join(rootDir, 'backend') },
  { label: 'frontend', cwd: path.join(rootDir, 'frontend') },
  { label: 'mobile', cwd: path.join(rootDir, 'mobile') },
]

/**
 * High/critical advisories that do not apply to this codebase / have no published patch.
 * GHSA-qwww-vcr4-c8h2: RSC Mode CSRF — SPA uses react-router-dom client APIs only, not unstable RSC.
 * Allowlist until react-router-dom publishes a line that depends on react-router >= 8.3.0.
 * GHSA-w3rx-r6r6-pgpr / GHSA-5p2g-fcmc-qvqq: image-size ICNS/JXL/HEIF DoS — latest npm is 2.0.2
 * (still flagged). Allowlist until a patched release > 2.0.2 is published.
 */
const ALLOWLISTED_ADVISORY_IDS = new Set([
  'GHSA-qwww-vcr4-c8h2',
  'GHSA-w3rx-r6r6-pgpr',
  'GHSA-5p2g-fcmc-qvqq',
])

function extractAdvisoryId(entry) {
  if (!entry || typeof entry === 'string') return ''
  if (typeof entry.url === 'string') {
    const match = entry.url.match(/GHSA-[\w-]+/i)
    if (match) return match[0]
  }
  if (typeof entry.source === 'string' && /^GHSA-/i.test(entry.source)) return entry.source
  return ''
}

function hasBlockingVulnerability(auditJson) {
  const vulnerabilities = auditJson?.vulnerabilities || {}
  const blocking = []

  for (const [name, meta] of Object.entries(vulnerabilities)) {
    const severity = String(meta?.severity || '').toLowerCase()
    if (severity !== 'high' && severity !== 'critical') continue

    const via = Array.isArray(meta?.via) ? meta.via : []
    const directAdvisories = via
      .map((entry) => extractAdvisoryId(entry))
      .filter(Boolean)

    // Package-only via entries are transitive effects of another advisory.
    if (!directAdvisories.length) continue

    const nonAllowlisted = directAdvisories.filter((id) => !ALLOWLISTED_ADVISORY_IDS.has(id))
    if (!nonAllowlisted.length) continue

    blocking.push({
      name,
      severity,
      advisories: [...new Set(nonAllowlisted)],
    })
  }

  return blocking
}

function runAudit({ cwd, advisory = false }) {
  const args = advisory
    ? ['audit', '--json']
    : ['audit', '--omit=dev', '--json']

  return spawnSync('npm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
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
  const stdout = String(result.stdout || '').trim()
  const stderr = String(result.stderr || '').trim()

  let auditJson = null
  if (stdout) {
    try {
      auditJson = JSON.parse(stdout)
    } catch {
      console.log(stdout)
    }
  }
  if (stderr) console.error(stderr)

  if (advisory) {
    if (auditJson) {
      const highCritical = Object.entries(auditJson.vulnerabilities || {})
        .filter(([, meta]) => ['high', 'critical'].includes(String(meta?.severity || '').toLowerCase()))
      console.log(`Advisory findings (high/critical): ${highCritical.length}`)
      highCritical.slice(0, 20).forEach(([name, meta]) => {
        console.log(`- ${name}: ${meta.severity}`)
      })
    }
    continue
  }

  if (!auditJson) {
    if (result.status !== 0) failures.push(workspace.label)
    continue
  }

  const blocking = hasBlockingVulnerability(auditJson)
  if (blocking.length) {
    console.error(`Blocking production vulnerabilities (${blocking.length}):`)
    blocking.forEach((item) => {
      const advisoryText = item.advisories.length ? ` [${item.advisories.join(', ')}]` : ''
      console.error(`- ${item.name}: ${item.severity}${advisoryText}`)
    })
    failures.push(workspace.label)
  } else {
    console.log('No blocking high/critical production vulnerabilities.')
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
