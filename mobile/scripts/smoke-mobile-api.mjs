/**
 * Live API smoke for Nexa mobile: JWT + X-Client: mobile (same as the app).
 *
 * Covers:
 *   - Auth: login, me
 *   - Chat read: messages/latest, participants, groups
 *   - ERP reports: same GET surface as mobile/src/api/erpReports.ts (Bearer, not cookie session)
 *   - Socket.IO: connect to /notifications (in-app notification transport; not FCM OS push)
 *   - Push token API: POST then DELETE /api/auth/me/push-token (validates route; not a real device push)
 *
 * Does not deliver an OS notification (Expo/FCM) — that requires a device + Expo push pipeline.
 *
 * Env (never commit secrets):
 *   MOBILE_SMOKE_API_URL, MOBILE_SMOKE_COMPANY, MOBILE_SMOKE_LOGIN_NAME, MOBILE_SMOKE_LOGIN_PASSWORD
 *   (aliases: SMOKE_LOGIN_*, SMOKE_DEFAULT_*)
 *
 * Optional skip flags (set to 1):
 *   SMOKE_MOBILE_SKIP_ERP, SMOKE_MOBILE_SKIP_SOCKET, SMOKE_MOBILE_SKIP_PUSH
 *
 * Usage:  npm run smoke:api --prefix mobile
 *         npm run smoke:mobile:api   (from repo root)
 */
const base = String(
  process.env.MOBILE_SMOKE_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    'https://api.loopcstrategies.com',
)
  .trim()
  .replace(/\/+$/, '')

const company = String(
  process.env.MOBILE_SMOKE_COMPANY || process.env.SMOKE_LOGIN_COMPANY || 'mg',
).trim()

const name = String(
  process.env.MOBILE_SMOKE_LOGIN_NAME ||
    process.env.SMOKE_LOGIN_NAME ||
    process.env.SMOKE_DEFAULT_NAME ||
    '',
).trim()

const password = String(
  process.env.MOBILE_SMOKE_LOGIN_PASSWORD ||
    process.env.SMOKE_LOGIN_PASSWORD ||
    process.env.SMOKE_DEFAULT_PASSWORD ||
    '',
).trim()

const skipErp = String(process.env.SMOKE_MOBILE_SKIP_ERP || '').trim() === '1'
const skipSocket = String(process.env.SMOKE_MOBILE_SKIP_SOCKET || '').trim() === '1'
const skipPush = String(process.env.SMOKE_MOBILE_SKIP_PUSH || '').trim() === '1'

function mobileHeaders(token = null) {
  const h = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-tenant': company,
    'x-company': company,
    'X-Client': 'mobile',
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

const trimApiSuffix = (value) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

async function expectOk(res, label) {
  const data = await readJson(res)
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`
    throw new Error(`${label}: ${msg}`)
  }
  return data
}

async function getExpect(token, url, label) {
  const res = await fetch(url, { headers: mobileHeaders(token) })
  return expectOk(res, label)
}

/** Same report GETs as backend/scripts/smoke-erp-api.js smokeMobileErpReportEndpoints + metal rates (mobile home). */
async function smokeErpReportsMobile(token) {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 3)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const trialQs = new URLSearchParams({
    startDate,
    endDate,
    includeZero: 'false',
    sortBy: 'accountCode',
    sortDir: 'asc',
  })
  await getExpect(
    token,
    `${base}/api/erp-accounting/reports/trial-balance?${trialQs}`,
    'GET trial-balance',
  )

  const plQs = new URLSearchParams({
    startDate,
    endDate,
    includeZero: 'false',
    comparePrevious: 'true',
  })
  await getExpect(token, `${base}/api/erp-accounting/reports/profit-loss?${plQs}`, 'GET profit-loss')

  const bsQs = new URLSearchParams({ endDate })
  await getExpect(token, `${base}/api/erp-accounting/reports/balance-sheet?${bsQs}`, 'GET balance-sheet')

  const dayQs = new URLSearchParams({ startDate, endDate })
  await getExpect(token, `${base}/api/erp-accounting/reports/day-book?${dayQs}`, 'GET day-book')

  await getExpect(token, `${base}/api/erp-accounting/reports/customer-outstanding`, 'GET customer-outstanding')
  await getExpect(token, `${base}/api/erp-accounting/reports/vendor-outstanding`, 'GET vendor-outstanding')

  const forexQs = new URLSearchParams({ startDate, endDate })
  await getExpect(token, `${base}/api/erp-accounting/reports/forex-gain-loss?${forexQs}`, 'GET forex-gain-loss')

  const accountsData = await getExpect(
    token,
    `${base}/api/erp-accounting/accounts?page=1&limit=5`,
    'GET accounts (ledger prerequisite)',
  )
  const firstId = accountsData?.accounts?.[0]?._id
  if (firstId) {
    const ledgerQs = new URLSearchParams({
      accountId: String(firstId),
      startDate,
      endDate,
    })
    await getExpect(token, `${base}/api/erp-accounting/reports/ledger?${ledgerQs}`, 'GET ledger')
  } else {
    console.log('Step: GET ledger — SKIP (no accounts)')
  }

  await getExpect(token, `${base}/api/erp-accounting/metal-rates`, 'GET metal-rates')
}

async function smokeNotificationsSocket(token) {
  const { io } = await import('socket.io-client')
  const origin = trimApiSuffix(base)
  const url = origin ? `${origin}/notifications` : '/notifications'

  await new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
      timeout: 10000,
      auth: { token },
      extraHeaders: {
        'x-tenant': company,
        'x-company': company,
        'X-Client': 'mobile',
      },
    })
    const failTimer = setTimeout(() => {
      socket.disconnect()
      reject(new Error('Socket.IO connect timeout (10s)'))
    }, 11000)

    const done = (err) => {
      clearTimeout(failTimer)
      try {
        socket.disconnect()
      } catch {
        /* ignore */
      }
      if (err) reject(err)
      else resolve()
    }

    socket.on('connect', () => done(null))
    socket.on('connect_error', (err) =>
      done(new Error(`Socket.IO connect_error: ${err?.message || String(err)}`)),
    )
  })
}

/** Expo-shaped token (min length per Joi); POST then DELETE so DB is not left with junk long-term. */
async function smokePushTokenRoundTrip(token) {
  const expoToken = `ExponentPushToken[smoke-mobile-${Date.now()}]`
  const postRes = await fetch(`${base}/api/auth/me/push-token`, {
    method: 'POST',
    headers: mobileHeaders(token),
    body: JSON.stringify({ token: expoToken }),
  })
  await expectOk(postRes, 'POST /api/auth/me/push-token')

  const delRes = await fetch(`${base}/api/auth/me/push-token`, {
    method: 'DELETE',
    headers: mobileHeaders(token),
    body: JSON.stringify({ token: expoToken }),
  })
  await expectOk(delRes, 'DELETE /api/auth/me/push-token')
}

async function main() {
  if (!name || !password) {
    console.error(
      'Missing credentials. Set MOBILE_SMOKE_LOGIN_NAME and MOBILE_SMOKE_LOGIN_PASSWORD\n' +
        '(or SMOKE_LOGIN_NAME / SMOKE_LOGIN_PASSWORD, or SMOKE_DEFAULT_*).',
    )
    process.exit(1)
  }

  console.log(`Mobile API smoke -> ${base}`)
  console.log(`Tenant/user: ${company}/${name}`)
  if (skipErp) console.log('Note: SMOKE_MOBILE_SKIP_ERP=1 — skipping ERP report GETs')
  if (skipSocket) console.log('Note: SMOKE_MOBILE_SKIP_SOCKET=1 — skipping Socket.IO')
  if (skipPush) console.log('Note: SMOKE_MOBILE_SKIP_PUSH=1 — skipping push-token POST/DELETE')

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: mobileHeaders(),
    body: JSON.stringify({ name, password, company }),
  })
  const loginData = await expectOk(loginRes, 'POST /api/auth/login')
  const token = loginData?.token
  if (!token || typeof token !== 'string') {
    throw new Error('Login response missing token')
  }
  console.log('Step: login — OK')

  const meRes = await fetch(`${base}/api/auth/me`, { headers: mobileHeaders(token) })
  await expectOk(meRes, 'GET /api/auth/me')
  console.log('Step: me — OK')

  const latestUrl = new URL(`${base}/api/messages/latest`)
  latestUrl.searchParams.set('type', 'all')
  latestUrl.searchParams.set('limit', '10')
  const latestRes = await fetch(latestUrl, { headers: mobileHeaders(token) })
  await expectOk(latestRes, 'GET /api/messages/latest')
  console.log('Step: messages/latest — OK')

  const partRes = await fetch(`${base}/api/messages/participants`, {
    headers: mobileHeaders(token),
  })
  await expectOk(partRes, 'GET /api/messages/participants')
  console.log('Step: messages/participants — OK')

  const groupsRes = await fetch(`${base}/api/messages/groups`, { headers: mobileHeaders(token) })
  await expectOk(groupsRes, 'GET /api/messages/groups')
  console.log('Step: messages/groups — OK')

  if (!skipErp) {
    await smokeErpReportsMobile(token)
    console.log('Step: ERP reports + metal-rates (mobile JWT) — OK')

    const txData = await getExpect(
      token,
      `${base}/api/erp-accounting/transactions?limit=50`,
      'GET transactions',
    )
    const txTotal = Number(txData?.summary?.totalCount ?? txData?.total ?? 0)
    console.log(`Step: transactions summary.totalCount — ${txTotal}`)
  }

  if (!skipSocket) {
    await smokeNotificationsSocket(token)
    console.log('Step: socket /notifications — OK')
  }

  if (!skipPush) {
    await smokePushTokenRoundTrip(token)
    console.log('Step: push-token POST+DELETE (API only, not OS push) — OK')
  }

  console.log('Result: SUCCESS')
}

main().catch((e) => {
  console.error(`Result: FAILED -> ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
