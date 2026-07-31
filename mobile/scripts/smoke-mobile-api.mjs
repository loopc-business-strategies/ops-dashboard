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
 *   SMOKE_MOBILE_ERP_FULL — full report suite (needs finance/super_admin); default is lite probe
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
const erpFull = String(process.env.SMOKE_MOBILE_ERP_FULL || '').trim() === '1'
const skipSocket = String(process.env.SMOKE_MOBILE_SKIP_SOCKET || '').trim() === '1'
const skipPush = String(process.env.SMOKE_MOBILE_SKIP_PUSH || '').trim() === '1'

const FETCH_TIMEOUT_MS = Math.max(5000, Number(process.env.SMOKE_MOBILE_FETCH_TIMEOUT_MS || 30000) || 30000)
const READY_WAIT_MS = Math.max(5000, Number(process.env.SMOKE_MOBILE_READY_WAIT_MS || 30000) || 30000)
const RETRY_ATTEMPTS = Math.max(1, Number(process.env.SMOKE_MOBILE_RETRY_ATTEMPTS || 3) || 3)
const RETRY_BACKOFF_MS = Math.max(250, Number(process.env.SMOKE_MOBILE_RETRY_BACKOFF_MS || 1500) || 1500)

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function abortSignalTimeout(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function isSessionRevokedError(status, message) {
  return Number(status) === 401 && /session revoked/i.test(String(message || ''))
}

function isTransientGatewayError(status, message) {
  const code = Number(status)
  if (code === 502 || code === 503 || code === 504) return true
  return /application failed to respond/i.test(String(message || ''))
}

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...rest } = options
  return fetch(url, {
    ...rest,
    signal: rest.signal || abortSignalTimeout(timeoutMs),
  })
}

async function fetchWithRetry(url, options = {}, label = 'request') {
  let lastErr
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, options)
      const data = await readJson(res)
      if (!res.ok) {
        const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`
        if (attempt < RETRY_ATTEMPTS && isTransientGatewayError(res.status, msg)) {
          console.log(`Note: ${label} got transient ${res.status} (${msg}) — retry ${attempt}/${RETRY_ATTEMPTS}`)
          await sleep(RETRY_BACKOFF_MS * attempt)
          continue
        }
        const err = new Error(`${label}: ${msg}`)
        err.status = res.status
        err.apiMessage = msg
        throw err
      }
      return { res, data }
    } catch (err) {
      lastErr = err
      const status = Number(err?.status || 0)
      const msg = err?.apiMessage || err?.message || String(err)
      const abortLike = err?.name === 'AbortError' || /aborted|timeout/i.test(String(msg))
      if (attempt < RETRY_ATTEMPTS && (abortLike || isTransientGatewayError(status, msg))) {
        console.log(`Note: ${label} failed (${msg}) — retry ${attempt}/${RETRY_ATTEMPTS}`)
        await sleep(RETRY_BACKOFF_MS * attempt)
        continue
      }
      throw err
    }
  }
  throw lastErr || new Error(`${label}: exhausted retries`)
}

async function waitForApiReady() {
  const deadline = Date.now() + READY_WAIT_MS
  let lastErr = 'not ready'
  while (Date.now() < deadline) {
    try {
      const { data } = await fetchWithRetry(
        `${base}/api/ready`,
        { headers: mobileHeaders(), timeoutMs: Math.min(10000, FETCH_TIMEOUT_MS) },
        'GET /api/ready',
      )
      if (data?.ready === true) {
        const sha = String(data?.build?.sha || data?.backend?.sha || data?.commit || '').slice(0, 7)
        console.log(`Step: api ready — OK${sha ? ` (build=${sha})` : ''}`)
        return data
      }
      lastErr = 'ready=false'
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
    }
    await sleep(1500)
  }
  throw new Error(`API not ready within ${READY_WAIT_MS}ms (${lastErr})`)
}

async function loginForToken() {
  const { data: loginData } = await fetchWithRetry(
    `${base}/api/auth/login`,
    {
      method: 'POST',
      headers: mobileHeaders(),
      body: JSON.stringify({ name, password, company }),
    },
    'POST /api/auth/login',
  )
  const token = loginData?.token
  if (!token || typeof token !== 'string') {
    throw new Error('Login response missing token')
  }
  return token
}

/** Auth bag so ERP helpers can refresh JWT after concurrent session invalidation. */
const auth = { token: null }

async function getExpect(url, label) {
  try {
    const { data } = await fetchWithRetry(url, { headers: mobileHeaders(auth.token) }, label)
    return data
  } catch (err) {
    if (!isSessionRevokedError(err.status, err.apiMessage || err.message)) throw err
    console.log(`Note: ${label} got session revoked — re-login once and retry`)
    auth.token = await loginForToken()
    const { data } = await fetchWithRetry(url, { headers: mobileHeaders(auth.token) }, label)
    return data
  }
}

/** Same report GETs as backend/scripts/smoke-erp-api.js smokeMobileErpReportEndpoints + metal rates (mobile home). */
async function smokeErpReportsMobile() {
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
    `${base}/api/erp-accounting/reports/trial-balance?${trialQs}`,
    'GET trial-balance',
  )

  const plQs = new URLSearchParams({
    startDate,
    endDate,
    includeZero: 'false',
    comparePrevious: 'true',
  })
  await getExpect(`${base}/api/erp-accounting/reports/profit-loss?${plQs}`, 'GET profit-loss')

  const bsQs = new URLSearchParams({ endDate })
  await getExpect(`${base}/api/erp-accounting/reports/balance-sheet?${bsQs}`, 'GET balance-sheet')

  const dayQs = new URLSearchParams({ startDate, endDate })
  await getExpect(`${base}/api/erp-accounting/reports/day-book?${dayQs}`, 'GET day-book')

  await getExpect(`${base}/api/erp-accounting/reports/customer-outstanding`, 'GET customer-outstanding')
  await getExpect(`${base}/api/erp-accounting/reports/vendor-outstanding`, 'GET vendor-outstanding')

  const forexQs = new URLSearchParams({ startDate, endDate })
  await getExpect(`${base}/api/erp-accounting/reports/forex-gain-loss?${forexQs}`, 'GET forex-gain-loss')

  const accountsData = await getExpect(
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
    await getExpect(`${base}/api/erp-accounting/reports/ledger?${ledgerQs}`, 'GET ledger')
  } else {
    console.log('Step: GET ledger — SKIP (no accounts)')
  }

  const jvQs = new URLSearchParams({ referenceType: 'journal', limit: '1', startDate, endDate })
  try {
    await getExpect(`${base}/api/erp-accounting/ledger?${jvQs}`, 'GET ledger journal (operations JV)')
  } catch (e) {
    console.log(`Step: GET ledger journal — SKIP (${e instanceof Error ? e.message : e})`)
  }

  await getExpect(`${base}/api/erp-accounting/metal-rates`, 'GET metal-rates')
}

/** Smoke-probe users (management role) can read transactions but not full report suite. */
async function smokeErpLite() {
  const txData = await getExpect(
    `${base}/api/erp-accounting/transactions?limit=50`,
    'GET transactions',
  )
  const txTotal = Number(txData?.summary?.totalCount ?? txData?.total ?? 0)
  console.log(`Step: transactions summary.totalCount — ${txTotal}`)

  await getExpect(`${base}/api/erp-accounting/metal-rates`, 'GET metal-rates')

  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 1)
  const jvQs = new URLSearchParams({
    referenceType: 'journal',
    limit: '1',
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  })
  try {
    await getExpect(`${base}/api/erp-accounting/ledger?${jvQs}`, 'GET ledger journal (operations JV)')
  } catch (e) {
    console.log(`Step: GET ledger journal — SKIP (${e instanceof Error ? e.message : e})`)
  }
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
  await fetchWithRetry(
    `${base}/api/auth/me/push-token`,
    {
      method: 'POST',
      headers: mobileHeaders(token),
      body: JSON.stringify({ token: expoToken }),
    },
    'POST /api/auth/me/push-token',
  )

  await fetchWithRetry(
    `${base}/api/auth/me/push-token`,
    {
      method: 'DELETE',
      headers: mobileHeaders(token),
      body: JSON.stringify({ token: expoToken }),
    },
    'DELETE /api/auth/me/push-token',
  )
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
  else if (erpFull) console.log('Note: SMOKE_MOBILE_ERP_FULL=1 — full ERP report suite')
  else console.log('Note: lite ERP probe (transactions + metal-rates); set SMOKE_MOBILE_ERP_FULL=1 for full reports')
  if (skipSocket) console.log('Note: SMOKE_MOBILE_SKIP_SOCKET=1 — skipping Socket.IO')
  if (skipPush) console.log('Note: SMOKE_MOBILE_SKIP_PUSH=1 — skipping push-token POST/DELETE')

  await waitForApiReady()

  auth.token = await loginForToken()
  console.log('Step: login — OK')

  await getExpect(`${base}/api/auth/me`, 'GET /api/auth/me')
  console.log('Step: me — OK')

  const latestUrl = new URL(`${base}/api/messages/latest`)
  latestUrl.searchParams.set('type', 'all')
  latestUrl.searchParams.set('limit', '10')
  await getExpect(latestUrl.toString(), 'GET /api/messages/latest')
  console.log('Step: messages/latest — OK')

  await getExpect(`${base}/api/messages/participants`, 'GET /api/messages/participants')
  console.log('Step: messages/participants — OK')

  await getExpect(`${base}/api/messages/groups`, 'GET /api/messages/groups')
  console.log('Step: messages/groups — OK')

  if (!skipErp) {
    if (erpFull) {
      await smokeErpReportsMobile()
      console.log('Step: ERP reports + metal-rates (mobile JWT) — OK')

      const txData = await getExpect(
        `${base}/api/erp-accounting/transactions?limit=50`,
        'GET transactions',
      )
      const txTotal = Number(txData?.summary?.totalCount ?? txData?.total ?? 0)
      console.log(`Step: transactions summary.totalCount — ${txTotal}`)
    } else {
      await smokeErpLite()
      console.log('Step: ERP lite (transactions + metal-rates) — OK')
    }
  }

  if (!skipSocket) {
    await smokeNotificationsSocket(auth.token)
    console.log('Step: socket /notifications — OK')
  }

  if (!skipPush) {
    await smokePushTokenRoundTrip(auth.token)
    console.log('Step: push-token POST+DELETE (API only, not OS push) — OK')
  }

  console.log('Result: SUCCESS')
}

main().catch((e) => {
  console.error(`Result: FAILED -> ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
