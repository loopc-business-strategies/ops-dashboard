/* eslint-disable no-console */
/**
 * Verifies MG/CG portals serve a build that includes expense dashboard UI markers.
 * Does not require auth — checks Vercel static assets referenced from the SPA shell.
 */
const TENANTS = ['mg', 'cg']
const BASE_DOMAIN = process.env.SMOKE_BASE_DOMAIN || 'loopcstrategies.com'
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000)

const EXPENSE_MARKERS = [
  'Total Transactions',
  'Expense Report',
  'Monthly Expenses',
  'Total Expenses',
]

function extractAssetUrls(html, origin) {
  const urls = new Set()
  const patterns = [
    /<script[^>]+src="([^"]+)"/gi,
    /<link[^>]+href="([^"]+\.js[^"]*)"/gi,
  ]
  for (const re of patterns) {
    let match = re.exec(html)
    while (match) {
      const src = match[1]
      urls.add(src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? '' : '/'}${src}`)
      match = re.exec(html)
    }
  }
  return [...urls]
}

async function collectChunkUrls(entryUrls, origin) {
  const queue = [...entryUrls]
  const visited = new Set()
  const all = new Set()

  while (queue.length) {
    const url = queue.shift()
    if (!url || visited.has(url)) continue
    visited.add(url)
    all.add(url)

    const res = await fetchWithTimeout(url)
    if (!res.ok) continue
    const body = await res.text()

    const assetRe = /(?:import\(|from\s+["']|["'])(\.?\/?assets\/[^"']+\.js)/g
    let match = assetRe.exec(body)
    while (match) {
      const rel = match[1].replace(/^\.\//, '')
      queue.push(`${origin}/${rel}`)
      match = assetRe.exec(body)
    }
  }

  return [...all]
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function verifyTenantPortal(tenant) {
  const origin = `https://${tenant}.${BASE_DOMAIN}`
  const loginUrl = `${origin}/login`
  const loginRes = await fetchWithTimeout(loginUrl)
  const loginHtml = await loginRes.text()
  if (!loginRes.ok) {
    throw new Error(`login page ${loginRes.status}`)
  }

  const entryUrls = extractAssetUrls(loginHtml, origin)
  if (!entryUrls.length) {
    throw new Error('no JS assets found in login shell')
  }

  const chunkUrls = await collectChunkUrls(entryUrls, origin)

  let matchedMarker = ''
  for (const chunkUrl of chunkUrls) {
    const chunkRes = await fetchWithTimeout(chunkUrl)
    if (!chunkRes.ok) continue
    const body = await chunkRes.text()
    matchedMarker = EXPENSE_MARKERS.find((marker) => body.includes(marker)) || ''
    if (matchedMarker) break
  }

  if (!matchedMarker) {
    throw new Error(`expense UI strings not found in ${chunkUrls.length} chunk(s)`)
  }

  return `${loginRes.status} marker="${matchedMarker}" chunks=${chunkUrls.length}`
}

async function run() {
  console.log('Expense portal bundle verification')
  console.log(`Domain: ${BASE_DOMAIN}`)
  const results = await Promise.all(
    TENANTS.map(async (tenant) => {
      const started = Date.now()
      try {
        const detail = await verifyTenantPortal(tenant)
        return { tenant, ok: true, ms: Date.now() - started, detail }
      } catch (error) {
        return { tenant, ok: false, ms: Date.now() - started, error: error.message || String(error) }
      }
    }),
  )

  for (const result of results) {
    const label = result.tenant.toUpperCase()
    if (result.ok) {
      console.log(`OK  ${label} (${result.ms}ms) ${result.detail}`)
    } else {
      console.log(`FAIL ${label} (${result.ms}ms) ${result.error}`)
    }
  }

  const failures = results.filter((r) => !r.ok)
  if (failures.length) {
    console.error(`Expense portal verification failed: ${failures.length}/${results.length}`)
    process.exit(1)
  }
  console.log(`Expense portal verification passed: ${results.length}/${results.length}`)
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
