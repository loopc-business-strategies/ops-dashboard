const path = require('path')

if (!process.argv.some((arg) => arg.startsWith('--tenant='))) {
  const tenant = String(process.env.OPS_MISC_TENANT_ID || 'mg').trim().toLowerCase()
  process.argv.push(`--tenant=${tenant}`)
}

require(path.join(__dirname, '../../backend/scripts/destructive/_destructive-guard'))({
  scriptName: path.basename(process.argv[1] || 'ops-misc-script'),
  allowDryRunNoApply: true,
  defaultTenant: 'mg',
  tenantEnvFallbacks: ['OPS_MISC_TENANT_ID'],
})
