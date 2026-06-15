/**
 * Live API smoke for MG Ops mobile auth + chat read paths (Bearer, X-Client: mobile).
 * Does not post chat messages (read-only smoke).
 * Env (set in shell or .env — never commit secrets):
 *   MOBILE_SMOKE_API_URL     default https://api.loopcstrategies.com
 *   MOBILE_SMOKE_COMPANY    default mg  (also: SMOKE_LOGIN_COMPANY)
 *   MOBILE_SMOKE_LOGIN_NAME required unless SMOKE_LOGIN_NAME or SMOKE_DEFAULT_NAME
 *   MOBILE_SMOKE_LOGIN_PASSWORD required unless SMOKE_LOGIN_PASSWORD or SMOKE_DEFAULT_PASSWORD
 *
 * Usage:  npm run smoke:api --prefix mobile
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

  console.log('Result: SUCCESS')
}

main().catch((e) => {
  console.error(`Result: FAILED -> ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
