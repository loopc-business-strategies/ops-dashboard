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

for (const key of catalogKeys) {
  const cat = catalog.tenants[key]
  if (mobilePrimary[key] !== webPrimary[key]) {
    errors.push(`${key}: mobile primary ${mobilePrimary[key]} != web brandPrimary ${webPrimary[key]}`)
  }
  if (mobileMeta[key].displayName !== cat.displayName) {
    errors.push(`${key}: mobile displayName "${mobileMeta[key].displayName}" != catalog "${cat.displayName}"`)
  }
  if (mobileMeta[key].tagline !== cat.tagline) {
    errors.push(`${key}: mobile tagline "${mobileMeta[key].tagline}" != catalog "${cat.tagline}"`)
  }
  if (mobileMeta[key].portalHost !== cat.portalHost) {
    errors.push(`${key}: mobile portalHost "${mobileMeta[key].portalHost}" != catalog "${cat.portalHost}"`)
  }
}

if (errors.length) {
  console.error('Tenant branding parity check failed:')
  errors.forEach((e) => console.error(`  • ${e}`))
  process.exit(1)
}

console.log(`Tenant branding parity OK (${catalogKeys.join(', ')})`)
