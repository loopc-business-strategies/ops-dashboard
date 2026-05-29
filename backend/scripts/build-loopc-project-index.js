/**
 * Scans ops-dashboard repo and writes backend/data/loopc-project-index.json
 * Run: node backend/scripts/build-loopc-project-index.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const OUT = path.join(__dirname, '..', 'data', 'loopc-project-index.json')

function walk(dir, extensions, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, extensions, out)
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/')
}

function scanRouteEndpoints(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const hits = [...content.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi)]
  return hits.map((m) => ({ method: m[1].toUpperCase(), path: m[2] }))
}

function scanExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const names = [...content.matchAll(/module\.exports\s*=\s*\{([^}]+)\}/gs)]
  if (!names.length) return []
  return names[0][1].split(',').map((s) => s.split(':')[0].trim()).filter(Boolean)
}

function main() {
  const routeFiles = walk(path.join(ROOT, 'backend', 'routes'), ['.js'])
  const serviceFiles = walk(path.join(ROOT, 'backend', 'services'), ['.js'])
  const modelFiles = walk(path.join(ROOT, 'backend', 'models'), ['.js'])
  const tabFiles = walk(path.join(ROOT, 'frontend', 'src', 'components', 'tabs'), ['.jsx', '.js'])
  const apiFiles = walk(path.join(ROOT, 'frontend', 'src', 'api'), ['.js'])

  const routes = routeFiles.map((f) => ({
    file: rel(f),
    endpoints: scanRouteEndpoints(f).slice(0, 80),
  })).filter((r) => r.endpoints.length > 0)

  const index = {
    generatedAt: new Date().toISOString(),
    commit: process.env.GIT_COMMIT || null,
    stats: {
      routeFiles: routeFiles.length,
      serviceFiles: serviceFiles.length,
      modelFiles: modelFiles.length,
      tabFiles: tabFiles.length,
      apiFiles: apiFiles.length,
    },
    routes,
    services: serviceFiles.map((f) => ({ file: rel(f), exports: scanExports(f).slice(0, 12) })),
    models: modelFiles.map((f) => rel(f)),
    frontendTabs: tabFiles.filter((f) => /Tab\.jsx$/.test(f)).map((f) => rel(f)),
    frontendApi: apiFiles.map((f) => rel(f)),
    architecture: {
      stack: 'Express 5 + MongoDB multi-tenant + React Vite SPA',
      tenants: ['mg', 'cg', 'loopc'],
      apiBase: 'api.loopcstrategies.com',
      keyPaths: {
        app: 'backend/app.js',
        auth: 'backend/middleware/auth.js',
        tenant: 'backend/middleware/tenantContext.js',
        erpAccess: 'backend/services/erpAccounting/accessPolicy.js',
        loopcAi: 'backend/services/builtinAgentService.js',
        dashboard: 'frontend/src/pages/Dashboard.jsx',
        aiWidget: 'frontend/src/components/AIAgentWidget.jsx',
        mt4Bridge: 'tools/mt4-price-bridge/EquitiMetalPriceBridge.mq4',
      },
    },
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2))
  console.log(`Wrote ${OUT} (${routes.length} route files indexed)`)
}

main()
