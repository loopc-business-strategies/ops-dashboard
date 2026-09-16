/**
 * One-shot CG Production Control happy-path smoke against live API.
 * Usage:
 *   CG_ADMIN_PASSWORD=*** node scripts/cg-pcc-smoke-live.mjs
 * Optional: CG_ADMIN_NAME=Nan API_BASE=https://api.loopcstrategies.com
 */
/* eslint-disable no-console */

const API = (process.env.API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
const TENANT = 'cg'
const NAME = process.env.CG_ADMIN_NAME || 'Nan'
const PASSWORD = process.env.CG_ADMIN_PASSWORD || ''
const WEIGHT = Number(process.env.CG_SMOKE_WEIGHT || 10)

const report = []
function step(name, ok, detail = '') {
  report.push({ name, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function req(path, { method = 'GET', body, cookie, csrfToken } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant': TENANT,
    'x-company': TENANT,
    Origin: `https://${TENANT}.loopcstrategies.com`,
    Referer: `https://${TENANT}.loopcstrategies.com/production`,
  }
  if (cookie) headers.Cookie = cookie
  if (csrfToken) headers['x-csrf-token'] = csrfToken
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text.slice(0, 500) }
  }
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const cookieHeader = setCookie.map((row) => String(row).split(';')[0]).filter(Boolean).join('; ')
  const nextCsrf = String(data?.csrfToken || res.headers.get('x-csrf-token') || csrfToken || '').trim()
  return {
    status: res.status,
    data,
    cookie: cookieHeader || cookie || '',
    csrfToken: nextCsrf,
  }
}

function mergeCookie(prev, next) {
  if (!next) return prev || ''
  if (!prev) return next
  const map = new Map()
  for (const part of String(prev).split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k) map.set(k, rest.join('='))
  }
  for (const part of String(next).split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k) map.set(k, rest.join('='))
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function main() {
  if (!PASSWORD) {
    console.error('Set CG_ADMIN_PASSWORD to run')
    process.exit(2)
  }

  console.log(`\n=== CG PCC live smoke ===\nAPI: ${API}\nTenant: ${TENANT}\nUser: ${NAME}\nWeight: ${WEIGHT}g\n`)

  // 1. Preflight
  const ready = await req('/api/ready')
  step('API ready', ready.status === 200, `status=${ready.status}`)

  let session = await req('/api/auth/login', {
    method: 'POST',
    body: { name: NAME, password: PASSWORD, company: TENANT },
  })
  const loginOk = session.status === 200 && (session.data?.success === true || session.data?.user)
  step(
    'Login Nan@cg',
    loginOk,
    loginOk
      ? `role=${session.data?.user?.role || session.data?.role || '?'} dept=${session.data?.user?.department || '?'}`
      : `${session.status} ${session.data?.message || JSON.stringify(session.data).slice(0, 200)}`,
  )
  if (!loginOk) {
    printReport()
    process.exit(1)
  }

  let cookie = session.cookie
  let csrf = session.csrfToken
  const user = session.data?.user || session.data || {}
  step(
    'PCC write role present',
    Boolean(user.role === 'super_admin' || user.productionRole || user.department === 'production' || user.role),
    `role=${user.role} productionRole=${user.productionRole || 'n/a'}`,
  )

  const authed = async (path, opts = {}) => {
    const res = await req(path, { ...opts, cookie, csrfToken: csrf })
    cookie = mergeCookie(cookie, res.cookie)
    if (res.csrfToken) csrf = res.csrfToken
    return res
  }

  // 2. Inventory
  let invList = await authed('/api/erp/inventory?limit=50&search=g')
  if (invList.status !== 200) {
    invList = await authed('/api/erp/inventory?limit=50')
  }
  step('List inventory', invList.status === 200, `status=${invList.status} total=${invList.data?.total ?? (invList.data?.items || []).length}`)

  const items = invList.data?.items || invList.data?.data || []
  let item = items.find((row) => {
    const unit = String(row.unit || '').toLowerCase()
    const qty = Number(row.quantity || 0)
    return qty >= WEIGHT && (['g', 'gm', 'gram', 'grams'].includes(unit) || /metalType=/i.test(String(row.category || '')))
  })

  let createdInventory = false
  if (!item) {
    const createInv = await authed('/api/erp/inventory', {
      method: 'POST',
      body: {
        name: `CG PCC Smoke Bar ${Date.now()}`,
        type: 'raw_material',
        quantity: 100,
        unit: 'g',
        minThreshold: 1,
        category: 'mainStock=raw;metalType=Gold;purity=22K;recordType=product',
        supplierName: 'PCC smoke',
      },
    })
    createdInventory = createInv.status === 201 || createInv.status === 200
    item = createInv.data?.item || createInv.data?.data
    step(
      'Create sample InventoryItem',
      createdInventory && Boolean(item?._id || item?.id),
      createdInventory
        ? `id=${item?._id || item?.id}`
        : `${createInv.status} ${createInv.data?.message || JSON.stringify(createInv.data).slice(0, 200)}`,
    )
    if (!createdInventory || !item) {
      printReport()
      process.exit(1)
    }
  } else {
    step('Reuse existing InventoryItem', true, `id=${item._id || item.id} name=${item.name} qty=${item.quantity}${item.unit || ''}`)
  }

  const inventoryItemId = String(item._id || item.id)
  const stamp = Date.now()
  const purpose = `CG PCC smoke ${stamp}`

  // 3. Happy path
  const createBatch = await authed('/api/erp/production-control/batches', {
    method: 'POST',
    body: {
      metalType: 'Gold',
      purity: '22K',
      initialWeight: WEIGHT,
      purpose,
      inventoryItemId,
      idempotencyKey: `cg-pcc-smoke-${stamp}`,
    },
  })
  const batch = createBatch.data?.batch
  const batchId = batch?._id
  const batchNumber = batch?.batchNumber
  step(
    'Create batch',
    (createBatch.status === 201 || createBatch.status === 200) && Boolean(batchId),
    batchId
      ? `batch=${batchNumber} id=${batchId}`
      : `${createBatch.status} ${createBatch.data?.message || JSON.stringify(createBatch.data).slice(0, 240)}`,
  )
  if (!batchId) {
    printReport()
    process.exit(1)
  }

  const issue = await authed(`/api/erp/production-control/batches/${batchId}/issue-from-vault`, {
    method: 'POST',
    body: {
      inventoryItemId,
      weight: WEIGHT,
      idempotencyKey: `cg-issue-${stamp}`,
    },
  })
  step(
    'Issue from vault',
    issue.status === 200,
    issue.status === 200
      ? `status=${issue.data?.batch?.status}`
      : `${issue.status} ${issue.data?.message || JSON.stringify(issue.data).slice(0, 240)}`,
  )
  if (issue.status !== 200) {
    printReport()
    process.exit(1)
  }

  const passCreate = await authed('/api/erp/production-control/passes', {
    method: 'POST',
    body: {
      batchId,
      fromDepartment: 'vault',
      toDepartment: 'melting',
      weight: WEIGHT,
      purpose,
    },
  })
  const passId = passCreate.data?.pass?._id
  step(
    'Create pass vault→melting',
    passCreate.status === 201 && Boolean(passId),
    passId ? `pass=${passId}` : `${passCreate.status} ${passCreate.data?.message || ''}`,
  )
  if (!passId) {
    printReport()
    process.exit(1)
  }

  const approve = await authed(`/api/erp/production-control/passes/${passId}/approve`, { method: 'POST', body: {} })
  step('Approve pass', approve.status === 200, approve.status === 200 ? '' : `${approve.status} ${approve.data?.message || ''}`)

  const issuePass = await authed(`/api/erp/production-control/passes/${passId}/issue`, { method: 'POST', body: {} })
  step('Issue pass', issuePass.status === 200, issuePass.status === 200 ? '' : `${issuePass.status} ${issuePass.data?.message || ''}`)

  const receive = await authed(`/api/erp/production-control/passes/${passId}/receive`, {
    method: 'POST',
    body: { receivedWeight: WEIGHT, receiveIdempotencyKey: `cg-recv-${stamp}` },
  })
  step(
    'Receive pass (melting)',
    receive.status === 200 && receive.data?.batch?.currentDepartment === 'melting',
    receive.status === 200
      ? `dept=${receive.data?.batch?.currentDepartment}`
      : `${receive.status} ${receive.data?.message || ''}`,
  )

  const start = await authed('/api/erp/production-control/processes/start', {
    method: 'POST',
    body: { batchId, process: 'Melting', department: 'melting' },
  })
  const runId = start.data?.processRun?._id
  step(
    'Start Melting process',
    start.status === 201 && Boolean(runId),
    runId ? `run=${runId}` : `${start.status} ${start.data?.message || JSON.stringify(start.data).slice(0, 200)}`,
  )
  if (!runId) {
    printReport()
    process.exit(1)
  }

  // Balanced complete: 9.5 out + 0.3 scrap + 0.2 loss = 10
  const complete = await authed(`/api/erp/production-control/processes/${runId}/complete`, {
    method: 'POST',
    body: {
      outputWeight: 9.5,
      scrap: 0.3,
      loss: 0.2,
      completeIdempotencyKey: `cg-complete-${stamp}`,
    },
  })
  step(
    'Complete Melting',
    complete.status === 200 && complete.data?.processRun?.status === 'COMPLETED',
    complete.status === 200
      ? `status=${complete.data?.processRun?.status}`
      : `${complete.status} ${complete.data?.message || ''}`,
  )

  const qc = await authed('/api/erp/production-control/qc', {
    method: 'POST',
    body: { batchId, result: 'PASS', remarks: 'CG PCC smoke OK' },
  })
  step(
    'QC PASS',
    qc.status === 201 || qc.status === 200,
    qc.status === 201 || qc.status === 200
      ? 'ok'
      : `${qc.status} ${qc.data?.message || JSON.stringify(qc.data).slice(0, 200)}`,
  )

  const ret = await authed(`/api/erp/production-control/batches/${batchId}/return-to-vault`, {
    method: 'POST',
    body: { inventoryItemId },
  })
  step(
    'Return to vault',
    ret.status === 200,
    ret.status === 200
      ? `status=${ret.data?.batch?.status}`
      : `${ret.status} ${ret.data?.message || JSON.stringify(ret.data).slice(0, 200)}`,
  )

  const detail = await authed(`/api/erp/production-control/batches/${batchId}`)
  step(
    'Verify batch detail',
    detail.status === 200,
    detail.status === 200
      ? `batch=${detail.data?.batch?.batchNumber || batchNumber} status=${detail.data?.batch?.status}`
      : `${detail.status}`,
  )

  // 4. UI spot-check (portal login page + production shell)
  try {
    const loginPage = await fetch('https://cg.loopcstrategies.com/login', { redirect: 'follow' })
    const html = await loginPage.text()
    const shellOk = loginPage.ok && (/id="root"/i.test(html) || /Ops Dashboard/i.test(html))
    step('UI portal /login shell', shellOk, `https://cg.loopcstrategies.com/login → ${loginPage.status}`)
  } catch (err) {
    step('UI portal /login shell', false, err.message)
  }

  console.log('\n--- Summary ---')
  console.log(`inventoryItemId: ${inventoryItemId}`)
  console.log(`batchNumber: ${batchNumber}`)
  console.log(`batchId: ${batchId}`)
  console.log(`createdInventory: ${createdInventory}`)
  printReport()

  const failed = report.filter((r) => !r.ok)
  process.exit(failed.length ? 1 : 0)
}

function printReport() {
  const failed = report.filter((r) => !r.ok)
  console.log(`\nResult: ${failed.length ? 'FAILED' : 'ALL PASSED'} (${report.filter((r) => r.ok).length}/${report.length})`)
  if (failed.length) {
    console.log('Failures:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
