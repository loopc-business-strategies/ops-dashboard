/**
 * Production probe: live metal rates API + multi-sample poll for movement verification.
 *
 * Usage:
 *   node scripts/verify-live-metal-movement.mjs
 *   node scripts/verify-live-metal-movement.mjs --tenant cg
 *   node scripts/verify-live-metal-movement.mjs --tenant all --samples 5 --interval 4000
 */
import {
  apiRequest,
  getApiBase,
  loginTenant,
  parseTenantArg,
  parseTenantList,
  TENANTS,
} from './jv-live-api-common.mjs'

function parseIntArg(argv, flag, defaultValue) {
  const idx = argv.indexOf(flag)
  if (idx === -1 || !argv[idx + 1]) return defaultValue
  const n = Number(argv[idx + 1])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultValue
}

function pickSourcePrices(rates = {}) {
  return {
    gold: Number(rates.sourceGoldPrice || rates.goldPrice || 0),
    silver: Number(rates.sourceSilverPrice || rates.silverPrice || 0),
    platinum: Number(rates.sourcePlatinumPrice || rates.platinumPrice || 0),
    source: String(rates.source || ''),
    updatedAt: rates.updatedAt || null,
  }
}

async function probeTenant(tenant, samples, intervalMs) {
  const session = await loginTenant(tenant)
  const readings = []

  for (let i = 0; i < samples; i += 1) {
    const res = await apiRequest(tenant, '/api/erp-accounting/metal-rates/live', { session })
    if (res.status !== 200) {
      throw new Error(`metal-rates/live failed (${res.status}): ${res.data?.message || 'unknown'}`)
    }
    const body = res.data || {}
    const rates = body.rates || {}
    const row = {
      ...pickSourcePrices(rates),
      live: Boolean(body.live),
      feedType: body.feedType || (rates.source === 'mt4-bridge' ? 'mt4-bridge' : ''),
      feedAgeMs: body.feedAgeMs ?? null,
      staleMs: body.staleMs ?? null,
    }
    readings.push(row)

    console.log(
      `  [${i + 1}/${samples}] gold=${row.gold.toFixed(2)} silver=${row.silver.toFixed(2)} `
      + `platinum=${row.platinum.toFixed(2)} live=${row.live} feed=${row.feedType || row.source || '—'} `
      + `ageMs=${row.feedAgeMs ?? '—'}`,
    )

    if (i < samples - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  const goldUnique = new Set(readings.map((r) => r.gold)).size
  const silverUnique = new Set(readings.map((r) => r.silver)).size
  const platinumUnique = new Set(readings.map((r) => r.platinum)).size
  const allPositive = readings.every((r) => r.gold > 0 && r.silver > 0 && r.platinum > 0)
  const anyLive = readings.some((r) => r.live)
  const pricesMoved = goldUnique > 1 || silverUnique > 1 || platinumUnique > 1

  console.log(`\n=== ${tenant.toUpperCase()} summary ===`)
  console.log(`Samples: ${samples}, interval: ${intervalMs}ms`)
  console.log(`All positive prices: ${allPositive}`)
  console.log(`Any live tick: ${anyLive}`)
  console.log(`Gold unique values: ${goldUnique}, silver: ${silverUnique}, platinum: ${platinumUnique}`)
  console.log(`Prices moved between samples: ${pricesMoved}`)
  if (!pricesMoved && allPositive) {
    console.log('Note: flat feed → UI movement row shows ▲ 0.00 (+0.00%) after second client update (expected).')
  }

  return {
    tenant,
    ok: allPositive && anyLive,
    allPositive,
    anyLive,
    pricesMoved,
    readings,
  }
}

async function main() {
  const tenantArg = parseTenantArg(process.argv, 'mg')
  const tenants = tenantArg === 'all' ? [...TENANTS] : parseTenantList(tenantArg)
  const samples = parseIntArg(process.argv, '--samples', 3)
  const intervalMs = parseIntArg(process.argv, '--interval', 4000)

  console.log(`Live metal movement probe  API=${getApiBase()}  tenants=${tenants.join(',')}`)

  const results = []
  for (const tenant of tenants) {
    console.log(`\n--- ${tenant.toUpperCase()} ---`)
    try {
      results.push(await probeTenant(tenant, samples, intervalMs))
    } catch (err) {
      console.error(`FAIL ${tenant}: ${err.message || err}`)
      results.push({ tenant, ok: false, error: err.message || String(err) })
    }
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== Overall: ${results.length - failed}/${results.length} tenants OK ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
