const path = require('path')

const VALID_TENANTS = new Set(['mg', 'cg', 'loopc', 'all'])

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)

  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function isProductionLike() {
  const envName = String(
    process.env.NODE_ENV ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    ''
  ).trim().toLowerCase()

  return envName === 'production' || hasFlag('--production')
}

function requireDestructiveScriptGuard(options = {}) {
  const scriptName = options.scriptName || path.basename(process.argv[1] || 'destructive-script')
  const tenant = String(readArgValue('--tenant') || readArgValue('-t') || '').trim().toLowerCase()
  const isApplyMode = hasFlag('--apply')

  if (!tenant || !VALID_TENANTS.has(tenant)) {
    console.error(`[blocked] ${scriptName} is quarantined as destructive.`)
    console.error('Pass an explicit tenant: --tenant=mg, --tenant=cg, --tenant=loopc, or --tenant=all.')
    process.exit(1)
  }

  if (!isApplyMode && !options.allowDryRunNoApply) {
    console.error(`[blocked] ${scriptName} requires --apply for destructive execution.`)
    console.error('Run an audit/preview script first. This guard does not provide dry-run semantics for legacy scripts.')
    process.exit(1)
  }

  if (isApplyMode) {
    const reason = String(readArgValue('--reason') || '').trim()
    if (reason.length < 10) {
      console.error(`[blocked] ${scriptName} requires --reason with an approved maintenance reason.`)
      process.exit(1)
    }

    const expectedToken = String(
      process.env.CLEANUP_CONFIRM_TOKEN ||
      process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN ||
      ''
    ).trim()
    if (!expectedToken) {
      console.error(`[blocked] ${scriptName} requires CLEANUP_CONFIRM_TOKEN or DESTRUCTIVE_ADMIN_CONFIRM_TOKEN.`)
      process.exit(1)
    }

    const confirmToken = String(readArgValue('--confirm') || '').trim()
    if (confirmToken !== expectedToken) {
      console.error(`[blocked] ${scriptName} requires --confirm to match the configured confirmation token.`)
      process.exit(1)
    }
  }

  if (isProductionLike() && String(process.env.ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT || '').toLowerCase() !== 'true') {
    console.error(`[blocked] ${scriptName} appears to be targeting production.`)
    console.error('Set ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT=true only after backup and written approval.')
    process.exit(1)
  }

  process.env.DESTRUCTIVE_SCRIPT_TENANT = tenant
}

module.exports = requireDestructiveScriptGuard
