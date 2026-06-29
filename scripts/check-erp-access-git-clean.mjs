#!/usr/bin/env node
import { execSync } from 'node:child_process'

execSync('npm run sync:erp-access', { stdio: 'inherit' })
execSync(
  'git diff --exit-code -- shared/erp-access-matrix.json backend/shared/erp-access-matrix.json frontend/src/generated/erp-access-matrix.json',
  { stdio: 'inherit' },
)
console.log('ERP access policy git parity OK.')
