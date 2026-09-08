/**
 * Shared helper: load sorted tenant keys from shared/tenant-catalog.json.
 * Used by root smoke/ops scripts so new catalog tenants are covered automatically.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(root, 'shared', 'tenant-catalog.json')

export function loadCatalogTenantKeys() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  return Object.keys(catalog.tenants || {}).sort()
}
