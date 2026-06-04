import fs from 'node:fs'

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : []

const hasProductionApiRewrite = rewrites.some((rewrite) => (
  rewrite.source === '/api/(.*)' &&
  rewrite.destination === 'https://api.loopcstrategies.com/api/$1' &&
  JSON.stringify(rewrite.has || []).includes('loopstrategies')
))

const hasPreviewApiBlock = rewrites.some((rewrite) => (
  rewrite.source === '/api/(.*)' &&
  rewrite.destination === '/api-preview-disabled.json' &&
  JSON.stringify(rewrite.has || []).includes('.*\\\\.vercel\\\\.app')
))

const hasSpaFallback = rewrites.some((rewrite) => (
  rewrite.destination === '/index.html' &&
  (rewrite.source === '/(.*)' || rewrite.source === '/((?!api/).*)' || rewrite.source === '/((?!api\\/.*).*)')
))

const failures = []
if (!hasProductionApiRewrite) failures.push('Missing production tenant API rewrite for mg/cg/loopc/app on *.loopcstrategies.com or *.loopstrategies.com.')
if (!hasPreviewApiBlock) failures.push('Missing Vercel preview API block rewrite.')
if (!hasSpaFallback) failures.push('Missing SPA fallback rewrite to /index.html.')

if (failures.length) {
  console.error('Vercel rewrite check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Vercel rewrite check passed.')
