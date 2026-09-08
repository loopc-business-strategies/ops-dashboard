import fs from 'node:fs'

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : []

const hasProductionApiRewrite = rewrites.some((rewrite) => {
  if (rewrite.source !== '/api/(.*)' || rewrite.destination !== 'https://api.loopcstrategies.com/api/$1') return false
  const hasJson = JSON.stringify(rewrite.has || [])
  return hasJson.includes('loopcstrategies\\\\.com') && hasJson.includes('mg|cg|loopc|vb|venusbullions|app')
})

const hasPreviewApiBlock = rewrites.some((rewrite) => (
  rewrite.source === '/api/(.*)' &&
  rewrite.destination === '/api-preview-disabled.json' &&
  JSON.stringify(rewrite.has || []).includes('.*\\\\.vercel\\\\.app')
))

const SPA_FALLBACK_SOURCES = new Set([
  '/(.*)',
  '/((?!api/).*)',
  '/((?!api\\/.*).*)',
  '/((?!api\\/.*|assets\\/.*).*)',
])

const hasSpaFallback = rewrites.some((rewrite) => (
  rewrite.destination === '/index.html' && SPA_FALLBACK_SOURCES.has(rewrite.source)
))

const hasAssetsExcludedFromSpa = rewrites.some((rewrite) => (
  rewrite.destination === '/index.html'
  && String(rewrite.source || '').includes('assets\\/')
))

const failures = []
if (!hasProductionApiRewrite) failures.push('Missing production tenant API rewrite for mg/cg/loopc/vb/venusbullions/app on *.loopcstrategies.com.')
if (!hasPreviewApiBlock) failures.push('Missing Vercel preview API block rewrite.')
if (!hasSpaFallback) failures.push('Missing SPA fallback rewrite to /index.html.')
if (!hasAssetsExcludedFromSpa) failures.push('SPA fallback must exclude /assets/* so missing hashed chunks 404 instead of returning HTML.')

if (failures.length) {
  console.error('Vercel rewrite check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Vercel rewrite check passed.')
