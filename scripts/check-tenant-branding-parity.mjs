#!/usr/bin/env node
/**
 * Ensures shared tenant catalog, web branding, and mobile branding stay aligned.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'shared/tenant-catalog.json'), 'utf8'))
const catalogKeys = Object.keys(catalog.tenants || {}).sort()

function readMobilePrimaryColors() {
  const src = fs.readFileSync(path.join(root, 'mobile/src/config/tenantBranding.ts'), 'utf8')
  const primaries = {}
  for (const key of catalogKeys) {
    const block = src.match(new RegExp(`${key}:\\s*\\{[\\s\\S]*?primary:\\s*'([^']+)'`, 'm'))
    if (!block) throw new Error(`mobile tenantBranding missing block for ${key}`)
    primaries[key] = block[1]
  }
  return primaries
}

function readWebBrandPrimaries() {
  const src = fs.readFileSync(path.join(root, 'frontend/src/config/tenantBranding.js'), 'utf8')
  const defaultPrimary = src.match(/defaultBranding[\s\S]*?brandPrimary:\s*'([^']+)'/)?.[1]
  if (!defaultPrimary) throw new Error('frontend defaultBranding.colors.brandPrimary not found')

  const primaries = {}
  for (const key of catalogKeys) {
    const block = src.match(new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n  \\},`, 'm'))?.[1] || ''
    const override = block.match(/brandPrimary:\s*'([^']+)'/)?.[1]
    primaries[key] = override || defaultPrimary
  }
  return primaries
}

function readWebMeta() {
  const src = fs.readFileSync(path.join(root, 'frontend/src/config/tenantBranding.js'), 'utf8')
  const defaultTabs = src.match(/defaultBranding[\s\S]*?enabledTabs:\s*\[([^\]]+)\]/)?.[1]
  const defaultEnabledTabs = defaultTabs
    ? defaultTabs.split(',').map((s) => s.replace(/['"\s]/g, '')).filter(Boolean).sort()
    : []
  const meta = {}
  for (const key of catalogKeys) {
    const block = src.match(new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n  \\},`, 'm'))?.[1] || ''
    const displayName = block.match(/displayName:\s*'([^']+)'/)?.[1]
    const tagline = block.match(/tagline:\s*'([^']+)'/)?.[1]
    const enabledTabs = block.match(/enabledTabs:\s*\[([^\]]+)\]/)?.[1]
    meta[key] = {
      displayName,
      tagline,
      enabledTabs: enabledTabs
        ? enabledTabs.split(',').map((s) => s.replace(/['"\s]/g, '')).filter(Boolean).sort()
        : defaultEnabledTabs,
    }
  }
  return meta
}

function readMobileMeta() {
  const src = fs.readFileSync(path.join(root, 'mobile/src/config/tenantBranding.ts'), 'utf8')
  const meta = {}
  for (const key of catalogKeys) {
    const display = src.match(new RegExp(`${key}:\\s*\\{[\\s\\S]*?displayName:\\s*'([^']+)'`, 'm'))
    const tagline = src.match(new RegExp(`${key}:\\s*\\{[\\s\\S]*?tagline:\\s*'([^']+)'`, 'm'))
    const portal = src.match(new RegExp(`${key}:\\s*\\{[\\s\\S]*?portalHost:\\s*'([^']+)'`, 'm'))
    meta[key] = {
      displayName: display?.[1],
      tagline: tagline?.[1],
      portalHost: portal?.[1],
    }
  }
  return meta
}

const mobileTenantsMatch = fs.readFileSync(path.join(root, 'mobile/src/config/tenantBranding.ts'), 'utf8')
const mobileExtractedKeys = catalogKeys.filter((key) =>
  new RegExp(`^  ${key}:\\s*\\{`, 'm').test(mobileTenantsMatch),
).sort()

const errors = []

if (JSON.stringify(mobileExtractedKeys) !== JSON.stringify(catalogKeys)) {
  errors.push(`mobile tenant keys [${mobileExtractedKeys.join(', ')}] != catalog [${catalogKeys.join(', ')}]`)
}

const mobilePrimary = readMobilePrimaryColors()
const webPrimary = readWebBrandPrimaries()
const mobileMeta = readMobileMeta()
const webMeta = readWebMeta()

for (const key of catalogKeys) {
  const cat = catalog.tenants[key]
  const catalogTabs = [...(cat.enabledTabs || [])].sort()
  if (mobilePrimary[key] !== webPrimary[key]) {
    errors.push(`${key}: mobile primary ${mobilePrimary[key]} != web brandPrimary ${webPrimary[key]}`)
  }
  if (cat.brandPrimary && webPrimary[key] !== cat.brandPrimary) {
    errors.push(`${key}: web brandPrimary ${webPrimary[key]} != catalog ${cat.brandPrimary}`)
  }
  if (mobileMeta[key].displayName !== cat.displayName) {
    errors.push(`${key}: mobile displayName "${mobileMeta[key].displayName}" != catalog "${cat.displayName}"`)
  }
  if (webMeta[key].displayName !== cat.displayName) {
    errors.push(`${key}: web displayName "${webMeta[key].displayName}" != catalog "${cat.displayName}"`)
  }
  if (mobileMeta[key].tagline !== cat.tagline) {
    errors.push(`${key}: mobile tagline "${mobileMeta[key].tagline}" != catalog "${cat.tagline}"`)
  }
  if (webMeta[key].tagline !== cat.tagline) {
    errors.push(`${key}: web tagline "${webMeta[key].tagline}" != catalog "${cat.tagline}"`)
  }
  if (mobileMeta[key].portalHost !== cat.portalHost) {
    errors.push(`${key}: mobile portalHost "${mobileMeta[key].portalHost}" != catalog "${cat.portalHost}"`)
  }
  if (JSON.stringify(webMeta[key].enabledTabs) !== JSON.stringify(catalogTabs)) {
    errors.push(`${key}: web enabledTabs [${webMeta[key].enabledTabs.join(', ')}] != catalog [${catalogTabs.join(', ')}]`)
  }
}

if (errors.length) {
  console.error('Tenant branding parity check failed:')
  errors.forEach((e) => console.error(`  • ${e}`))
  process.exit(1)
}

console.log(`Tenant branding parity OK (${catalogKeys.join(', ')})`)
