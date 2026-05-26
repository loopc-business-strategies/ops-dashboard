/**
 * Lightweight HTTP load smoke: sequential GETs to a URL (default /api/health).
 * Use after starting the backend (e.g. npm run dev in backend).
 *
 *   LOAD_SMOKE_URL=http://127.0.0.1:5000/api/health LOAD_SMOKE_REQUESTS=50 node scripts/http-load-smoke.mjs
 */
const url = process.env.LOAD_SMOKE_URL || 'http://127.0.0.1:5000/api/health'
const total = Math.max(1, Number(process.env.LOAD_SMOKE_REQUESTS || 30))
const concurrency = Math.max(1, Math.min(total, Number(process.env.LOAD_SMOKE_CONCURRENCY || 5)))

async function oneFetch(i) {
  const t0 = performance.now()
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  const ms = performance.now() - t0
  if (!res.ok) {
    throw new Error(`Request ${i + 1}: ${res.status} ${res.statusText}`)
  }
  return ms
}

async function runBatch(start, size) {
  const times = []
  await Promise.all(
    Array.from({ length: size }, (_, j) =>
      oneFetch(start + j).then((ms) => {
        times.push(ms)
      }),
    ),
  )
  return times
}

const batches = Math.ceil(total / concurrency)
let allMs = []
for (let b = 0; b < batches; b += 1) {
  const start = b * concurrency
  const size = Math.min(concurrency, total - start)
  const chunk = await runBatch(start, size)
  allMs = allMs.concat(chunk)
}

allMs.sort((a, b) => a - b)
const sum = allMs.reduce((a, x) => a + x, 0)
const p50 = allMs[Math.floor(allMs.length * 0.5)]
const p95 = allMs[Math.floor(allMs.length * 0.95)]

console.log(
  JSON.stringify(
    {
      url,
      requests: total,
      concurrency,
      ok: true,
      latencyMs: {
        min: allMs[0],
        max: allMs[allMs.length - 1],
        mean: Math.round((sum / allMs.length) * 100) / 100,
        p50: Math.round(p50 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
      },
    },
    null,
    2,
  ),
)
